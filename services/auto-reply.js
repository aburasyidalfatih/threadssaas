const db = require('../config/database');
const ThreadsAPI = require('./threads-api');
const GeminiService = require('./gemini');

class AutoReplyService {
  /**
   * Check all enabled accounts for new replies
   */
  static async checkAllAccounts() {
    const configs = db.prepare(`
      SELECT arc.*, a.threads_user_id, a.access_token, a.username
      FROM auto_reply_config arc
      JOIN accounts a ON a.id = arc.account_id
      WHERE arc.is_enabled = 1 AND a.is_active = 1 AND a.access_token IS NOT NULL
    `).all();

    for (const config of configs) {
      try {
        await this.checkAccountReplies(config);
      } catch (error) {
        console.error(`[AutoReply] Error checking account ${config.username}:`, error.message);
      }
    }
  }

  /**
   * Check a specific account for new replies on recent posts
   */
  static async checkAccountReplies(config) {
    // Get recent posts from this account (last 7 days only)
    const recentPosts = db.prepare(
      "SELECT * FROM posts WHERE account_id = ? AND status = 'done' AND main_post_thread_id IS NOT NULL AND posted_at > datetime('now', '-7 days') ORDER BY posted_at DESC LIMIT 10"
    ).all(config.account_id);

    let repliesProcessed = 0;

    for (const post of recentPosts) {
      if (repliesProcessed >= (config.max_replies_per_check || 5)) break;

      try {
        // Get replies from Threads API
        const replies = await ThreadsAPI.getReplies(
          post.main_post_thread_id,
          config.access_token
        );

        for (const reply of replies) {
          if (repliesProcessed >= (config.max_replies_per_check || 5)) break;

          // Skip our own replies
          if (reply.username === config.username) continue;

          // Check if we already replied to this
          const existingReply = db.prepare(
            'SELECT id FROM reply_logs WHERE original_comment_id = ?'
          ).get(reply.id);

          if (existingReply) continue;

          // Generate and post reply
          await this.processReply(config, post, reply);
          repliesProcessed++;

          // Delay between replies
          await ThreadsAPI.sleep(10000);
        }
      } catch (error) {
        // Skip posts that don't exist, have permission issues, or are too old
        if (error.message.includes('does not exist') || 
            error.message.includes('missing permissions') || 
            error.message.includes('Unsupported get request')) {
          // Silently skip these posts (don't log to reduce noise)
          continue;
        }
        console.error(`[AutoReply] Error processing post ${post.main_post_thread_id}:`, error.message);
      }
    }

    // Update last checked timestamp and log summary
    const summary = repliesProcessed > 0 ? `${repliesProcessed} replies processed` : 'no new replies';
    console.log(`[AutoReply] @${config.username}: ${summary}`);
    
    db.prepare("UPDATE auto_reply_config SET last_checked_at = datetime('now') WHERE id = ?")
      .run(config.id);
  }

  /**
   * Generate and post a reply to a comment
   */
  static async processReply(config, post, comment) {
    try {
      // Generate reply content using AI
      const replyContent = await GeminiService.generateReply(
        comment.text,
        post.content_main || post.topic,
        config.reply_style || 'friendly'
      );

      // Post the reply
      await ThreadsAPI.postReply(
        config.threads_user_id,
        config.access_token,
        comment.id,
        replyContent
      );

      // Log the reply
      db.prepare(`
        INSERT INTO reply_logs (account_id, original_post_id, original_comment_id, original_comment_text, original_commenter, reply_content)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        config.account_id,
        post.main_post_thread_id,
        comment.id,
        comment.text,
        comment.username,
        replyContent
      );

      console.log(`[AutoReply] Replied to ${comment.username}: "${replyContent.substring(0, 50)}..."`);
    } catch (error) {
      console.error(`[AutoReply] Failed to reply to ${comment.username}:`, error.message);
    }
  }
}

module.exports = AutoReplyService;
