const express = require('express');
const router = express.Router();
const { Database } = require('../config/database');
const AuthService = require('../services/auth');

// Create post page
router.get('/create', async (req, res) => {
  if (!req.session.userId) {
    return res.redirect('/login');
  }

  try {
    // Get user with limits
    const user = await AuthService.getUserById(req.session.userId);
    
    // Get user's active accounts
    const accounts = await Database.all(`
      SELECT ua.id, ua.username, ua.theme
      FROM user_accounts ua 
      WHERE ua.user_id = $1 
        AND ua.access_token IS NOT NULL 
        AND (ua.token_expires_at IS NULL OR ua.token_expires_at > NOW())
      ORDER BY ua.username ASC
    `, [req.session.userId]) || [];

    // Get current month usage
    const currentMonth = new Date().toISOString().slice(0, 7) + '-01';
    const usage = await Database.get(`
      SELECT COALESCE(SUM(CASE WHEN metric = 'posts' THEN value END), 0) as posts_used
      FROM usage_tracking 
      WHERE user_id = $1 AND period_start >= $2
    `, [req.session.userId, currentMonth]) || { posts_used: 0 };

    // Add usage info to user
    user.usage = {
      posts_this_month: parseInt(usage.posts_used) || 0
    };
    
    user.limits = {
      max_posts_per_month: user.max_posts_per_month || 500
    };

    const canCreatePost = user.limits.max_posts_per_month === -1 || 
                         user.usage.posts_this_month < user.limits.max_posts_per_month;

    res.render('posts/create', {
      user,
      accounts,
      canCreatePost,
      page: 'create-post'
    });

  } catch (error) {
    console.error('Create post page error:', error);
    res.redirect('/dashboard?error=' + encodeURIComponent('Gagal memuat halaman buat post'));
  }
});

// Generate content with AI
router.post('/generate', async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const user = await AuthService.getUserById(req.session.userId);
    const { topic, comment_count, account_id } = req.body;

    if (!topic || !account_id) {
      return res.status(400).json({ error: 'Topic dan akun harus diisi' });
    }

    // Check post limit
    const currentMonth = new Date().toISOString().slice(0, 7) + '-01';
    const usage = await Database.get(`
      SELECT COALESCE(SUM(CASE WHEN metric = 'posts' THEN value END), 0) as posts_used
      FROM usage_tracking 
      WHERE user_id = $1 AND period_start >= $2
    `, [req.session.userId, currentMonth]) || { posts_used: 0 };

    const maxPosts = user.max_posts_per_month || 500;
    if (maxPosts !== -1 && parseInt(usage.posts_used) >= maxPosts) {
      return res.status(400).json({ 
        error: `Limit posting tercapai (${maxPosts} posts/bulan). Upgrade plan untuk posting lebih banyak.` 
      });
    }

    // Get account info
    const account = await Database.get(`
      SELECT username, theme FROM user_accounts 
      WHERE id = $1 AND user_id = $2
    `, [account_id, req.session.userId]);

    if (!account) {
      return res.status(400).json({ error: 'Akun tidak ditemukan' });
    }

    // TODO: Implement AI content generation
    // For now, return mock content
    const mockContent = {
      main_post: `🔥 ${topic}\n\nIni adalah konten yang dihasilkan AI berdasarkan topik "${topic}". Konten ini akan disesuaikan dengan tema akun @${account.username}.\n\n#threads #ai #content`,
      comments: []
    };

    for (let i = 1; i <= parseInt(comment_count); i++) {
      mockContent.comments.push(`Komentar ${i} untuk topik "${topic}". Ini adalah komentar yang mendukung dan melengkapi post utama.`);
    }

    res.json({
      success: true,
      content: mockContent,
      account: account
    });

  } catch (error) {
    console.error('Generate content error:', error);
    res.status(500).json({ error: 'Gagal generate konten' });
  }
});

