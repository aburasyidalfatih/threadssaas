# ThreadsBot SaaS - Development Documentation

## 📋 Project Overview

ThreadsBot SaaS adalah versi multi-tenant dari ThreadsBot yang memungkinkan multiple users dengan sistem subscription dan limit berdasarkan plan.

**Repository**: `/home/ubuntu/threadsbot-saas/`  
**Production URL**: https://threadssaas.kelasmaster.id  
**Port**: 5009  

## ✅ Features Completed

### 1. Authentication System
- ✅ **Login/Register** - Dark theme UI dengan validation
- ✅ **Session Management** - Redis-based sessions
- ✅ **User Management** - PostgreSQL user storage
- ✅ **Password Security** - bcrypt hashing

### 2. Dashboard
- ✅ **Main Dashboard** - Stats overview dengan SaaS metrics
- ✅ **Quick Actions** - Create post, manage accounts, autopilot, queue
- ✅ **Usage Statistics** - Plan usage tracking dan limits
- ✅ **Recent Activity** - Latest posts dengan status indicators

### 3. Account Management (/accounts)
- ✅ **Account Stats** - Total, active, inactive, expiring, expired
- ✅ **Add Account Form** - OAuth dan manual token methods
- ✅ **Account List** - Management dengan status badges
- ✅ **Usage Limits** - Plan-based account limits enforcement
- ✅ **CRUD Operations** - Add, delete accounts dengan verification

### 4. Content Creation (/posts/create)
- ✅ **Create Form** - Account selection, topic input, comment count
- ✅ **AI Generation** - Mock AI content generation (ready for real AI)
- ✅ **Live Preview** - Threads-like preview interface
- ✅ **Publishing Options** - Now, queue, schedule options
- ✅ **Usage Tracking** - Posts per month limit enforcement

### 5. Queue Management (/posts/queue)
- ✅ **Queue Stats** - Total queued, used, active accounts
- ✅ **Generate Tab** - Bulk content generation untuk queue
- ✅ **Queue List** - Management dengan preview dan actions
- ✅ **Bulk Operations** - Select all, bulk delete, bulk post
- ✅ **Search & Filter** - Real-time search dan account filtering

### 6. Posts History (/posts/history)
- ✅ **History Table** - Comprehensive posts history dengan pagination
- ✅ **Status Management** - Retry failed posts, delete posts
- ✅ **Detail Modal** - Full content preview dengan comments
- ✅ **Action Buttons** - Retry, view, delete dengan confirmations

### 7. Product Management (/product)
- ✅ **Product Stats** - Total products, variations, active accounts
- ✅ **Add Product Form** - Name, affiliate link, description
- ✅ **Product Cards** - Grid layout dengan management actions
- ✅ **Generate Modal** - AI variation generation dengan progress
- ✅ **CRUD Operations** - Add, delete products

### 8. SaaS Infrastructure
- ✅ **Multi-tenant Database** - User isolation dan data segregation
- ✅ **Plan System** - Starter, Pro, Agency plans dengan limits
- ✅ **Usage Tracking** - Real-time usage monitoring
- ✅ **Limit Enforcement** - Plan-based restrictions
- ✅ **Dark Theme UI** - Consistent design system

### 9. Backend Architecture
- ✅ **PostgreSQL Database** - Multi-tenant schema design
- ✅ **Redis Caching** - Session storage dan caching
- ✅ **Express.js API** - RESTful endpoints
- ✅ **Handlebars Templates** - Server-side rendering
- ✅ **Authentication Middleware** - Route protection

## ❌ Features Not Completed

### 1. Autopilot System (/autopilot)
- ❌ **Route Access Issue** - Halaman tidak bisa diakses (routing conflict)
- ❌ **Configuration Management** - CRUD autopilot configs
- ❌ **Scheduling Engine** - Automated posting berdasarkan jadwal
- ❌ **Topic Management** - Custom topics untuk autopilot

### 2. Settings Page (/settings)
- ❌ **User Settings** - Profile management, preferences
- ❌ **Account Settings** - Theme configuration per account
- ❌ **Notification Settings** - Email/webhook notifications
- ❌ **API Keys Management** - Gemini AI, external services

### 3. Billing System (/billing)
- ❌ **Subscription Management** - Plan upgrades/downgrades
- ❌ **Payment Integration** - Stripe integration
- ❌ **Invoice Management** - Billing history
- ❌ **Usage Alerts** - Limit warnings

