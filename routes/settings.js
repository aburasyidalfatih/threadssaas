const express = require('express');
const router = express.Router();
const { Database } = require('../config/database');

// Settings page
router.get('/', async (req, res) => {
  if (!req.session.userId) {
    return res.redirect('/login');
  }

  try {
    const userId = req.session.userId;

    // Get user
    const user = await Database.get(`
      SELECT id, email, name, plan, status
      FROM users
      WHERE id = $1
    `, [userId]);

    if (!user) {
      return res.redirect('/login');
    }

    // Get user settings
    const settingsRows = await Database.all(`
      SELECT key, value FROM user_settings WHERE user_id = $1
    `, [userId]) || [];

    const settings = {};
    settingsRows.forEach(row => { 
      settings[row.key] = row.value; 
    });

    // Default values if not set
    const defaultSettings = {
      gemini_api_key: '',
      gemini_model: 'gemini-2.5-flash',
      default_comment_count: '3',
      post_delay_seconds: '30',
      prompt_organic: '',
      prompt_affiliate: '',
      prompt_reply: '',
      threads_app_id: '',
      threads_app_secret: ''
    };

    // Merge with defaults
    Object.keys(defaultSettings).forEach(key => {
      if (!settings[key]) {
        settings[key] = defaultSettings[key];
      }
    });

    res.render('settings/index', {
      user,
      settings,
      page: 'settings'
    });

  } catch (error) {
    console.error('Settings page error:', error);
    res.redirect('/dashboard?error=' + encodeURIComponent('Gagal memuat halaman pengaturan'));
  }
});

// Save settings
router.post('/save', async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const userId = req.session.userId;
    console.log('Saving settings for user ID:', userId);
    
    const {
      gemini_api_key,
      gemini_model,
      default_comment_count,
      post_delay_seconds,
      prompt_organic,
      prompt_affiliate,
      prompt_reply,
      threads_app_id,
      threads_app_secret
    } = req.body;

    console.log('Settings data:', req.body);

    // Update or insert settings
    const updateSetting = async (key, value) => {
      if (value !== undefined) {
        console.log(`Updating setting: ${key} = ${value}`);
        try {
          const result = await Database.query(`
            INSERT INTO user_settings (user_id, key, value, updated_at)
            VALUES ($1, $2, $3, NOW())
            ON CONFLICT (user_id, key)
            DO UPDATE SET value = $3, updated_at = NOW()
          `, [userId, key, value]);
          console.log('Query result:', result);
        } catch (error) {
          console.error('Query error:', error);
          throw error;
        }
      }
    };

    await updateSetting('gemini_api_key', gemini_api_key);
    await updateSetting('gemini_model', gemini_model);
    await updateSetting('default_comment_count', default_comment_count);
    await updateSetting('post_delay_seconds', post_delay_seconds);
    await updateSetting('prompt_organic', prompt_organic);
    await updateSetting('prompt_affiliate', prompt_affiliate);
    await updateSetting('prompt_reply', prompt_reply);
    await updateSetting('threads_app_id', threads_app_id);
    await updateSetting('threads_app_secret', threads_app_secret);

    res.json({ success: true, message: 'Pengaturan berhasil disimpan' });

  } catch (error) {
    console.error('Save settings error:', error);
    res.status(500).json({ error: 'Gagal menyimpan pengaturan' });
  }
});

module.exports = router;
