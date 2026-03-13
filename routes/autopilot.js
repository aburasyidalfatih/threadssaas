const express = require('express');
const router = express.Router();
const { Database } = require('../config/database');
const AuthService = require('../services/auth');

// Autopilot page
router.get('/', async (req, res) => {
  console.log('AUTOPILOT ROUTE HIT!');
  
  if (!req.session.userId) {
    return res.redirect('/login');
  }

  try {
    // Force user ID to 1 for testing
    const userId = 1;
    
    // Get user
    const user = await Database.get(`
      SELECT id, email, name, plan, status
      FROM users
      WHERE id = $1
    `, [userId]);
    
    if (!user) {
      return res.redirect('/login');
    }

    user.max_accounts = 3;
    user.max_posts_per_month = 500;
    user.max_queue_items = 50;
    
    // Get user's accounts
    const accounts = await Database.all(`
      SELECT ua.id, ua.username, ua.access_token
      FROM user_accounts ua 
      WHERE ua.user_id = $1 
      ORDER BY ua.username ASC
    `, [userId]) || [];

    // Mock autopilot data for now (avoid table error)
    const autopilots = [];

    // Calculate stats
    const stats = {
      total: 0,
      active: 0,
      inactive: 0,
      postsToday: 0
    };

    console.log('Rendering autopilot page with:', { user: user.email, accounts: accounts.length });

    res.render('autopilot/index', {
      user,
      accounts,
      autopilots,
      stats,
      page: 'autopilot'
    });

  } catch (error) {
    console.error('Autopilot page error:', error);
    res.redirect('/dashboard?error=' + encodeURIComponent('Gagal memuat halaman autopilot'));
  }
});

// Save autopilot config
router.post('/save', async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { 
      account_id, 
      is_enabled, 
      posting_hours, 
      comment_count, 
      topics,
      max_posts_per_day 
    } = req.body;

    if (!account_id || !posting_hours) {
      return res.status(400).json({ error: 'Data tidak lengkap' });
    }

    // Verify account belongs to user
    const account = await Database.get(`
      SELECT id, username FROM user_accounts 
      WHERE id = $1 AND user_id = $2
    `, [account_id, req.session.userId]);

    if (!account) {
      return res.status(400).json({ error: 'Akun tidak ditemukan' });
    }

    // Check if autopilot already exists for this account
    const existing = await Database.get(`
      SELECT id FROM autopilot_configs 
      WHERE user_id = $1 AND account_id = $2
    `, [req.session.userId, account_id]);

    if (existing) {
      // Update existing
      await Database.run(`
        UPDATE autopilot_configs 
        SET is_enabled = $1, posting_hours = $2, comment_count = $3, 
            topics = $4, max_posts_per_day = $5, updated_at = $6
        WHERE id = $7
      `, [
        is_enabled ? 1 : 0,
        posting_hours,
        parseInt(comment_count) || 3,
        JSON.stringify(topics || []),
        parseInt(max_posts_per_day) || 5,
        new Date(),
        existing.id
      ]);
    } else {
      // Create new
      await Database.run(`
        INSERT INTO autopilot_configs 
        (user_id, account_id, is_enabled, posting_hours, comment_count, topics, max_posts_per_day, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        req.session.userId,
        account_id,
        is_enabled ? 1 : 0,
        posting_hours,
        parseInt(comment_count) || 3,
        JSON.stringify(topics || []),
        parseInt(max_posts_per_day) || 5,
        new Date()
      ]);
    }

    res.json({ success: true, message: 'Konfigurasi autopilot berhasil disimpan' });

  } catch (error) {
    console.error('Save autopilot error:', error);
    res.status(500).json({ error: 'Gagal menyimpan konfigurasi' });
  }
});

// Toggle autopilot status
router.post('/toggle/:id', async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const autopilotId = req.params.id;

    // Verify autopilot belongs to user
    const autopilot = await Database.get(
      'SELECT id, is_enabled FROM autopilot_configs WHERE id = $1 AND user_id = $2',
      [autopilotId, req.session.userId]
    );

    if (!autopilot) {
      return res.status(404).json({ error: 'Konfigurasi tidak ditemukan' });
    }

    // Toggle status
    const newStatus = autopilot.is_enabled ? 0 : 1;
    await Database.run(
      'UPDATE autopilot_configs SET is_enabled = $1, updated_at = $2 WHERE id = $3',
      [newStatus, new Date(), autopilotId]
    );

    res.json({ 
      success: true, 
      message: newStatus ? 'Autopilot diaktifkan' : 'Autopilot dinonaktifkan',
      is_enabled: newStatus
    });

  } catch (error) {
    console.error('Toggle autopilot error:', error);
    res.status(500).json({ error: 'Gagal mengubah status' });
  }
});

// Delete autopilot config
router.delete('/:id', async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const autopilotId = req.params.id;

    // Verify autopilot belongs to user
    const autopilot = await Database.get(
      'SELECT id FROM autopilot_configs WHERE id = $1 AND user_id = $2',
      [autopilotId, req.session.userId]
    );

    if (!autopilot) {
      return res.status(404).json({ error: 'Konfigurasi tidak ditemukan' });
    }

    // Delete autopilot
    await Database.run('DELETE FROM autopilot_configs WHERE id = $1', [autopilotId]);

    res.json({ success: true, message: 'Konfigurasi autopilot berhasil dihapus' });

  } catch (error) {
    console.error('Delete autopilot error:', error);
    res.status(500).json({ error: 'Gagal menghapus konfigurasi' });
  }
});

module.exports = router;
