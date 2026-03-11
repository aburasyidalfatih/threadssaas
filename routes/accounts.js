const express = require('express');
const router = express.Router();
const db = require('../config/database');
const ThreadsAPI = require('../services/threads-api');

// List accounts
router.get('/', (req, res) => {
  const accounts = db.prepare('SELECT * FROM accounts ORDER BY created_at DESC').all();
  res.render('accounts', { page: 'accounts', accounts });
});

// Add account form
router.post('/add', (req, res) => {
  const { username, app_id, app_secret } = req.body;
  const redirect_uri = `${process.env.BASE_URL || 'http://localhost:3000'}/callback/threads`;

  // Validation
  if (!username || !username.trim()) {
    return res.redirect('/accounts?error=Username+tidak+boleh+kosong');
  }
  if (!app_id || !app_id.trim()) {
    return res.redirect('/accounts?error=App+ID+tidak+boleh+kosong');
  }
  if (!app_secret || !app_secret.trim()) {
    return res.redirect('/accounts?error=App+Secret+tidak+boleh+kosong');
  }

  try {
    db.prepare(`
      INSERT INTO accounts (username, app_id, app_secret, redirect_uri)
      VALUES (?, ?, ?, ?)
    `).run(username, app_id, app_secret, redirect_uri);

    // Also create auto_reply_config for this account
    const account = db.prepare('SELECT id FROM accounts WHERE username = ? ORDER BY id DESC LIMIT 1').get(username);
    if (account) {
      db.prepare('INSERT OR IGNORE INTO auto_reply_config (account_id) VALUES (?)').run(account.id);
    }

    res.redirect('/accounts');
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

// Update account (edit App ID & Secret)
router.post('/update/:id', (req, res) => {
  const { app_id, app_secret } = req.body;
  
  if (!app_id || !app_id.trim()) {
    return res.redirect('/accounts?error=App+ID+tidak+boleh+kosong');
  }
  if (!app_secret || !app_secret.trim()) {
    return res.redirect('/accounts?error=App+Secret+tidak+boleh+kosong');
  }

  try {
    db.prepare('UPDATE accounts SET app_id = ?, app_secret = ?, updated_at = datetime(\'now\') WHERE id = ?')
      .run(app_id, app_secret, req.params.id);
    res.redirect('/accounts');
  } catch (error) {
    res.redirect('/accounts?error=' + encodeURIComponent(error.message));
  }
});

// Add account with direct token (no OAuth)
router.post('/add-direct', (req, res) => {
  const { username, threads_user_id, access_token } = req.body;
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
      INSERT INTO accounts (username, threads_user_id, access_token, app_id, app_secret, redirect_uri, is_active)
      VALUES (?, ?, ?, 'direct', 'direct', ?, 1)
    `).run(username, threads_user_id, access_token, redirect_uri);

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

module.exports = router;
