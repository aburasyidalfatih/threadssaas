const cron = require('node-cron');
const db = require('../config/database');
const ThreadsAPI = require('./threads-api');
const AutoReplyService = require('./auto-reply');
const AutoPilotService = require('./autopilot');

class SchedulerService {
  static jobs = new Map();
  static autoReplyJob = null;

  /**
   * Initialize all scheduled jobs on startup
   */
  static init() {
    console.log('[Scheduler] Initializing...');

    // Load pending posts and schedule them
    const pendingPosts = db.prepare(
      "SELECT * FROM posts WHERE status = 'scheduled' AND scheduled_at > datetime('now')"
    ).all();

    pendingPosts.forEach(post => {
      this.schedulePost(post);
    });

    console.log(`[Scheduler] Loaded ${pendingPosts.length} pending posts`);

    // Start auto-reply monitor
    this.startAutoReplyMonitor();

    // Start token refresh check (daily at 3AM)
    cron.schedule('0 3 * * *', () => {
      this.refreshExpiringTokens();
    });

    console.log('[Scheduler] Token refresh job scheduled (daily 3AM)');

    // Start autopilot cron (every 30 minutes)
    cron.schedule('*/30 * * * *', async () => {
      console.log('[AutoPilot] Running autopilot check...');
      try {
        await AutoPilotService.runAutoPilot();
      } catch (error) {
        console.error('[AutoPilot] Error:', error.message);
      }
    });

    console.log('[Scheduler] AutoPilot monitor started (every 30 min)');

    // Start Content Queue Worker
    this.startQueueWorker();
  }

  /**
   * Schedule a post for later execution
   */
  static schedulePost(post) {
    const scheduledTime = new Date(post.scheduled_at);
    const now = new Date();

    if (scheduledTime <= now) {
      // Execute immediately if time has passed
      this.executePost(post.id);
      return;
    }

    const delay = scheduledTime.getTime() - now.getTime();

    const timeoutId = setTimeout(() => {
      this.executePost(post.id);
      this.jobs.delete(post.id);
    }, delay);

    this.jobs.set(post.id, timeoutId);
    console.log(`[Scheduler] Post ${post.id} scheduled for ${scheduledTime.toISOString()}`);
  }

  /**
   * Execute a complete posting flow: main post → comments
   */
  static async executePost(postId) {
    const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(postId);
    if (!post) {
      console.error(`[Scheduler] Post ${postId} not found`);
      return;
    }

    const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(post.account_id);
    if (!account || !account.access_token) {
      db.prepare("UPDATE posts SET status = 'failed', error_log = ? WHERE id = ?")
        .run('Account not found or not authenticated', postId);
      return;
    }

    try {
      db.prepare("UPDATE posts SET status = 'posting' WHERE id = ?").run(postId);
      console.log(`[Scheduler] Executing post ${postId}...`);

      // Parse comments
      let comments = [];
      try {
        comments = JSON.parse(post.content_comments || '[]');
      } catch (e) {
        comments = [];
      }

      // Post main content
      const mainResult = await ThreadsAPI.postText(
        account.threads_user_id,
        account.access_token,
        post.content_main
      );

      const mainThreadId = mainResult.id;
      console.log(`[Scheduler] Main post published: ${mainThreadId}`);

      // Get delay between comments from settings
      const delaySetting = db.prepare("SELECT value FROM settings WHERE key = 'post_delay_seconds'").get();
      const delaySeconds = parseInt(delaySetting?.value || '30', 10);

      // Post comments sequentially with delay (chained: each replies to previous)
      // Comment 1 → replies to main post
      // Comment 2 → replies to comment 1
      // Comment 3 → replies to comment 2, etc.
      let lastReplyId = mainThreadId;
      for (let i = 0; i < comments.length; i++) {
        await ThreadsAPI.sleep(delaySeconds * 1000);

        const replyResult = await ThreadsAPI.postReply(
          account.threads_user_id,
          account.access_token,
          lastReplyId,  // reply to the previous post/comment (chained)
          comments[i]
        );

        lastReplyId = replyResult.id;
        console.log(`[Scheduler] Comment ${i + 1}/${comments.length} posted: ${lastReplyId} (reply to: ${i === 0 ? 'main post' : 'comment ' + i})`);
      }

      // Update post status
      db.prepare(
        "UPDATE posts SET status = 'done', main_post_thread_id = ?, posted_at = datetime('now') WHERE id = ?"
      ).run(mainThreadId, postId);

      console.log(`[Scheduler] Post ${postId} completed successfully`);
    } catch (error) {
      console.error(`[Scheduler] Post ${postId} failed:`, error.message);
      db.prepare("UPDATE posts SET status = 'failed', error_log = ? WHERE id = ?")
        .run(error.message, postId);
    }
  }