### 4. Advanced Features
- ❌ **Real AI Integration** - Gemini AI untuk content generation
- ❌ **Threads API Integration** - Real posting ke Threads
- ❌ **Webhook System** - External integrations
- ❌ **Analytics Dashboard** - Performance metrics
- ❌ **Team Management** - Multi-user accounts
- ❌ **API Documentation** - Public API endpoints

### 5. Production Features
- ❌ **Email System** - Registration confirmation, notifications
- ❌ **Backup System** - Automated database backups
- ❌ **Monitoring** - Application performance monitoring
- ❌ **Error Tracking** - Centralized error logging
- ❌ **Rate Limiting** - API rate limiting
- ❌ **Security Hardening** - CSRF protection, input validation

## 📚 Reference Application Usage

### Original ThreadsBot as Reference
**Location**: `/home/ubuntu/threadsbot/`  
**Purpose**: Single-user ThreadsBot application sebagai referensi untuk SaaS version

### How to Use Original App as Reference

#### 1. **UI/UX Reference**
```bash
# Compare views structure
ls -la ~/threadsbot/views/          # Original EJS templates
ls -la ~/threadsbot-saas/views/     # SaaS Handlebars templates

# Compare specific pages
diff ~/threadsbot/views/accounts.ejs ~/threadsbot-saas/views/accounts/index.hbs
```

#### 2. **CSS Styling Reference**
```bash
# Copy CSS dari aplikasi lama
cp ~/threadsbot/public/css/style.css ~/threadsbot-saas/public/css/
cp ~/threadsbot/public/css/mobile-improvements.css ~/threadsbot-saas/public/css/

# CSS variables yang digunakan:
# --bg-primary, --bg-secondary, --bg-tertiary, --bg-card
# --text-primary, --text-secondary, --accent-primary
```

#### 3. **Database Schema Reference**
```bash
# Check original database structure
sudo -u postgres psql -d postgres -c "\d user_accounts"
sudo -u postgres psql -d postgres -c "\d user_posts"
sudo -u postgres psql -d postgres -c "\d user_products"

# Adapt untuk multi-tenant dengan user_id foreign keys
```

#### 4. **Feature Comparison Checklist**

| Feature | Original App | SaaS Version | Status |
|---------|-------------|--------------|--------|
| Dashboard | ✅ Single user stats | ✅ Multi-tenant + usage | Complete |
| Accounts | ✅ Unlimited accounts | ✅ Plan-based limits | Complete |
| Create Post | ✅ AI generation | ✅ + Usage tracking | Complete |
| Queue | ✅ Bulk operations | ✅ + Search/filter | Complete |
| History | ✅ Table + pagination | ✅ + Modal details | Complete |
| Product | ✅ Affiliate management | ✅ + Variations | Complete |
| Autopilot | ✅ Scheduling system | ❌ Route issues | **Incomplete** |
| Settings | ✅ User preferences | ❌ Not implemented | **Missing** |

#### 5. **Code Migration Patterns**

##### A. EJS to Handlebars Conversion
```javascript
// Original EJS
<% if (user) { %>
  <span>Hello <%= user.name %></span>
<% } %>

// SaaS Handlebars
{{#if user}}
  <span>Hello {{user.name}}</span>
{{/if}}
```

##### B. Single-user to Multi-tenant
```javascript
// Original (single user)
const posts = await Database.all('SELECT * FROM user_posts ORDER BY created_at DESC');

// SaaS (multi-tenant)
const posts = await Database.all(
  'SELECT * FROM user_posts WHERE user_id = $1 ORDER BY created_at DESC',
  [req.session.userId]
);
```

##### C. Add Usage Limits
```javascript
// Original (no limits)
await Database.run('INSERT INTO user_accounts ...');

// SaaS (with limits)
const currentCount = await Database.get('SELECT COUNT(*) FROM user_accounts WHERE user_id = $1');
if (currentCount.count >= user.max_accounts) {
  return res.status(400).json({ error: 'Account limit reached' });
}
```

#### 6. **Reference Workflow**

##### Step 1: Analyze Original Feature
```bash
# 1. Check original view
cat ~/threadsbot/views/feature.ejs

# 2. Check original route
grep -n "feature" ~/threadsbot/server.js

# 3. Check original CSS
grep -A 10 -B 10 "feature" ~/threadsbot/public/css/style.css
```

##### Step 2: Adapt for SaaS
```bash
# 1. Create SaaS route with user verification
# 2. Convert EJS to Handlebars
# 3. Add multi-tenant database queries
# 4. Add usage limits and tracking
# 5. Test with multiple users
```

