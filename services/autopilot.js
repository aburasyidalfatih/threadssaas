const db = require('../config/database');
const GeminiService = require('./gemini');
const ContentQueueService = require('./content-queue');

class AutoPilotService {
  /**
   * Check all enabled autopilot configs and generate+post content as needed
   */
  static async runAutoPilot() {
    const configs = db.prepare(`
      SELECT ap.*, a.username, a.threads_user_id, a.access_token
      FROM autopilot_configs ap
      JOIN accounts a ON a.id = ap.account_id
      WHERE ap.is_enabled = 1 AND a.is_active = 1 AND a.access_token IS NOT NULL
    `).all();

    // Process all accounts concurrently
    await Promise.all(configs.map(config => 
      this.processAccount(config).catch(error => {
        console.error(`[AutoPilot] Error processing @${config.username}:`, error.message);
      })
    ));
  }

  /**
   * Process a single account: check if current hour is in posting_hours
   * posting_hours format: "00,02,04,14,22"
   */
  static async processAccount(config) {
    const now = new Date();
    const currentHour = now.getHours();

    // Parse posting hours
    const postingHours = this.parsePostingHours(config.posting_hours);
    
    // Check if current hour matches any posting hour
    if (!postingHours.includes(currentHour)) {
      return;
    }

    // Check if already posted in this hour slot
    const hourStart = new Date(now);
    hourStart.setMinutes(0, 0, 0);
    const hourEnd = new Date(now);
    hourEnd.setMinutes(59, 59, 999);

    const postedThisHour = db.prepare(`
      SELECT COUNT(*) as count FROM posts 
      WHERE account_id = ? AND type = 'autopilot' 
      AND created_at >= ? AND created_at <= ?
    `).get(config.account_id, hourStart.toISOString(), hourEnd.toISOString()).count;

    if (postedThisHour > 0) {
      return; // Already posted in this hour slot
    }

    // Pure AutoPilot: generate in real-time
    const topic = await this.generateUniqueTopic(config);
    if (!topic) {
      console.error(`[AutoPilot] Failed to generate topic for @${config.username}`);
      return;
    }

    console.log(`[AutoPilot] Generating real-time for @${config.username} | Topic: ${topic}`);
    
    // Pass theme_description to add personality variation
    const content = await GeminiService.generatePostContent(
      topic, 
      config.comment_count,
      config.theme_description || ''
    );
    const contentMain = content.main_post;
    const contentComments = JSON.stringify(content.comments);

    // Save as post
    const result = db.prepare(`
      INSERT INTO posts (account_id, type, topic, content_main, content_comments, comment_count, status)
      VALUES (?, 'autopilot', ?, ?, ?, ?, 'scheduled')
    `).run(
      config.account_id,
      topic,
      contentMain,
      contentComments,
      JSON.parse(contentComments).length
    );

    // Execute posting immediately (require here to avoid circular dependency)
    const SchedulerService = require('./scheduler');
    setTimeout(() => {
      try {
        SchedulerService.executePost(result.lastInsertRowid);
      } catch (err) {
        console.error('[AutoPilot] Execute post error:', err.message);
      }
    }, 100);

    // Update last_posted_at and topics_history
    let topicsHistory = [];
    try { topicsHistory = JSON.parse(config.topics_history || '[]'); } catch(e) {}
    topicsHistory.push(topic);
    if (topicsHistory.length > 50) topicsHistory = topicsHistory.slice(-50);

    db.prepare(`
      UPDATE autopilot_configs 
      SET last_posted_at = datetime('now'), topics_history = ?
      WHERE id = ?
    `).run(JSON.stringify(topicsHistory), config.id);

    // Count today's posts
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const postsToday = db.prepare(`
      SELECT COUNT(*) as count FROM posts 
      WHERE account_id = ? AND type = 'autopilot' AND created_at >= ?
    `).get(config.account_id, todayStart.toISOString()).count;

    console.log(`[AutoPilot] Post created for @${config.username}: "${topic}" (${postsToday}/${postingHours.length} today)`);
  }

