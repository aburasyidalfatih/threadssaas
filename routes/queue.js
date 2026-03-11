const express = require('express');
const router = express.Router();
const db = require('../config/database');
const ContentQueueService = require('../services/content-queue');

// Queue page
router.get('/', (req, res) => {
  const accounts = db.prepare("SELECT * FROM accounts WHERE is_active = 1").all();
  const queueItems = ContentQueueService.getAllQueues();

  // Queue stats and configs per account
  const queueStats = {};
  const queueConfigs = {};
  
  accounts.forEach(acc => {
    queueStats[acc.id] = {
      queued: db.prepare("SELECT COUNT(*) as c FROM content_queue WHERE account_id = ? AND status = 'queued'").get(acc.id).c,
      used: db.prepare("SELECT COUNT(*) as c FROM content_queue WHERE account_id = ? AND status = 'used'").get(acc.id).c
    };
    
    // Get or create config
    let config = db.prepare("SELECT * FROM queue_configs WHERE account_id = ?").get(acc.id);
    if (!config) {
      db.prepare("INSERT INTO queue_configs (account_id) VALUES (?)").run(acc.id);
      config = db.prepare("SELECT * FROM queue_configs WHERE account_id = ?").get(acc.id);
    }
    queueConfigs[acc.id] = config;
  });
  
  res.render('queue', {
    page: 'queue',
    accounts,
    queueItems,
    queueStats,
    queueConfigs
  });
});

// Save Queue Settings
router.post('/settings/:accountId', (req, res) => {
  const { is_enabled, schedule_hours } = req.body;
  // Jika checkbox tidak di-check, is_enabled akan undefined
  const isEnabled = is_enabled === '1' ? 1 : 0;
  const hours = schedule_hours || '08,12,16,20';
  
  try {
    db.prepare("UPDATE queue_configs SET is_enabled = ?, schedule_hours = ?, updated_at = datetime('now') WHERE account_id = ?")
      .run(isEnabled, hours, req.params.accountId);
    res.redirect('/queue?success=Pengaturan+jadwal+Queue+berhasil+disimpan');
  } catch (error) {
    res.redirect('/queue?error=' + encodeURIComponent(error.message));
  }
});

// Generate batch content for account
router.post('/generate/:accountId', async (req, res) => {
  const { theme, theme_description, comment_count, count } = req.body;
  const accountId = req.params.accountId;

  if (!theme || !theme.trim()) {
    return res.redirect('/queue?error=Tema+tidak+boleh+kosong');
  }

  try {
    const batchCount = Math.min(parseInt(count || '5', 10), 20);
    const comments = parseInt(comment_count || '3', 10);
    const results = await ContentQueueService.generateBatch(accountId, theme, theme_description, comments, batchCount);
    const success = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    res.redirect('/queue?success=' + success + '+konten+berhasil+di-generate' + (failed > 0 ? '+('+failed+'+gagal)' : ''));
  } catch (error) {
    res.redirect('/queue?error=' + encodeURIComponent(error.message));
  }
});

// Edit queue item
router.post('/edit/:id', (req, res) => {
  const { content_main, content_comments } = req.body;
  try {
    ContentQueueService.updateItem(req.params.id, content_main, content_comments);
    res.redirect('/queue?success=Konten+berhasil+diupdate');
  } catch (error) {
    res.redirect('/queue?error=' + encodeURIComponent(error.message));
  }
});

// Delete queue item
router.post('/delete/:id', (req, res) => {
  ContentQueueService.deleteItem(req.params.id);
  res.redirect('/queue');
});

// Cleanup used items for an account
router.post('/cleanup/:accountId', (req, res) => {
  ContentQueueService.cleanup(req.params.accountId);
  res.redirect('/queue?success=Queue+berhasil+dibersihkan');
});

// API: Get queue item detail (for edit modal)
router.get('/api/:id', (req, res) => {
  const item = db.prepare('SELECT * FROM content_queue WHERE id = ?').get(req.params.id);
  if (!item) return res.json({ success: false, error: 'Not found' });
  
  let comments = [];
  try { comments = JSON.parse(item.content_comments || '[]'); } catch(e) {}
  
  res.json({ success: true, item: { ...item, comments } });
});

module.exports = router;
