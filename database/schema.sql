-- ThreadsBot SaaS Database Schema
-- Multi-tenant architecture with user isolation

-- Users table (SaaS customers)
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    plan VARCHAR(50) DEFAULT 'starter',
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Subscription plans and billing
CREATE TABLE subscriptions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    plan VARCHAR(50) NOT NULL,
    status VARCHAR(50) DEFAULT 'active',
    current_period_start TIMESTAMP,
    current_period_end TIMESTAMP,
    stripe_subscription_id VARCHAR(255),
    stripe_customer_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Usage limits per plan
CREATE TABLE plan_limits (
    plan VARCHAR(50) PRIMARY KEY,
    max_accounts INTEGER NOT NULL,
    max_posts_per_month INTEGER NOT NULL,
    max_queue_items INTEGER NOT NULL,
    price_monthly DECIMAL(10,2) NOT NULL,
    features JSONB DEFAULT '{}'
);

-- Insert default plans
INSERT INTO plan_limits (plan, max_accounts, max_posts_per_month, max_queue_items, price_monthly, features) VALUES
('starter', 3, 500, 50, 29.00, '{"auto_reply": true, "affiliate": true, "analytics": false}'),
('pro', 10, 2000, 200, 79.00, '{"auto_reply": true, "affiliate": true, "analytics": true, "priority_support": true}'),
('agency', 50, 10000, 1000, 199.00, '{"auto_reply": true, "affiliate": true, "analytics": true, "priority_support": true, "white_label": true}');

-- User accounts (Threads accounts per user)
CREATE TABLE user_accounts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    username VARCHAR(255) NOT NULL,
    threads_user_id VARCHAR(255),
    access_token TEXT,
    token_expires_at TIMESTAMP,
    app_id VARCHAR(255),
    app_secret VARCHAR(255),
    theme VARCHAR(500),
    theme_description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, username)
);

-- User posts
CREATE TABLE user_posts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    account_id INTEGER REFERENCES user_accounts(id) ON DELETE CASCADE,
    type VARCHAR(50) DEFAULT 'organic',
    topic VARCHAR(500),
    content_main TEXT,
    content_comments JSONB,
    comment_count INTEGER DEFAULT 3,
    status VARCHAR(50) DEFAULT 'draft',
    scheduled_at TIMESTAMP,
    posted_at TIMESTAMP,
    main_post_thread_id VARCHAR(255),
    error_log TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User settings
CREATE TABLE user_settings (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    key VARCHAR(255) NOT NULL,
    value TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, key)
);

-- Usage tracking
CREATE TABLE usage_tracking (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    metric VARCHAR(100) NOT NULL,
    value INTEGER DEFAULT 1,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, metric, period_start)
);

-- Auto reply config per user account
CREATE TABLE user_auto_reply_config (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    account_id INTEGER REFERENCES user_accounts(id) ON DELETE CASCADE,
    is_enabled BOOLEAN DEFAULT false,
    reply_style VARCHAR(50) DEFAULT 'friendly',
    max_replies_per_check INTEGER DEFAULT 5,
    last_checked_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, account_id)
);

-- Reply logs per user
CREATE TABLE user_reply_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    account_id INTEGER REFERENCES user_accounts(id) ON DELETE CASCADE,
    original_post_id VARCHAR(255),
    original_comment_id VARCHAR(255),
    original_comment_text TEXT,
    original_commenter VARCHAR(255),
    reply_content TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Content queue per user
CREATE TABLE user_content_queue (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    account_id INTEGER REFERENCES user_accounts(id) ON DELETE CASCADE,
    topic VARCHAR(500),
    content_main TEXT,
    content_comments JSONB,
    comment_count INTEGER DEFAULT 3,
    status VARCHAR(50) DEFAULT 'queued',
    used_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Queue config per user account
CREATE TABLE user_queue_config (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    account_id INTEGER REFERENCES user_accounts(id) ON DELETE CASCADE,
    is_enabled BOOLEAN DEFAULT false,
    schedule_hours VARCHAR(255) DEFAULT '9,12,15,18',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, account_id)
);

-- Products per user (for affiliate)
CREATE TABLE user_products (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    product_name VARCHAR(500) NOT NULL,
    description TEXT,
    affiliate_link TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_user_accounts_user_id ON user_accounts(user_id);
CREATE INDEX idx_user_posts_user_id ON user_posts(user_id);
CREATE INDEX idx_user_posts_account_id ON user_posts(account_id);
CREATE INDEX idx_user_posts_status ON user_posts(status);
CREATE INDEX idx_user_posts_scheduled_at ON user_posts(scheduled_at);
CREATE INDEX idx_usage_tracking_user_period ON usage_tracking(user_id, period_start);
CREATE INDEX idx_user_content_queue_user_account ON user_content_queue(user_id, account_id);
CREATE INDEX idx_user_content_queue_status ON user_content_queue(status);
