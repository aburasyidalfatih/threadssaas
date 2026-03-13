# ThreadsBot SaaS 🤖

Multi-tenant SaaS version of ThreadsBot - AI-powered automation platform for Meta Threads with subscription-based access.

## 🌟 Features

### Core Functionality
- **Multi-User Authentication** - Secure login/register system with session management
- **Dashboard** - Comprehensive stats and quick actions
- **Account Management** - Manage multiple Threads accounts with plan-based limits
- **Content Creation** - AI-powered post generation with Gemini
- **Content Queue** - Bulk content generation and scheduling
- **Auto Pilot** - Automated posting with custom schedules
- **Product Management** - Affiliate product promotion system
- **Post History** - Complete posting history with status tracking
- **Settings** - Customizable AI prompts and API configurations

### SaaS Features
- **Multi-Tenant Architecture** - Complete user isolation
- **Subscription Plans** - Starter, Pro, and Agency tiers
- **Usage Tracking** - Real-time monitoring of account and post limits
- **Plan Limits** - Automatic enforcement based on subscription
- **User Profiles** - Individual user settings and preferences

## 🚀 Tech Stack

- **Backend**: Node.js + Express.js
- **Database**: PostgreSQL (multi-tenant) + Redis (sessions)
- **Templates**: Handlebars
- **Authentication**: bcrypt + session-based auth
- **AI**: Google Gemini API
- **API**: Meta Threads API

## 📦 Installation

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- Redis 6+

### Setup

```bash
# Clone repository
git clone https://github.com/aburasyidalfatih/threadssaas.git
cd threadssaas

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your credentials

# Setup database
psql -U postgres -d postgres -f database/schema.sql

# Start application
npm start
```

## 🔧 Configuration

### Environment Variables

```env
# Server
PORT=5009
NODE_ENV=production

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=postgres
DB_USER=postgres
DB_PASSWORD=your_password

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Session
SESSION_SECRET=your_secret_key

# API Keys (optional - can be set per user in settings)
GEMINI_API_KEY=your_gemini_key
THREADS_APP_ID=your_threads_app_id
THREADS_APP_SECRET=your_threads_app_secret
```

## 📊 Database Schema

Multi-tenant architecture with user isolation:

- `users` - User accounts and subscription info
- `user_accounts` - Threads accounts per user
- `user_posts` - Posts history per user
- `user_products` - Affiliate products per user
- `user_settings` - User-specific settings
- `autopilot_configs` - Autopilot configurations
- `subscriptions` - Subscription management
- `plan_limits` - Plan-based limits

## 🎯 Subscription Plans

### Starter ($29/month)
- 3 Threads accounts
- 500 posts/month
- 50 queue items
- Basic features

### Pro ($79/month)
- 10 Threads accounts
- 2,000 posts/month
- 200 queue items
- Priority support
- Analytics

### Agency ($199/month)
- 50 Threads accounts
- 10,000 posts/month
- 1,000 queue items
- White label
- Priority support
- Advanced analytics

## 🔐 Security

- Password hashing with bcrypt
- Session-based authentication
- Redis session storage
- User data isolation
- SQL injection prevention
- XSS protection

## 📱 API Endpoints

### Authentication
- `POST /register` - User registration
- `POST /login` - User login
- `GET /logout` - User logout

### Dashboard
- `GET /` - Main dashboard

### Accounts
- `GET /accounts` - List user accounts
- `POST /accounts/add` - Add new account
- `DELETE /accounts/:id` - Delete account

### Posts
- `GET /posts/create` - Create post page
- `POST /posts/create` - Create new post
- `GET /posts/queue` - Queue management
- `GET /posts/history` - Post history

### Autopilot
- `GET /autopilot` - Autopilot configuration
- `POST /autopilot/save` - Save configuration
- `POST /autopilot/toggle/:id` - Toggle autopilot

### Settings
- `GET /settings` - Settings page
- `POST /settings/save` - Save settings

## 🚀 Deployment

### Production Setup

```bash
# Install PM2
npm install -g pm2

# Start with PM2
pm2 start server.js --name threadssaas

# Save PM2 configuration
pm2 save
pm2 startup
```

### Nginx Configuration

```nginx
server {
    listen 80;
    server_name threadssaas.kelasmaster.id;

    location / {
        proxy_pass http://localhost:5009;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## 📝 Development

### Project Structure

```
threadssaas/
├── config/          # Database and configuration
├── middleware/      # Authentication middleware
├── routes/          # Express routes
├── services/        # Business logic
├── views/           # Handlebars templates
├── public/          # Static assets
├── database/        # Database schemas
└── server.js        # Main application
```

### Development Mode

```bash
# Start with nodemon
npm run dev

# Run tests
npm test
```

## 🤝 Contributing

This is a private SaaS application. For feature requests or bug reports, please contact the maintainer.

## 📄 License

Proprietary - All rights reserved

## 🔗 Links

- **Production**: https://threadssaas.kelasmaster.id
- **Documentation**: See `/docs` folder
- **Support**: Contact via Telegram

## 📊 Status

- ✅ Authentication System
- ✅ Multi-User Support
- ✅ Dashboard & Stats
- ✅ Account Management
- ✅ Content Creation
- ✅ Queue System
- ✅ Autopilot
- ✅ Product Management
- ✅ Settings Page
- ⏳ Billing Integration (Coming Soon)
- ⏳ Real AI Integration (Coming Soon)
- ⏳ Email Notifications (Coming Soon)

## 🆕 Recent Updates

### v2.0.0 (2026-03-13)
- Complete SaaS implementation
- Multi-user authentication
- Settings page with API management
- Fixed autopilot functionality
- Clean layout architecture
- Multi-tenant database structure
- All core features operational

---

**Built with ❤️ for content creators and automation enthusiasts**