##### Step 3: Maintain Consistency
```bash
# 1. Keep same UI layout and styling
# 2. Preserve user experience flow
# 3. Add SaaS features without breaking UX
# 4. Test against original for comparison
```

### 7. **Key Differences SaaS vs Original**

#### Database Changes
```sql
-- Original: Single user tables
CREATE TABLE user_accounts (id, username, access_token, ...);

-- SaaS: Multi-tenant with user_id
CREATE TABLE user_accounts (id, user_id, username, access_token, ...);
ALTER TABLE user_accounts ADD FOREIGN KEY (user_id) REFERENCES users(id);
```

#### Authentication Changes
```javascript
// Original: No authentication
app.get('/dashboard', (req, res) => { ... });

// SaaS: Session-based auth
app.get('/dashboard', (req, res) => {
  if (!req.session.userId) return res.redirect('/login');
  // ... rest of code
});
```

#### UI Changes
```handlebars
<!-- Original: No usage info -->
<div class="stats">Total: {{total}}</div>

<!-- SaaS: With usage limits -->
<div class="stats">
  Used: {{used}}/{{limit}}
  <div class="usage-bar">
    <div class="usage-fill" style="width: {{percentage}}%"></div>
  </div>
</div>
```

### 8. **Migration Best Practices**

#### A. Preserve User Experience
- Keep same navigation structure
- Maintain identical styling and colors
- Preserve workflow and button placements
- Keep same terminology and labels

#### B. Add SaaS Features Seamlessly
- Usage bars integrated into existing stats
- Plan indicators in navigation
- Limit warnings in context
- Upgrade prompts when appropriate

#### C. Database Migration Strategy
```sql
-- 1. Backup original data
pg_dump original_db > backup.sql

-- 2. Create multi-tenant schema
CREATE TABLE users (...);
ALTER TABLE existing_tables ADD COLUMN user_id INTEGER;

-- 3. Migrate data with default user
INSERT INTO users (id, email, name) VALUES (1, 'admin@example.com', 'Admin');
UPDATE user_accounts SET user_id = 1;
UPDATE user_posts SET user_id = 1;
```

### 9. **Testing Against Reference**

#### Visual Comparison
```bash
# 1. Screenshot original app pages
# 2. Screenshot SaaS app pages  
# 3. Compare side by side
# 4. Ensure UI consistency
```

#### Functional Testing
```bash
# 1. Test same user flows in both apps
# 2. Verify feature parity
# 3. Check performance comparison
# 4. Validate data integrity
```

#### User Experience Testing
```bash
# 1. Same navigation paths
# 2. Same button behaviors
# 3. Same form validations
# 4. Same error messages
```

## 🏗️ Technical Architecture

### Database Schema
```sql
-- Core Tables
users (id, email, password_hash, name, plan, max_accounts, max_posts_per_month, max_queue_items)
user_accounts (id, user_id, username, threads_user_id, access_token, token_expires_at)
user_posts (id, user_id, account_id, topic, content_main, content_comments, status, created_at)
user_products (id, user_id, product_name, affiliate_link, description, created_at)
autopilot_configs (id, user_id, account_id, is_enabled, posting_hours, topics, max_posts_per_day)
usage_tracking (user_id, metric, value, period_start, created_at)
```

### Route Structure
```
/                    → Dashboard (auth required)
/login               → Authentication
/register            → User registration
/accounts            → Account management
/posts/create        → Content creation
/posts/queue         → Queue management  
/posts/history       → Posts history
/product             → Product management
/autopilot           → Autopilot (NOT WORKING)
/billing             → Billing (NOT IMPLEMENTED)
/settings            → Settings (NOT IMPLEMENTED)
```

### Technology Stack
- **Backend**: Node.js + Express.js
- **Database**: PostgreSQL + Redis
- **Templates**: Handlebars
- **CSS**: Custom dark theme dengan CSS variables
- **Authentication**: bcrypt + JWT sessions
- **Process Management**: Custom auto-restart script

## 🚀 Development Guidelines

### 1. Effective Development Approach

#### A. Incremental Development
```bash
# 1. Start dengan core functionality
# 2. Add one feature at a time
# 3. Test setiap feature sebelum lanjut
# 4. Maintain backward compatibility
```

#### B. Database-First Design
```sql
-- 1. Design schema dulu
-- 2. Create tables dengan proper indexes
-- 3. Add foreign key constraints
-- 4. Test dengan sample data
```

