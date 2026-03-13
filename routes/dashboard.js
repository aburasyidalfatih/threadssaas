const express = require('express');
const router = express.Router();
const { Database } = require('../config/database');
const AuthService = require('../services/auth');

// Dashboard home
router.get('/', async (req, res) => {
  if (!req.session.userId) {
    return res.redirect('/login');
  }

  try {
    // Get user with subscription info
    const user = await AuthService.getUserById(req.session.userId);
    
    // Get user's accounts first
    const accounts = await Database.all(`
      SELECT ua.*, 
             CASE WHEN ua.access_token IS NOT NULL THEN true ELSE false END as is_connected,
             CASE WHEN ua.token_expires_at < NOW() THEN true ELSE false END as is_expired,
             CASE WHEN ua.token_expires_at < NOW() + INTERVAL '7 days' THEN true ELSE false END as is_expiring_soon
      FROM user_accounts ua 
      WHERE ua.user_id = $1 
      ORDER BY ua.created_at DESC
    `, [req.session.userId]);

    // Get usage stats for current month
    const currentMonth = new Date().toISOString().slice(0, 7) + '-01';
    const usage = await Database.get(`
      SELECT 
        COALESCE(SUM(CASE WHEN metric = 'posts' THEN value END), 0) as posts_used,
        COALESCE(SUM(CASE WHEN metric = 'accounts' THEN value END), 0) as accounts_used
      FROM usage_tracking 
      WHERE user_id = $1 AND period_start >= $2
    `, [req.session.userId, currentMonth]) || { posts_used: 0, accounts_used: 0 };

    // Add usage data to user object
    user.usage = {
      accounts_used: accounts.length,
      posts_this_month: parseInt(usage.posts_used) || 0
    };
    
    // Add limits to user object
    user.limits = {
      max_accounts: user.max_accounts || 3,
      max_posts_per_month: user.max_posts_per_month || 500
    };

    // Get recent posts
    const recentPosts = await Database.all(`
      SELECT up.*, ua.username as account_username
      FROM user_posts up
      JOIN user_accounts ua ON ua.id = up.account_id
      WHERE up.user_id = $1 
      ORDER BY up.created_at DESC 
      LIMIT 10
    `, [req.session.userId]) || [];

    // Calculate stats
    const stats = {
      totalAccounts: accounts.length,
      activeAccounts: accounts.filter(a => a.is_connected && !a.is_expired).length,
      postsToday: recentPosts.filter(p => {
        const today = new Date().toDateString();
        return new Date(p.created_at).toDateString() === today;
      }).length,
      queueCount: 0, // TODO: implement queue count
      activeAutopilots: 0 // TODO: implement autopilot count
    };

    res.render('dashboard/index', {
      user,
      accounts,
      recentPosts,
      stats,
      expiringTokens: accounts.filter(a => a.is_expiring_soon),
      page: 'dashboard'
    });

  } catch (error) {
    console.error('Dashboard error:', error);
    res.redirect('/login?error=' + encodeURIComponent('Gagal memuat dashboard'));
  }
});

// Dashboard route alias
router.get('/dashboard', async (req, res) => {
  // Redirect to root dashboard
  res.redirect('/');
});

module.exports = router;
