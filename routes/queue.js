const express = require('express');
const router = express.Router();
const db = require('../config/database');
const ContentQueueService = require('../services/content-queue');
const { checkAuth } = require('../middleware/auth');

// Queue page
router.get('/', checkAuth, (req, res) => {
  const accounts = db.prepare("SELECT * FROM accounts WHERE is_active = 1").all();
  const queueItems = ContentQueueService.getAllQueues();

  // Queue stats and configs per account
  const queueStats = {};
  const queueConfigs = {};
  
  accounts.forEach(acc => {
    queueStats[acc.id] = {
      queued: db.prepare("SELECT COUNT(*) as c FROM content_queue WHERE account_id = ? AND status = 'queued'").get(acc.id).c,
      used: db.prepare("SELECT COUNT(*) as c FROM content_queue WHERE account_id = ? AND status = 'used'").get(acc.id).c,
      lastGenerated: db.prepare("SELECT MAX(created_at) as last FROM content_queue WHERE account_id = ?").get(acc.id).last
    };
    
    // Get or create config
    let config = db.prepare("SELECT * FROM queue_configs WHERE account_id = ?").get(acc.id);
    if (!config) {
      db.prepare("INSERT INTO queue_configs (account_id) VALUES (?)").run(acc.id);
      config = db.prepare("SELECT * FROM queue_configs WHERE account_id = ?").get(acc.id);
    }
    queueConfigs[acc.id] = config;
  });
  
  // Calculate next posting times and daily usage
  const nextPostingTimes = {};
  accounts.forEach(acc => {
    const config = queueConfigs[acc.id];
    if (config && config.is_enabled) {
      const hours = config.schedule_hours.split(',').map(h => parseInt(h.trim()));
      const now = new Date();
      const currentHour = now.getHours();
      
      let nextHour = hours.find(h => h > currentHour);
      if (!nextHour) nextHour = hours[0];
      
      const nextPost = new Date();
      if (nextHour <= currentHour) {
        nextPost.setDate(nextPost.getDate() + 1);
      }
      nextPost.setHours(nextHour, 0, 0, 0);
      
      nextPostingTimes[acc.id] = nextPost.toLocaleString('id-ID', {
        day: '2-digit',
        month: '2-digit', 
        hour: '2-digit',
        minute: '2-digit'
      });
    } else {
      nextPostingTimes[acc.id] = 'Nonaktif';
    }
  });

  // Global stats
  const globalStats = {
    totalQueued: queueItems.filter(q => q.status === 'queued').length,
    totalUsed: db.prepare("SELECT COUNT(*) as c FROM content_queue WHERE status = 'used'").get().c,
    totalAccounts: accounts.length,
    activeQueues: accounts.filter(a => queueStats[a.id]?.queued > 0).length
  };

  res.render('queue', {
    page: 'queue',
    accounts,
    queueItems,
    queueStats,
    queueConfigs,
    nextPostingTimes,
    globalStats,
    user: req.session.userId ? { id: req.session.userId, name: req.session.userName, email: req.session.userEmail } : null
  });
});

// Save Queue Settings
router.post('/settings/:accountId', checkAuth, (req, res) => {
  const { is_enabled, schedule_hours } = req.body;
  const accountId = req.params.accountId;
  // Jika checkbox tidak di-check, is_enabled akan undefined
  const isEnabled = is_enabled === '1' ? 1 : 0;
  const hours = schedule_hours || '08,12,16,20';
  
  try {
    db.prepare("UPDATE queue_configs SET is_enabled = ?, schedule_hours = ?, updated_at = datetime('now') WHERE account_id = ?")
      .run(isEnabled, hours, accountId);
    res.redirect('/queue?success=Pengaturan+jadwal+Queue+berhasil+disimpan&account=' + accountId);
  } catch (error) {
    res.redirect('/queue?error=' + encodeURIComponent(error.message) + '&account=' + accountId);
  }
});

