const express = require('express');
const router = express.Router();
const { Database } = require('../config/database');
const AuthService = require('../services/auth');

// Accounts page
router.get('/', async (req, res) => {
  if (!req.session.userId) {
    return res.redirect('/login');
  }

  try {
    // Get user with limits
    const user = await AuthService.getUserById(req.session.userId);
    
    // Get user's accounts
    const accounts = await Database.all(`
      SELECT ua.*, 
             CASE WHEN ua.access_token IS NOT NULL THEN true ELSE false END as is_connected,
             CASE WHEN ua.token_expires_at < NOW() THEN true ELSE false END as is_expired,
             CASE WHEN ua.token_expires_at < NOW() + INTERVAL '7 days' THEN true ELSE false END as is_expiring_soon
      FROM user_accounts ua 
      WHERE ua.user_id = $1 
      ORDER BY ua.created_at DESC
    `, [req.session.userId]) || [];

    // Calculate stats
    const stats = {
      total: accounts.length,
      active: accounts.filter(a => a.is_connected && !a.is_expired).length,
      inactive: accounts.filter(a => !a.is_connected).length,
      expiringSoon: accounts.filter(a => a.is_expiring_soon && !a.is_expired).length,
      expired: accounts.filter(a => a.is_expired).length
    };

    // Add usage info to user
    user.usage = {
      accounts_used: accounts.length
    };
    
    user.limits = {
      max_accounts: user.max_accounts || 3
    };

    res.render('accounts/index', {
      user,
      accounts,
      stats,
      page: 'accounts',
      canAddMore: accounts.length < user.limits.max_accounts
    });

  } catch (error) {
    console.error('Accounts page error:', error);
    res.redirect('/dashboard?error=' + encodeURIComponent('Gagal memuat halaman akun'));
  }
});

// Add account (OAuth)
router.post('/add', async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const user = await AuthService.getUserById(req.session.userId);
    const currentAccounts = await Database.all(
      'SELECT COUNT(*) as count FROM user_accounts WHERE user_id = $1',
      [req.session.userId]
    );

    // Check account limit
    if (currentAccounts[0].count >= (user.max_accounts || 3)) {
      return res.status(400).json({ 
        error: `Limit akun tercapai (${user.max_accounts}). Upgrade plan untuk menambah akun.` 
      });
    }

    const { username, access_token, user_id } = req.body;

    if (!username || !access_token || !user_id) {
      return res.status(400).json({ error: 'Data akun tidak lengkap' });
    }

    // Check if account already exists
    const existing = await Database.get(
      'SELECT id FROM user_accounts WHERE user_id = $1 AND threads_user_id = $2',
      [req.session.userId, user_id]
    );

    if (existing) {
      return res.status(400).json({ error: 'Akun sudah ditambahkan sebelumnya' });
    }

    // Add account
    await Database.run(`
      INSERT INTO user_accounts (user_id, username, threads_user_id, access_token, token_expires_at, created_at)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [
      req.session.userId,
      username,
      user_id,
      access_token,
      new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days
      new Date()
    ]);

    res.json({ success: true, message: 'Akun berhasil ditambahkan' });

  } catch (error) {
    console.error('Add account error:', error);
    res.status(500).json({ error: 'Gagal menambahkan akun' });
  }
});

// Delete account
router.delete('/:id', async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const accountId = req.params.id;

    // Verify account belongs to user
    const account = await Database.get(
      'SELECT id FROM user_accounts WHERE id = $1 AND user_id = $2',
      [accountId, req.session.userId]
    );

    if (!account) {
      return res.status(404).json({ error: 'Akun tidak ditemukan' });
    }

    // Delete account
    await Database.run('DELETE FROM user_accounts WHERE id = $1', [accountId]);

    res.json({ success: true, message: 'Akun berhasil dihapus' });

  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({ error: 'Gagal menghapus akun' });
  }
});

module.exports = router;