// Post content
router.post('/publish', async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { account_id, topic, main_post, comments, schedule_type } = req.body;

    if (!account_id || !topic || !main_post) {
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

    // Save post to database
    const postId = await Database.run(`
      INSERT INTO user_posts (user_id, account_id, topic, content_main, content_comments, schedule_type, status, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [
      req.session.userId,
      account_id,
      topic,
      main_post,
      JSON.stringify(comments || []),
      schedule_type || 'now',
      'pending',
      new Date()
    ]);

    // Update usage tracking
    const currentMonth = new Date().toISOString().slice(0, 7) + '-01';
    await Database.run(`
      INSERT INTO usage_tracking (user_id, metric, value, period_start, created_at)
      VALUES ($1, 'posts', 1, $2, $3)
      ON CONFLICT (user_id, metric, period_start) 
      DO UPDATE SET value = value + 1
    `, [req.session.userId, currentMonth, new Date()]);

    // TODO: Implement actual posting to Threads API
    // For now, just mark as success
    await Database.run(`
      UPDATE user_posts SET status = 'success', posted_at = $1 WHERE id = $2
    `, [new Date(), postId]);

    res.json({ 
      success: true, 
      message: 'Post berhasil dipublikasikan',
      post_id: postId
    });

  } catch (error) {
    console.error('Publish post error:', error);
    res.status(500).json({ error: 'Gagal mempublikasikan post' });
  }
});

// Queue page
router.get('/queue', async (req, res) => {
  if (!req.session.userId) {
    return res.redirect('/login');
  }

  try {
    // Get user with limits
    const user = await AuthService.getUserById(req.session.userId);
    
    // Get user's active accounts
    const accounts = await Database.all(`
      SELECT ua.id, ua.username, ua.theme
      FROM user_accounts ua 
      WHERE ua.user_id = $1 
        AND ua.access_token IS NOT NULL 
        AND (ua.token_expires_at IS NULL OR ua.token_expires_at > NOW())
      ORDER BY ua.username ASC
    `, [req.session.userId]) || [];

    // Get queue items
    const queueItems = await Database.all(`
      SELECT up.*, ua.username as account_username
      FROM user_posts up
      JOIN user_accounts ua ON ua.id = up.account_id
      WHERE up.user_id = $1 AND up.status = 'queued'
      ORDER BY up.created_at ASC
    `, [req.session.userId]) || [];

    // Calculate queue stats per account
    const queueStats = {};
    accounts.forEach(acc => {
      queueStats[acc.id] = {
        queued: queueItems.filter(q => q.account_id === acc.id).length,
        used: 0 // TODO: Calculate used queue items
      };
    });

    // Global stats
    const globalStats = {
      totalQueued: queueItems.length,
      totalUsed: 0, // TODO: Calculate total used
      activeQueues: Object.values(queueStats).filter(s => s.queued > 0).length,
      totalAccounts: accounts.length
    };

    // Add usage info to user
    user.limits = {
      max_queue_items: user.max_queue_items || 50
    };

    res.render('posts/queue', {
      user,
      accounts,
      queueItems,
      queueStats,
      globalStats,
      page: 'queue'
    });

  } catch (error) {
    console.error('Queue page error:', error);
    res.redirect('/dashboard?error=' + encodeURIComponent('Gagal memuat halaman queue'));
  }
});

// Add to queue
router.post('/queue/add', async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { account_id, topic, count, comment_count } = req.body;

    if (!account_id || !topic || !count) {
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

    // Check queue limit
    const currentQueue = await Database.all(`
      SELECT COUNT(*) as count FROM user_posts 
      WHERE user_id = $1 AND status = 'queued'
    `, [req.session.userId]);

    const user = await AuthService.getUserById(req.session.userId);
    const maxQueue = user.max_queue_items || 50;
    
    if (currentQueue[0].count + parseInt(count) > maxQueue) {
      return res.status(400).json({ 
        error: `Limit queue tercapai (${maxQueue} items). Upgrade plan untuk queue lebih banyak.` 
      });
    }

    // Generate and add queue items
    const addedItems = [];
    for (let i = 0; i < parseInt(count); i++) {
      // TODO: Implement AI content generation
      const mockContent = `🔥 ${topic} - Item ${i + 1}\n\nKonten AI untuk topik "${topic}" yang akan diposting secara otomatis.\n\n#threads #ai #queue`;
      
      const result = await Database.run(`
        INSERT INTO user_posts (user_id, account_id, topic, content_main, comment_count, status, created_at)
        VALUES ($1, $2, $3, $4, $5, 'queued', $6)
      `, [
        req.session.userId,
        account_id,
        `${topic} - Item ${i + 1}`,
        mockContent,
        parseInt(comment_count) || 3,
        new Date()
      ]);

      addedItems.push({
        id: result.lastID,
        topic: `${topic} - Item ${i + 1}`,
        content: mockContent
      });
    }

    res.json({ 
      success: true, 
      message: `${count} item berhasil ditambahkan ke queue`,
      items: addedItems
    });

  } catch (error) {
    console.error('Add to queue error:', error);
    res.status(500).json({ error: 'Gagal menambahkan ke queue' });
  }
});

