const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const db = new Database(path.join(DATA_DIR, 'threadsbot.db'));

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    threads_user_id TEXT,
    access_token TEXT,
    token_type TEXT DEFAULT 'long_lived',
    token_expires_at DATETIME,
    app_id TEXT NOT NULL,
    app_secret TEXT NOT NULL,
    redirect_uri TEXT NOT NULL,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL,
    type TEXT NOT NULL DEFAULT 'regular',
    topic TEXT,
    content_main TEXT,
    content_comments TEXT,
    comment_count INTEGER DEFAULT 3,
    main_post_thread_id TEXT,
    status TEXT DEFAULT 'draft',
    scheduled_at DATETIME,
    posted_at DATETIME,
    error_log TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS affiliate_products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_name TEXT NOT NULL,
    description TEXT,
    affiliate_link TEXT NOT NULL,
    category TEXT,
    image_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS auto_reply_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL UNIQUE,
    is_enabled INTEGER DEFAULT 0,
    check_interval_minutes INTEGER DEFAULT 5,
    reply_style TEXT DEFAULT 'friendly',
    max_replies_per_check INTEGER DEFAULT 5,
    last_checked_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS reply_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL,
    original_post_id TEXT,
    original_comment_id TEXT,
    original_comment_text TEXT,
    original_commenter TEXT,
    reply_content TEXT,
    status TEXT DEFAULT 'sent',
    replied_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT UNIQUE NOT NULL,
    value TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS autopilot_configs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL UNIQUE,
    is_enabled INTEGER DEFAULT 0,
    theme TEXT NOT NULL DEFAULT '',
    theme_description TEXT DEFAULT '',
    posting_hours TEXT DEFAULT '08,12,16,20',
    comment_count INTEGER DEFAULT 3,
    last_posted_at DATETIME,
    topics_history TEXT DEFAULT '[]',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS content_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL,
    topic TEXT NOT NULL,
    content_main TEXT NOT NULL,
    content_comments TEXT NOT NULL DEFAULT '[]',
    comment_count INTEGER DEFAULT 3,
    status TEXT DEFAULT 'queued',
    used_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS queue_configs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL UNIQUE,
    is_enabled INTEGER DEFAULT 0,
    schedule_hours TEXT NOT NULL DEFAULT '08,12,16,20',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(account_id) REFERENCES accounts(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Insert default settings if not exist
const insertSetting = db.prepare(
  'INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)'
);
insertSetting.run('gemini_api_key', process.env.GEMINI_API_KEY || '');
insertSetting.run('default_comment_count', '3');
insertSetting.run('post_delay_seconds', '30');
insertSetting.run('auto_reply_style', 'friendly');
insertSetting.run('gemini_model', 'gemini-2.0-flash');
insertSetting.run('threads_app_id', '');
insertSetting.run('threads_app_secret', '');

module.exports = db;
