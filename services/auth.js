const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Database, Cache } = require('../config/database');

class AuthService {
  // Register new user
  static async register(email, password, name) {
    // Check if user exists
    const existingUser = await Database.get(
      'SELECT id FROM users WHERE email = $1',
      [email.toLowerCase()]
    );
    
    if (existingUser) {
      throw new Error('Email sudah terdaftar');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create user
    const result = await Database.query(
      `INSERT INTO users (email, password_hash, name, plan, status) 
       VALUES ($1, $2, $3, 'starter', 'active') 
       RETURNING id, email, name, plan, status, created_at`,
      [email.toLowerCase(), passwordHash, name]
    );

    const user = result.rows[0];

    // Create default settings
    await this.createDefaultSettings(user.id);

    // Create subscription record
    await Database.query(
      `INSERT INTO subscriptions (user_id, plan, status, current_period_start, current_period_end)
       VALUES ($1, 'starter', 'trial', NOW(), NOW() + INTERVAL '7 days')`,
      [user.id]
    );

    return user;
  }

  // Login user
  static async login(email, password) {
    const user = await Database.get(
      'SELECT id, email, password_hash, name, plan, status FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (!user) {
      throw new Error('Email atau password salah');
    }

    if (user.status !== 'active') {
      throw new Error('Akun tidak aktif');
    }

    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      throw new Error('Email atau password salah');
    }

    // Update last login
    await Database.query(
      'UPDATE users SET updated_at = NOW() WHERE id = $1',
      [user.id]
    );

    // Remove password from response
    delete user.password_hash;
    return user;
  }

  // Get user by ID with subscription info
  static async getUserById(userId) {
    try {
      // Very simple query for debugging
      const user = await Database.get(`
        SELECT id, email, name, plan, status
        FROM users
        WHERE id = $1
      `, [userId]);

      if (!user) return null;

      // Add default values
      user.max_accounts = 3;
      user.max_posts_per_month = 500;
      user.max_queue_items = 50;
      user.features = { affiliate: true, analytics: false, auto_reply: true };
      user.usage = { posts_used: 0, accounts_used: 0 };

      return user;
    } catch (error) {
      console.error('getUserById error:', error);
      return null;
    }
  }

  // Create default settings for new user
  static async createDefaultSettings(userId) {
    const defaultSettings = [
      ['gemini_api_key', ''],
      ['gemini_model', 'gemini-2.5-flash'],
      ['default_comment_count', '3'],
      ['post_delay_seconds', '30'],
      ['prompt_organic', ''],
      ['prompt_affiliate', ''],
      ['prompt_reply', '']
    ];

    for (const [key, value] of defaultSettings) {
      await Database.query(
        'INSERT INTO user_settings (user_id, key, value) VALUES ($1, $2, $3)',
        [userId, key, value]
      );
    }
  }

  // Check if user can perform action based on plan limits
  static async checkLimit(userId, action) {
    const user = await this.getUserById(userId);
    if (!user) return false;

    const currentMonth = new Date().toISOString().slice(0, 7) + '-01';
    
    switch (action) {
      case 'add_account':
        const accountCount = await Database.get(
          'SELECT COUNT(*) as count FROM user_accounts WHERE user_id = $1',
          [userId]
        );
        return accountCount.count < user.max_accounts;

      case 'create_post':
        const postCount = await Database.get(
          'SELECT COALESCE(SUM(value), 0) as count FROM usage_tracking WHERE user_id = $1 AND metric = $2 AND period_start >= $3',
          [userId, 'posts', currentMonth]
        );
        return postCount.count < user.max_posts_per_month;

      case 'add_queue_item':
        const queueCount = await Database.get(
          'SELECT COUNT(*) as count FROM user_content_queue WHERE user_id = $1 AND status = $2',
          [userId, 'queued']
        );
        return queueCount.count < user.max_queue_items;

      default:
        return true;
    }
  }

  // Track usage
  static async trackUsage(userId, metric, value = 1) {
    const currentMonth = new Date().toISOString().slice(0, 7) + '-01';
    const nextMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toISOString().slice(0, 10);

    await Database.query(`
      INSERT INTO usage_tracking (user_id, metric, value, period_start, period_end)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (user_id, metric, period_start)
      DO UPDATE SET value = usage_tracking.value + $3
    `, [userId, metric, value, currentMonth, nextMonth]);
  }

  // Generate JWT token
  static generateToken(user) {
    return jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET || 'threadsbot-saas-jwt-secret',
      { expiresIn: '7d' }
    );
  }

  // Verify JWT token
  static verifyToken(token) {
    try {
      return jwt.verify(token, process.env.JWT_SECRET || 'threadsbot-saas-jwt-secret');
    } catch (error) {
      return null;
    }
  }
}

module.exports = AuthService;
