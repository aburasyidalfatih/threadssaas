const express = require('express');
const router = express.Router();
const db = require('../config/database');
const AutoPilotService = require('../services/autopilot');

// Autopilot page
router.get('/', (req, res) => {
  const configs = AutoPilotService.getConfigs();
  const accounts = db.prepare('SELECT * FROM accounts WHERE is_active = 1').all();
  const defaultCommentCount = db.prepare("SELECT value FROM settings WHERE key = 'default_comment_count'").get();

  res.render('autopilot', {
    page: 'autopilot',
    configs,
    accounts,
    defaultCommentCount: parseInt(defaultCommentCount?.value || '3', 10)
  });
});

// Save/Update autopilot config
router.post('/save', (req, res) => {
  const { account_id, is_enabled, posting_hours, comment_count } = req.body;

  try {
    // Get theme from accounts table instead of form input
    const account = db.prepare('SELECT theme, theme_description FROM accounts WHERE id = ?').get(account_id);
    if (!account || !account.theme) {
      return res.redirect('/autopilot?error=Akun+tidak+ditemukan+atau+tema+belum+diatur.+Silakan+atur+tema+di+halaman+Pengaturan+Akun');
    }

    AutoPilotService.saveConfig(account_id, {
      is_enabled,
      theme: account.theme,
      theme_description: account.theme_description,
      posting_hours,
      comment_count
    });
    res.redirect('/autopilot?success=Konfigurasi+autopilot+tersimpan');
  } catch (error) {
    res.redirect('/autopilot?error=' + encodeURIComponent(error.message));
  }
});

// Delete config
router.post('/delete/:accountId', (req, res) => {
  AutoPilotService.deleteConfig(req.params.accountId);
  res.redirect('/autopilot');
});

// Reset topic history
router.post('/reset-history/:accountId', (req, res) => {
  try {
    AutoPilotService.resetHistory(req.params.accountId);
    // Also reset today's posts count
    const today = new Date().toISOString().split('T')[0];
    db.prepare("DELETE FROM posts WHERE account_id = ? AND type = 'autopilot' AND DATE(created_at) = ?")
      .run(req.params.accountId, today);
    res.redirect('/autopilot?success=Riwayat+topik+dan+posts+hari+ini+direset');
  } catch (error) {
    console.error('[AutoPilot Reset] Error:', error.message);
    res.redirect('/autopilot?error=' + encodeURIComponent(error.message));
  }
});

// Toggle autopilot status
router.post('/toggle/:accountId', (req, res) => {
  const { is_enabled } = req.body;
  const isEnabled = is_enabled === '1' ? 1 : 0;
  
  try {
    db.prepare("UPDATE autopilot_configs SET is_enabled = ? WHERE account_id = ?")
      .run(isEnabled, req.params.accountId);
    res.redirect('/autopilot?success=Status+autopilot+diperbarui');
  } catch (error) {
    res.redirect('/autopilot?error=' + encodeURIComponent(error.message));
  }
});

// Trigger manual run for specific account
router.post('/trigger/:accountId', async (req, res) => {
  try {
    const config = db.prepare(`
      SELECT ap.*, a.username, a.threads_user_id, a.access_token
      FROM autopilot_configs ap
      JOIN accounts a ON a.id = ap.account_id
      WHERE ap.account_id = ?
    `).get(req.params.accountId);

    if (!config) {
      return res.redirect('/autopilot?error=Config+not+found');
    }
    if (!config.access_token) {
      return res.redirect('/autopilot?error=Akun+belum+terkoneksi');
    }
    if (!config.theme || !config.theme.trim()) {
      return res.redirect('/autopilot?error=Tema+belum+dikonfigurasi');
    }

    // Check Gemini API Key from database or env
    const geminiKeySetting = db.prepare("SELECT value FROM settings WHERE key = 'gemini_api_key'").get();
    const geminiKey = geminiKeySetting?.value || process.env.GEMINI_API_KEY;
    if (!geminiKey || !geminiKey.trim()) {
      return res.redirect('/autopilot?error=Gemini+API+Key+belum+dikonfigurasi');
    }

    // Force run: set posting_hours to current hour so it always matches
    const currentHour = new Date().getHours();
    await AutoPilotService.processAccount({ ...config, posting_hours: String(currentHour) });
    res.redirect('/autopilot?success=Post+berhasil+di-trigger+untuk+@' + config.username);
  } catch (error) {
    console.error('[AutoPilot Trigger] Error:', error.message);
    res.redirect('/autopilot?error=' + encodeURIComponent(error.message));
  }
});

module.exports = router;
