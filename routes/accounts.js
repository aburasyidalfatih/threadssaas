const express = require('express');
const router = express.Router();
const db = require('../config/database');
const ThreadsAPI = require('../services/threads-api');

// List accounts
router.get('/', (req, res) => {
  const accounts = db.prepare(`
    SELECT 
      a.*,
      COUNT(DISTINCT p.id) as total_posts,
      COUNT(DISTINCT CASE WHEN p.status = 'done' THEN p.id END) as success_posts,
      MAX(p.posted_at) as last_posted
    FROM accounts a
    LEFT JOIN posts p ON p.account_id = a.id
    GROUP BY a.id
    ORDER BY a.created_at DESC
  `).all();

  // Calculate stats
  const stats = {
    total: accounts.length,
    active: accounts.filter(a => a.is_active && a.access_token).length,
    inactive: accounts.filter(a => !a.is_active).length,
    expired: accounts.filter(a => {
      if (!a.token_expires_at) return false;
      return new Date(a.token_expires_at) < new Date();
    }).length,
    expiringSoon: accounts.filter(a => {
      if (!a.token_expires_at) return false;
      const daysLeft = (new Date(a.token_expires_at) - new Date()) / (1000 * 60 * 60 * 24);
      return daysLeft > 0 && daysLeft < 7;
    }).length
  };

  // Add computed fields to accounts
  accounts.forEach(acc => {
    const expiresDate = acc.token_expires_at ? new Date(acc.token_expires_at) : null;
    const now = new Date();
    acc.daysLeft = expiresDate ? Math.ceil((expiresDate - now) / (1000 * 60 * 60 * 24)) : null;
    acc.isExpired = expiresDate && expiresDate < now;
    acc.isExpiringSoon = acc.daysLeft !== null && acc.daysLeft > 0 && acc.daysLeft < 7;
    acc.successRate = acc.total_posts > 0 ? Math.round((acc.success_posts / acc.total_posts) * 100) : 0;
    acc.lastPostedFormatted = acc.last_posted ? new Date(acc.last_posted).toLocaleString('id-ID', {day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'}) : '-';
    acc.expiresFormatted = expiresDate ? (acc.isExpired ? 'Expired' : (acc.isExpiringSoon ? acc.daysLeft + ' hari lagi' : expiresDate.toLocaleDateString('id-ID', {day: 'numeric', month: 'short', year: 'numeric'}))) : '-';
  });

  res.render('accounts', { page: 'accounts', accounts, stats });
});

// Add account form
router.post('/add', (req, res) => {
  const { username, theme, theme_description } = req.body;
  const redirect_uri = `${process.env.BASE_URL || 'http://localhost:3000'}/callback/threads`;

  // Get global App ID and Secret from settings
  const appIdRow = db.prepare("SELECT value FROM settings WHERE key = 'threads_app_id'").get();
  const appSecretRow = db.prepare("SELECT value FROM settings WHERE key = 'threads_app_secret'").get();
  
  const app_id = appIdRow?.value || '';
  const app_secret = appSecretRow?.value || '';

  // Validation
  if (!username || !username.trim()) {
    return res.redirect('/accounts?error=Username+tidak+boleh+kosong');
  }
  if (!app_id || !app_id.trim()) {
    return res.redirect('/accounts?error=Threads+App+ID+belum+diatur.+Silakan+atur+di+menu+Pengaturan');
  }
  if (!app_secret || !app_secret.trim()) {
    return res.redirect('/accounts?error=Threads+App+Secret+belum+diatur.+Silakan+atur+di+menu+Pengaturan');
  }

  try {
    db.prepare(`
      INSERT INTO accounts (username, app_id, app_secret, redirect_uri, theme, theme_description)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(username, app_id, app_secret, redirect_uri, theme || '', theme_description || '');

    // Also create auto_reply_config for this account
    const account = db.prepare('SELECT id FROM accounts WHERE username = ? ORDER BY id DESC LIMIT 1').get(username);
    if (account) {
      db.prepare('INSERT OR IGNORE INTO auto_reply_config (account_id) VALUES (?)').run(account.id);
    }

    res.redirect('/accounts?success=Akun+berhasil+ditambahkan.+Klik+Connect+untuk+menghubungkan');
  } catch (error) {
    res.redirect('/accounts?error=' + encodeURIComponent(error.message));
  }
});

// Connect account (start OAuth)
router.get('/connect/:id', (req, res) => {
  const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(req.params.id);
  if (!account) {
    return res.redirect('/accounts?error=Account+not+found');
  }

  const authUrl = ThreadsAPI.getAuthorizationUrl(account);
  res.redirect(authUrl);
});

// Delete account
router.post('/delete/:id', (req, res) => {
  db.prepare('DELETE FROM accounts WHERE id = ?').run(req.params.id);
  res.redirect('/accounts');
});

// Toggle active
router.post('/toggle/:id', (req, res) => {
  const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(req.params.id);
  if (account) {
    db.prepare('UPDATE accounts SET is_active = ?, updated_at = datetime(\'now\') WHERE id = ?')
      .run(account.is_active ? 0 : 1, req.params.id);
  }
  res.redirect('/accounts');
});

// Disconnect (remove token)
router.post('/disconnect/:id', (req, res) => {
  db.prepare("UPDATE accounts SET access_token = NULL, threads_user_id = NULL, token_expires_at = NULL, updated_at = datetime('now') WHERE id = ?")
    .run(req.params.id);
  res.redirect('/accounts');
});

// Update account theme only
router.post('/update/:id', (req, res) => {
  const { theme, theme_description, threads_user_id, access_token } = req.body;

  try {
    // Check if this is a direct token account
    const account = db.prepare('SELECT app_id FROM accounts WHERE id = ?').get(req.params.id);
    
    if (account && account.app_id === 'direct') {
      // Update direct token account with user ID and token
      db.prepare('UPDATE accounts SET theme = ?, theme_description = ?, threads_user_id = ?, access_token = ?, updated_at = datetime(\'now\') WHERE id = ?')
        .run(theme || '', theme_description || '', threads_user_id || '', access_token || '', req.params.id);
    } else {
      // Update regular OAuth account (theme only)
      db.prepare('UPDATE accounts SET theme = ?, theme_description = ?, updated_at = datetime(\'now\') WHERE id = ?')
        .run(theme || '', theme_description || '', req.params.id);
    }
    
    res.redirect('/accounts?success=Akun+berhasil+diperbarui');
  } catch (error) {
    res.redirect('/accounts?error=' + encodeURIComponent(error.message));
  }
});

// Add account with direct token (no OAuth)
router.post('/add-direct', (req, res) => {
  const { username, threads_user_id, access_token, theme, theme_description } = req.body;
  const redirect_uri = `${process.env.BASE_URL || 'http://localhost:3000'}/callback/threads`;

  if (!username || !username.trim()) {
    return res.redirect('/accounts?error=Username+tidak+boleh+kosong');
  }
  if (!threads_user_id || !threads_user_id.trim()) {
    return res.redirect('/accounts?error=Threads+User+ID+tidak+boleh+kosong');
  }
  if (!access_token || !access_token.trim()) {
    return res.redirect('/accounts?error=Access+Token+tidak+boleh+kosong');
  }

  try {
    db.prepare(`
      INSERT INTO accounts (username, threads_user_id, access_token, app_id, app_secret, redirect_uri, theme, theme_description, is_active)
      VALUES (?, ?, ?, 'direct', 'direct', ?, ?, ?, 1)
    `).run(username, threads_user_id, access_token, redirect_uri, theme || '', theme_description || '');

    // Create auto_reply_config for this account
    const account = db.prepare('SELECT id FROM accounts WHERE username = ? ORDER BY id DESC LIMIT 1').get(username);
    if (account) {
      db.prepare('INSERT OR IGNORE INTO auto_reply_config (account_id) VALUES (?)').run(account.id);
    }

    res.redirect('/accounts?success=Akun+berhasil+ditambahkan');
  } catch (error) {
    res.redirect('/accounts?error=' + encodeURIComponent(error.message));
  }
});

// Test connection
router.post('/test/:id', async (req, res) => {
  try {
    const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(req.params.id);
    if (!account || !account.access_token) {
      return res.json({ success: false, message: 'Token tidak ditemukan' });
    }

    const profile = await ThreadsAPI.getUserProfile(account.access_token);
    
    if (profile && profile.id) {
      res.json({ success: true, message: 'Koneksi berhasil! @' + profile.username });
    } else {
      res.json({ success: false, message: 'Token tidak valid atau expired' });
    }
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
});

// Bulk actions
router.post('/bulk-enable', (req, res) => {
  const ids = req.body['ids[]'] || [];
  if (Array.isArray(ids)) {
    ids.forEach(id => {
      db.prepare("UPDATE accounts SET is_active = 1, updated_at = datetime('now') WHERE id = ?").run(id);
    });
  }
  res.redirect('/accounts?success=' + ids.length + '+akun+berhasil+diaktifkan');
});

router.post('/bulk-disable', (req, res) => {
  const ids = req.body['ids[]'] || [];
  if (Array.isArray(ids)) {
    ids.forEach(id => {
      db.prepare("UPDATE accounts SET is_active = 0, updated_at = datetime('now') WHERE id = ?").run(id);
    });
  }
  res.redirect('/accounts?success=' + ids.length + '+akun+berhasil+dinonaktifkan');
});

router.post('/bulk-delete', (req, res) => {
  const ids = req.body['ids[]'] || [];
  if (Array.isArray(ids)) {
    ids.forEach(id => {
      db.prepare('DELETE FROM accounts WHERE id = ?').run(id);
    });
  }
  res.redirect('/accounts?success=' + ids.length + '+akun+berhasil+dihapus');
});

module.exports = router;