  /**
   * Cancel a scheduled post
   */
  static cancelPost(postId) {
    const timeoutId = this.jobs.get(postId);
    if (timeoutId) {
      clearTimeout(timeoutId);
      this.jobs.delete(postId);
      db.prepare("UPDATE posts SET status = 'cancelled' WHERE id = ?").run(postId);
      console.log(`[Scheduler] Post ${postId} cancelled`);
    }
  }

  /**
   * Start independent Queue Worker monitoring
   */
  static startQueueWorker() {
    this.queueJob = cron.schedule('*/10 * * * *', async () => {
      console.log('[QueueWorker] Checking content queue schedules...');
      try {
        const ContentQueueService = require('./content-queue');
        
        const configs = db.prepare(`
          SELECT qc.*, a.username, a.threads_user_id, a.access_token 
          FROM queue_configs qc
          JOIN accounts a ON a.id = qc.account_id
          WHERE qc.is_enabled = 1 AND a.is_active = 1 AND a.access_token IS NOT NULL
        `).all();

        const now = new Date();
        const currentHour = now.getHours();

        for (const config of configs) {
          const hours = config.schedule_hours.split(',').map(h => parseInt(h.trim(), 10));
          if (!hours.includes(currentHour)) continue;

          // Check if already posted in this hour slot (WIB timezone)
          const postedThisHour = db.prepare(`
            SELECT COUNT(*) as c FROM posts 
            WHERE account_id = ? AND type = 'queue'
            AND strftime('%Y-%m-%d %H', posted_at, '+7 hours') = strftime('%Y-%m-%d %H', 'now', '+7 hours')
          `).get(config.account_id).c;

          if (postedThisHour > 0) {
            console.log(`[QueueWorker] @${config.username} already posted this hour, skipping...`);
            continue;
          }

          // Process next queue item
          const queueItem = ContentQueueService.getNextQueued(config.account_id);
          if (queueItem) {
            console.log(`[QueueWorker] Posting from queue for @${config.username}: "${queueItem.topic}"`);
            ContentQueueService.markUsed(queueItem.id);
            
            // Create post record
            const result = db.prepare(`
              INSERT INTO posts (account_id, type, topic, content_main, content_comments, comment_count, status)
              VALUES (?, 'queue', ?, ?, ?, ?, 'scheduled')
            `).run(
              config.account_id, 
              queueItem.topic, 
              queueItem.content_main, 
              queueItem.content_comments, 
              queueItem.comment_count
            );
            
            this.executePost(result.lastInsertRowid);
          }
        }
      } catch (error) {
        console.error('[QueueWorker] Error:', error.message);
      }
    });
    console.log('[Scheduler] Queue worker started (every 10 min)');
  }

  /**
   * Start auto-reply monitoring cron
   */
  static startAutoReplyMonitor() {
    // Run every 5 minutes
    this.autoReplyJob = cron.schedule('*/5 * * * *', async () => {
      console.log('[AutoReply] Checking for new comments...');
      try {
        await AutoReplyService.checkAllAccounts();
      } catch (error) {
        console.error('[AutoReply] Error:', error.message);
      }
    });
    console.log('[Scheduler] Auto-reply monitor started (every 5 min)');
  }

  /**
   * Refresh tokens expiring within 7 days
   */
  static async refreshExpiringTokens() {
    const accounts = db.prepare(
      "SELECT * FROM accounts WHERE is_active = 1 AND token_expires_at IS NOT NULL AND token_expires_at < datetime('now', '+7 days')"
    ).all();

    for (const account of accounts) {
      try {
        const result = await ThreadsAPI.refreshToken(account.access_token);
        const expiresAt = new Date(Date.now() + result.expires_in * 1000).toISOString();

        db.prepare('UPDATE accounts SET access_token = ?, token_expires_at = ?, updated_at = datetime(\'now\') WHERE id = ?')
          .run(result.access_token, expiresAt, account.id);

        console.log(`[Scheduler] Token refreshed for account ${account.username}`);
      } catch (error) {
        console.error(`[Scheduler] Token refresh failed for ${account.username}:`, error.message);
      }
    }
  }
}

module.exports = SchedulerService;
