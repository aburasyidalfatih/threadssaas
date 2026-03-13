const express = require('express');
const router = express.Router();
const db = require('../config/database');
const ThreadsAPI = require('../services/threads-api');

// OAuth callback from Threads
router.get('/callback/threads', async (req, res) => {
  const { code, state, error, error_reason } = req.query;

  if (error) {
    return res.redirect(`/accounts?error=${encodeURIComponent(error_reason || error)}`);
  }

  if (!code || !state) {
    return res.redirect('/accounts?error=Invalid+callback+parameters');
  }

  const accountId = parseInt(state, 10);
  const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(accountId);

  if (!account) {
    return res.redirect('/accounts?error=Account+not+found');
  }

  try {
    // Exchange code for short-lived token
    const tokenData = await ThreadsAPI.exchangeCodeForToken(code, account);

    // Exchange for long-lived token
    const longLivedData = await ThreadsAPI.getLongLivedToken(
      tokenData.access_token,
      account.app_secret
    );

    const expiresAt = new Date(Date.now() + longLivedData.expires_in * 1000).toISOString();

    // Update account with token and user ID
    db.prepare(`
      UPDATE accounts SET
        threads_user_id = ?,
        access_token = ?,
        token_type = 'long_lived',
        token_expires_at = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `).run(
      String(tokenData.user_id),
      longLivedData.access_token,
      expiresAt,
      accountId
    );

    // Try to get profile info
    try {
      const profile = await ThreadsAPI.getUserProfile(longLivedData.access_token);
      if (profile.username) {
        db.prepare('UPDATE accounts SET username = ? WHERE id = ?')
          .run(profile.username, accountId);
      }
    } catch (e) {
      // Profile fetch is optional
      console.warn('Could not fetch profile:', e.message);
    }

    res.redirect('/accounts?success=Account+connected+successfully');
  } catch (error) {
    console.error('OAuth callback error:', error);
    res.redirect(`/accounts?error=${encodeURIComponent(error.message)}`);
  }
});

module.exports = router;