#### C. Route Organization
```javascript
// 1. Specific routes first
app.use('/autopilot', require('./routes/autopilot'));
app.use('/accounts', require('./routes/accounts'));
app.use('/posts', require('./routes/posts'));

// 2. Catch-all routes last
app.use('/', require('./routes/auth'));
app.use('/', require('./routes/dashboard'));
```

### 2. Code Structure Best Practices

#### A. Consistent Error Handling
```javascript
try {
  // Database operations
  const result = await Database.get(query, params);
  res.json({ success: true, data: result });
} catch (error) {
  console.error('Operation error:', error);
  res.status(500).json({ error: 'Operation failed' });
}
```

#### B. User Verification Pattern
```javascript
// Always verify user ownership
const item = await Database.get(
  'SELECT id FROM table WHERE id = $1 AND user_id = $2',
  [itemId, req.session.userId]
);

if (!item) {
  return res.status(404).json({ error: 'Item not found' });
}
```

#### C. Template Consistency
```handlebars
{{#> layouts/main page="page-name"}}
<!-- Page content -->
{{/layouts/main}}
```

### 3. Development Workflow

#### A. Feature Development
1. **Plan** - Define requirements dan database changes
2. **Schema** - Update database schema jika perlu
3. **Backend** - Create routes dan business logic
4. **Frontend** - Create templates dan JavaScript
5. **CSS** - Add styling yang consistent
6. **Test** - Manual testing semua scenarios
7. **Deploy** - Restart server dan verify

#### B. Debugging Process
```bash
# 1. Check server logs
tail -f ~/threadsbot-saas/restart.log

# 2. Check database connections
sudo -u postgres psql -d postgres -c "SELECT NOW();"

# 3. Check route conflicts
curl -I http://localhost:5009/route-name

# 4. Check process status
netstat -tlnp | grep 5009
```

#### C. Database Management
```bash
# Backup before changes
sudo -u postgres pg_dump postgres > backup_$(date +%Y%m%d).sql

# Apply schema changes
sudo -u postgres psql -d postgres -c "ALTER TABLE..."

# Verify changes
sudo -u postgres psql -d postgres -c "\d table_name"
```

## 🔧 Current Issues & Solutions

### 1. Autopilot Route Issue
**Problem**: Route `/autopilot` tidak bisa diakses  
**Root Cause**: Route order conflict atau middleware issue  
**Solution**: 
```javascript
// Move specific routes before catch-all routes
app.use('/autopilot', require('./routes/autopilot'));
// Remove global auth middleware yang redirect semua request
```

### 2. Server Stability
**Problem**: Occasional 502 errors  
**Current Solution**: Auto-restart script  
**Better Solution**: Implement proper error handling dan PM2

### 3. Database Performance
**Problem**: Queries bisa lambat dengan data besar  
**Solution**: Add proper indexes dan query optimization

## 📈 Next Development Priorities

### Phase 1: Core Completion (1-2 weeks)
1. **Fix Autopilot Route** - Resolve routing conflicts
2. **Complete Autopilot Features** - CRUD operations, scheduling
3. **Add Settings Page** - User preferences, API keys
4. **Implement Real AI** - Gemini API integration

### Phase 2: SaaS Features (2-3 weeks)
1. **Billing System** - Stripe integration, plan management
2. **Usage Analytics** - Detailed usage tracking
3. **Email System** - Notifications, confirmations
4. **Team Features** - Multi-user support

### Phase 3: Production Ready (1-2 weeks)
1. **Security Hardening** - Input validation, CSRF protection
2. **Performance Optimization** - Caching, query optimization
3. **Monitoring** - Error tracking, performance metrics
4. **Documentation** - API docs, user guides

## 📝 Development Notes

### Key Learnings
1. **Route Order Matters** - Specific routes harus sebelum catch-all
2. **Database Schema Planning** - Design schema dengan baik dari awal
3. **User Isolation** - Always verify user ownership untuk security
4. **Consistent UI** - Dark theme dengan CSS variables works well
5. **Error Handling** - Proper error handling crucial untuk stability

### Best Practices Established
1. **Template Structure** - Handlebars dengan layouts system
2. **CSS Organization** - Modular CSS dengan variables
3. **Database Patterns** - Consistent query patterns
4. **Authentication Flow** - Session-based dengan Redis
5. **API Design** - RESTful endpoints dengan proper responses

---

**Last Updated**: 2026-03-13  
**Development Status**: ~70% Complete  
**Production Ready**: ~40% Complete  
**Next Milestone**: Fix autopilot route dan complete core features