  /**
   * Parse posting_hours string into array of integers
   * Input: "00,02,04,14,22" → Output: [0, 2, 4, 14, 22]
   */
  static parsePostingHours(hoursStr) {
    if (!hoursStr) return [8, 12, 16, 20];
    return hoursStr
      .split(',')
      .map(h => parseInt(h.trim(), 10))
      .filter(h => !isNaN(h) && h >= 0 && h <= 23)
      .sort((a, b) => a - b);
  }

  /**
   * Generate a unique topic using Gemini based on account theme
   */
  static async generateUniqueTopic(config) {
    let topicsHistory = [];
    try { topicsHistory = JSON.parse(config.topics_history || '[]'); } catch(e) {}

    const recentTopics = topicsHistory.slice(-15).map(t => `- ${t}`).join('\n');

    const prompt = `Kamu adalah content strategist untuk akun Threads.

Tema akun: "${config.theme}"
${config.theme_description ? `Deskripsi tema: "${config.theme_description}"` : ''}

${recentTopics ? `Topik yang SUDAH pernah dibahas (JANGAN ulangi):\n${recentTopics}\n` : ''}

Buatkan 1 topik BARU yang menarik dan belum pernah dibahas untuk postingan Threads berikutnya.
Topik harus:
- Relevan dengan tema "${config.theme}"
- Spesifik dan menarik (bukan terlalu umum)
- Mengundang diskusi dan engagement
- Berbeda dari topik yang sudah pernah dibahas
- Unik dan fresh (hindari topik mainstream yang sering dibahas)

VARIASI ANGLE: Gunakan salah satu angle ini untuk membuat topik lebih unik:
- Controversial take (pendapat yang berlawanan dengan mainstream)
- Personal story angle (pengalaman spesifik yang relatable)
- Data-driven angle (fakta atau statistik mengejutkan)
- Myth-busting angle (membongkar mitos yang salah)
- Behind-the-scenes angle (hal yang jarang diketahui orang)

Output HANYA topik dalam 1 kalimat pendek, tanpa tanda kutip atau penjelasan tambahan.`;

    const result = await GeminiService.callGemini(prompt);
    return result.replace(/^["']|["']$/g, '').trim();
  }

  /**
   * Get all autopilot configs with account info
   */
  static getConfigs() {
    return db.prepare(`
      SELECT ap.*, a.username, a.access_token IS NOT NULL as is_connected,
        (SELECT COUNT(*) FROM posts WHERE account_id = ap.account_id AND type = 'autopilot') as total_posts,
        (SELECT COUNT(*) FROM posts WHERE account_id = ap.account_id AND type = 'autopilot' AND created_at >= date('now')) as posts_today
      FROM autopilot_configs ap
      JOIN accounts a ON a.id = ap.account_id
      ORDER BY ap.created_at DESC
    `).all();
  }

  /**
   * Save or update autopilot config
   */
  static saveConfig(accountId, data) {
    // Validate and clean posting_hours
    const hours = this.parsePostingHours(data.posting_hours);
    const postingHours = hours.map(h => String(h).padStart(2, '0')).join(',');

    db.prepare(`
      INSERT INTO autopilot_configs (account_id, is_enabled, theme, theme_description, posting_hours, comment_count)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(account_id) DO UPDATE SET
        is_enabled = ?,
        theme = ?,
        theme_description = ?,
        posting_hours = ?,
        comment_count = ?
    `).run(
      accountId,
      data.is_enabled ? 1 : 0,
      data.theme,
      data.theme_description || '',
      postingHours,
      parseInt(data.comment_count || '3', 10),
      // ON CONFLICT values:
      data.is_enabled ? 1 : 0,
      data.theme,
      data.theme_description || '',
      postingHours,
      parseInt(data.comment_count || '3', 10)
    );
  }

  /**
   * Delete autopilot config
   */
  static deleteConfig(accountId) {
    db.prepare('DELETE FROM autopilot_configs WHERE account_id = ?').run(accountId);
  }

  /**
   * Reset topic history for an account
   */
  static resetHistory(accountId) {
    try {
      db.prepare("UPDATE autopilot_configs SET topics_history = '[]' WHERE account_id = ?")
        .run(accountId);
      console.log(`[AutoPilot] Topics history reset for account ${accountId}`);
    } catch (error) {
      console.error(`[AutoPilot] Reset history error for account ${accountId}:`, error.message);
      throw error;
    }
  }
}

module.exports = AutoPilotService;
