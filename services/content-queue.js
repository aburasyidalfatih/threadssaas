const db = require('../config/database');
const GeminiService = require('./gemini');

class ContentQueueService {
  /**
   * Batch generate content for an account's queue (independent from autopilot)
   */
  static async generateBatch(accountId, theme, themeDescription, commentCount, count = 5) {
    const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(accountId);
    if (!account) throw new Error('Akun tidak ditemukan');

    // Get existing topics to avoid repetition
    const existingTopics = db.prepare(
      "SELECT topic FROM content_queue WHERE account_id = ? ORDER BY created_at DESC LIMIT 50"
    ).all(accountId).map(r => r.topic);

    const results = [];
    const generatedTopics = [...existingTopics];

    for (let i = 0; i < count; i++) {
      let retries = 0;
      const maxRetries = 2;
      
      while (retries <= maxRetries) {
        try {
          // Generate unique topic
          const recentTopics = generatedTopics.slice(-20).join(', ');
          const topicPrompt = `Kamu adalah content strategist. Generate 1 topik unik untuk konten Threads dengan tema: "${theme}".
${themeDescription ? 'Deskripsi: ' + themeDescription : ''}
${recentTopics ? 'TOPIK YANG SUDAH DIPAKAI (JANGAN ULANGI): ' + recentTopics : ''}
Output HANYA topik saja (1 kalimat singkat), tanpa numbering atau penjelasan.`;

          const topic = (await GeminiService.callGemini(topicPrompt))
            .replace(/^[\d\.\-\*\s]+/, '').replace(/["']/g, '').trim();

          if (!topic) {
            throw new Error('Topic generation failed');
          }

          // Generate content with retry
          const content = await GeminiService.generatePostContent(topic, commentCount);

          // Save to queue
          db.prepare(`
            INSERT INTO content_queue (account_id, topic, content_main, content_comments, comment_count)
            VALUES (?, ?, ?, ?, ?)
          `).run(accountId, topic, content.main_post, JSON.stringify(content.comments), content.comments.length);

          generatedTopics.push(topic);
          results.push({ topic, success: true });
          console.log(`[Queue] Generated ${i + 1}/${count} for @${account.username}: "${topic}"`);

          // Small delay between API calls
          await new Promise(r => setTimeout(r, 3000));
          break; // Success, exit retry loop
          
        } catch (error) {
          retries++;
          console.error(`[Queue] Error generating ${i + 1}/${count} (attempt ${retries}):`, error.message);
          
          if (retries > maxRetries) {
            results.push({ topic: null, success: false, error: error.message });
            break;
          }
          
          // Wait before retry
          await new Promise(r => setTimeout(r, 5000));
        }
      }
    }

    return results;
  }

  /**
   * Get next queued content for an account (FIFO)
   */
  static getNextQueued(accountId) {
    return db.prepare(
      "SELECT * FROM content_queue WHERE account_id = ? AND status = 'queued' ORDER BY created_at ASC LIMIT 1"
    ).get(accountId);
  }

  /**
   * Mark queue item as used
   */
  static markUsed(queueId) {
    db.prepare("UPDATE content_queue SET status = 'used', used_at = datetime('now') WHERE id = ?")
      .run(queueId);
  }

  /**
   * Get all queued items with account info (only queued, used items auto-deleted)
   */
  static getAllQueues() {
    // Auto-delete used items to keep database light
    db.prepare("DELETE FROM content_queue WHERE status = 'used'").run();
    
    return db.prepare(`
      SELECT cq.*, a.username
      FROM content_queue cq
      JOIN accounts a ON a.id = cq.account_id
      WHERE cq.status = 'queued'
      ORDER BY cq.created_at ASC
    `).all();
  }

  /**
   * Update queue item content
   */
  static updateItem(id, contentMain, contentComments) {
    db.prepare('UPDATE content_queue SET content_main = ?, content_comments = ? WHERE id = ?')
      .run(contentMain, contentComments, id);
  }

  /**
   * Delete a queue item
   */
  static deleteItem(id) {
    db.prepare('DELETE FROM content_queue WHERE id = ?').run(id);
  }

  /**
   * Clear used items
   */
  static cleanup(accountId) {
    const result = db.prepare("DELETE FROM content_queue WHERE account_id = ? AND status IN ('used', 'discarded')").run(accountId);
    return result.changes;
  }
}

module.exports = ContentQueueService;