// Generate batch content for account
router.post('/generate/:accountId', checkAuth, async (req, res) => {
  const { comment_count, count } = req.body;
  const accountId = req.params.accountId;

  try {
    const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(accountId);
    if (!account || !account.theme) {
      return res.redirect('/queue?error=Akun+tidak+ditemukan+atau+tema+belum+diatur');
    }

    const batchCount = Math.min(parseInt(count || '5', 10), 10);
    const comments = parseInt(comment_count || '3', 10);
    
    res.redirect('/queue?success=Sedang+generate+' + batchCount + '+konten+untuk+@' + account.username + '...&account=' + accountId);
    
    setTimeout(async () => {
      try {
        const results = await ContentQueueService.generateBatch(accountId, account.theme, account.theme_description, comments, batchCount);
        const success = results.filter(r => r.success).length;
        const failed = results.filter(r => !r.success).length;
        console.log(`[Queue] Generated ${success}/${batchCount} content for @${account.username}` + (failed > 0 ? ` (${failed} failed)` : ''));
      } catch (error) {
        console.error(`[Queue] Error generating for @${account.username}:`, error.message);
      }
    }, 100);
    
  } catch (error) {
    res.redirect('/queue?error=' + encodeURIComponent(error.message));
  }
});

// Bulk post selected items
router.post('/bulk-post', checkAuth, async (req, res) => {
  const ids = req.body['ids[]'] || req.body.ids;
  if (!ids || (Array.isArray(ids) && ids.length === 0)) {
    return res.redirect('/queue?error=Tidak+ada+item+yang+dipilih');
  }
  
  const idsArray = Array.isArray(ids) ? ids : [ids];
  res.redirect('/queue?success=Memproses+' + idsArray.length + '+post...');
  
  setTimeout(async () => {
    let successCount = 0;
    for (const id of idsArray) {
      try {
        const item = db.prepare('SELECT * FROM content_queue WHERE id = ?').get(id);
        if (!item) continue;
        
        let comments = [];
        try { comments = JSON.parse(item.content_comments || '[]'); } catch(e) {}
        
        // Create post record
        db.prepare(`
          INSERT INTO posts (account_id, type, topic, content_main, content_comments, comment_count, status)
          VALUES (?, 'regular', ?, ?, ?, ?, 'draft')
        `).run(item.account_id, item.topic, item.content_main, item.content_comments, comments.length);
        
        // Mark as used
        db.prepare("UPDATE content_queue SET status = 'used', updated_at = datetime('now') WHERE id = ?").run(id);
        successCount++;
      } catch (error) {
        console.error(`[Queue] Error posting item ${id}:`, error.message);
      }
    }
    console.log(`[Queue] Bulk posted ${successCount}/${idsArray.length} items`);
  }, 100);
});

// Edit queue item
router.post('/edit/:id', checkAuth, (req, res) => {
  const { content_main, content_comments } = req.body;
  try {
    ContentQueueService.updateItem(req.params.id, content_main, content_comments);
    res.redirect('/queue?success=Konten+berhasil+diupdate');
  } catch (error) {
    res.redirect('/queue?error=' + encodeURIComponent(error.message));
  }
});

// Delete queue item
router.post('/delete/:id', checkAuth, (req, res) => {
  ContentQueueService.deleteItem(req.params.id);
  res.redirect('/queue');
});

// Delete multiple queue items
router.post('/delete-multiple', checkAuth, (req, res) => {
  console.log('Delete multiple request body:', req.body);
  
  const ids = req.body['ids[]'] || req.body.ids;
  if (!ids || (Array.isArray(ids) && ids.length === 0)) {
    return res.redirect('/queue?error=Tidak+ada+item+yang+dipilih');
  }
  
  const idsArray = Array.isArray(ids) ? ids : [ids];
  let deletedCount = 0;
  
  idsArray.forEach(id => {
    try {
      ContentQueueService.deleteItem(id);
      deletedCount++;
    } catch (error) {
      console.error(`Error deleting queue item ${id}:`, error.message);
    }
  });
  
  res.redirect(`/queue?success=${deletedCount}+antrian+berhasil+dihapus`);
});

// Cleanup used items for an account
router.post('/cleanup/:accountId', checkAuth, (req, res) => {
  const accountId = req.params.accountId;
  ContentQueueService.cleanup(accountId);
  res.redirect('/queue?success=Queue+berhasil+dibersihkan&account=' + accountId);
});

// API: Get queue item detail (for edit modal)
router.get('/api/:id', checkAuth, (req, res) => {
  const item = db.prepare('SELECT * FROM content_queue WHERE id = ?').get(req.params.id);
  if (!item) return res.json({ success: false, error: 'Not found' });
  
  let comments = [];
  try { comments = JSON.parse(item.content_comments || '[]'); } catch(e) {}
  
  res.json({ success: true, item: { ...item, comments } });
});

module.exports = router;
