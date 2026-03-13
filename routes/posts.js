const express = require('express');
const router = express.Router();
const db = require('../config/database');
const GeminiService = require('../services/gemini');
const SchedulerService = require('../services/scheduler');

// Create post page
router.get('/create', (req, res) => {
  const accounts = db.prepare("SELECT * FROM accounts WHERE is_active = 1").all();
  const defaultCommentCount = db.prepare("SELECT value FROM settings WHERE key = 'default_comment_count'").get();
  
  res.render('create-post', {
    page: 'create-post',
    accounts,
    defaultCommentCount: parseInt(defaultCommentCount?.value || '3', 10),
    user: req.session.userId ? { id: req.session.userId, name: req.session.userName, email: req.session.userEmail } : null
  });
});

// Generate content via AI
router.post('/generate', async (req, res) => {
  const { topic, comment_count } = req.body;
  
  console.log('[Generate] Request:', { topic, comment_count, userId: req.session.userId });
  
  try {
    if (!topic || !topic.trim()) {
      return res.json({ success: false, error: 'Topic tidak boleh kosong' });
    }
    
    const content = await GeminiService.generatePostContent(topic, parseInt(comment_count || '3', 10));
    console.log('[Generate] Success:', { topic, contentLength: JSON.stringify(content).length });
    res.json({ success: true, content });
  } catch (error) {
    console.error('[Generate] Error:', error.message);
    res.json({ success: false, error: error.message });
  }
});

// Save as draft
router.post('/save-draft', (req, res) => {
  const { account_id, topic, content_main, content_comments, comment_count } = req.body;
  try {
    const comments = typeof content_comments === 'string' ? content_comments : JSON.stringify(content_comments);
    db.prepare(`
      INSERT INTO posts (account_id, type, topic, content_main, content_comments, comment_count, status)
      VALUES (?, 'regular', ?, ?, ?, ?, 'draft')
    `).run(account_id, topic, content_main, comments, parseInt(comment_count || '3', 10));
    res.json({ success: true });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

// Post now
router.post('/post-now', async (req, res) => {
  const { account_id, topic, content_main, content_comments, comment_count } = req.body;
  try {
    const comments = typeof content_comments === 'string' ? content_comments : JSON.stringify(content_comments);
    const result = db.prepare(`
      INSERT INTO posts (account_id, type, topic, content_main, content_comments, comment_count, status)
      VALUES (?, 'regular', ?, ?, ?, ?, 'scheduled')
    `).run(account_id, topic, content_main, comments, parseInt(comment_count || '3', 10));

    // Execute immediately
    SchedulerService.executePost(result.lastInsertRowid);
    res.json({ success: true, postId: result.lastInsertRowid, message: 'Posting dimulai...' });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

// Check post status
router.get('/status/:id', (req, res) => {
  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id);
  if (!post) {
    return res.json({ success: false, error: 'Post tidak ditemukan' });
  }
  
  const statusMap = {
    'draft': '📝 Draft',
    'scheduled': '⏳ Terjadwal',
    'posting': '📤 Sedang Posting...',
    'done': '✅ Berhasil Diposting',
    'failed': '❌ Gagal Posting',
    'cancelled': '⛔ Dibatalkan'
  };

  res.json({
    success: true,
    id: post.id,
    status: post.status,
    statusLabel: statusMap[post.status] || post.status,
    posted_at: post.posted_at,
    error_log: post.error_log,
    main_post_thread_id: post.main_post_thread_id
  });
});

// Schedule post
router.post('/schedule', (req, res) => {
  const { account_id, topic, content_main, content_comments, comment_count, scheduled_at } = req.body;
  try {
    const comments = typeof content_comments === 'string' ? content_comments : JSON.stringify(content_comments);
    const result = db.prepare(`
      INSERT INTO posts (account_id, type, topic, content_main, content_comments, comment_count, status, scheduled_at)
      VALUES (?, 'regular', ?, ?, ?, ?, 'scheduled', ?)
    `).run(account_id, topic, content_main, comments, parseInt(comment_count || '3', 10), scheduled_at);

    const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(result.lastInsertRowid);
    SchedulerService.schedulePost(post);
    res.json({ success: true, postId: result.lastInsertRowid });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

// History with pagination
router.get('/history', (req, res) => {
  const page = Math.max(1, parseInt(req.query.page || '1', 10));
  const perPage = 20;
  const offset = (page - 1) * perPage;

  const totalPosts = db.prepare('SELECT COUNT(*) as count FROM posts').get().count;
  const totalPages = Math.ceil(totalPosts / perPage);

  const posts = db.prepare(`
    SELECT p.*, a.username as account_username,
           datetime(p.posted_at, '+7 hours') as posted_at_wib,
           datetime(p.created_at, '+7 hours') as created_at_wib
    FROM posts p
    LEFT JOIN accounts a ON a.id = p.account_id
    ORDER BY p.created_at DESC
    LIMIT ? OFFSET ?
  `).all(perPage, offset);

  res.render('history', { page: 'history', posts, currentPage: page, totalPages, totalPosts });
});

// Delete post
router.post('/delete/:id', (req, res) => {
  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id);
  if (post && post.status === 'scheduled') {
    SchedulerService.cancelPost(post.id);
  }
  db.prepare('DELETE FROM posts WHERE id = ?').run(req.params.id);
  res.redirect('/posts/history');
});

// Retry failed post
router.post('/retry/:id', (req, res) => {
  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id);
  if (post && post.status === 'failed') {
    db.prepare("UPDATE posts SET status = 'scheduled' WHERE id = ?").run(post.id);
    SchedulerService.executePost(post.id);
  }
  res.redirect('/posts/history');
});

module.exports = router;