// Delete queue item
router.delete('/queue/:id', async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const queueId = req.params.id;

    // Verify queue item belongs to user
    const queueItem = await Database.get(
      'SELECT id FROM user_posts WHERE id = $1 AND user_id = $2 AND status = "queued"',
      [queueId, req.session.userId]
    );

    if (!queueItem) {
      return res.status(404).json({ error: 'Queue item tidak ditemukan' });
    }

    // Delete queue item
    await Database.run('DELETE FROM user_posts WHERE id = $1', [queueId]);

    res.json({ success: true, message: 'Queue item berhasil dihapus' });

  } catch (error) {
    console.error('Delete queue error:', error);
    res.status(500).json({ error: 'Gagal menghapus queue item' });
  }
});

// Posts history page
router.get('/history', async (req, res) => {
  if (!req.session.userId) {
    return res.redirect('/login');
  }

  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 20;
    const offset = (page - 1) * limit;

    // Get total posts count
    const totalResult = await Database.get(`
      SELECT COUNT(*) as total FROM user_posts WHERE user_id = $1
    `, [req.session.userId]);
    const totalPosts = totalResult.total;
    const totalPages = Math.ceil(totalPosts / limit);

    // Get posts with pagination
    const posts = await Database.all(`
      SELECT up.*, ua.username as account_username,
             to_char(up.posted_at AT TIME ZONE 'Asia/Jakarta', 'DD/MM/YYYY HH24:MI') as posted_at_wib,
             to_char(up.created_at AT TIME ZONE 'Asia/Jakarta', 'DD/MM/YYYY HH24:MI') as created_at_wib
      FROM user_posts up
      LEFT JOIN user_accounts ua ON ua.id = up.account_id
      WHERE up.user_id = $1
      ORDER BY up.created_at DESC
      LIMIT $2 OFFSET $3
    `, [req.session.userId, limit, offset]) || [];

    res.render('posts/history', {
      posts,
      totalPosts,
      totalPages,
      currentPage: page,
      page: 'history'
    });

  } catch (error) {
    console.error('Posts history error:', error);
    res.redirect('/dashboard?error=' + encodeURIComponent('Gagal memuat riwayat postingan'));
  }
});

// Delete post
router.post('/delete/:id', async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const postId = req.params.id;

    // Verify post belongs to user
    const post = await Database.get(
      'SELECT id FROM user_posts WHERE id = $1 AND user_id = $2',
      [postId, req.session.userId]
    );

    if (!post) {
      return res.status(404).json({ error: 'Post tidak ditemukan' });
    }

    // Delete post
    await Database.run('DELETE FROM user_posts WHERE id = $1', [postId]);

    res.redirect('/posts/history?success=' + encodeURIComponent('Post berhasil dihapus'));

  } catch (error) {
    console.error('Delete post error:', error);
    res.redirect('/posts/history?error=' + encodeURIComponent('Gagal menghapus post'));
  }
});

// Retry failed post
router.post('/retry/:id', async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const postId = req.params.id;

    // Verify post belongs to user and is failed
    const post = await Database.get(
      'SELECT id FROM user_posts WHERE id = $1 AND user_id = $2 AND status = $3',
      [postId, req.session.userId, 'failed']
    );

    if (!post) {
      return res.status(404).json({ error: 'Post tidak ditemukan atau bukan status failed' });
    }

    // Update status to pending for retry
    await Database.run(
      'UPDATE user_posts SET status = $1, updated_at = $2 WHERE id = $3',
      ['pending', new Date(), postId]
    );

    res.redirect('/posts/history?success=' + encodeURIComponent('Post akan dicoba ulang'));

  } catch (error) {
    console.error('Retry post error:', error);
    res.redirect('/posts/history?error=' + encodeURIComponent('Gagal retry post'));
  }
});

module.exports = router;
