# ThreadsBot - Production Documentation

**Last Updated**: 2026-03-11 21:50
**Status**: ✅ PRODUCTION READY

## 📋 Overview

ThreadsBot adalah aplikasi otomasi cerdas untuk platform Meta Threads dengan fitur:
- **Auto Pilot**: Generate konten otomatis dengan Gemini AI
- **Auto Reply**: Balas komentar secara otomatis
- **Multi-Account**: Kelola 3+ akun Threads bersamaan
- **Concurrent Processing**: Generate konten untuk multiple akun secara bersamaan

## 🎯 Current Configuration

### Accounts (3 Active)
```
1. putra_chaniago001
   - Theme: Produktivitas & Self-Improvement
   - Schedule: 08:00, 12:00, 16:00, 20:00 (4x daily)
   - Comments: 5 per post
   - Auto Reply: ENABLED (friendly style, 5 min interval)

2. curhat_parenting
   - Theme: Parenting
   - Schedule: 08:00, 12:00, 16:00, 20:00 (4x daily)
   - Comments: 5 per post
   - Auto Reply: ENABLED (friendly style, 5 min interval)

3. bekalpernikahan.id
   - Theme: Solusi Pernikahan
   - Schedule: 08:00, 12:00, 16:00, 20:00 (4x daily)
   - Comments: 5 per post
   - Auto Reply: ENABLED (friendly style, 5 min interval)
```

### Service Details
- **URL**: https://threadsbot.kelasmaster.id
- **Port**: 5008
- **Database**: SQLite (threadsbot.db)
- **Manager**: Supervisor
- **Model**: gemini-2.5-pro
- **API Key**: Stored in database settings

## 🚀 How It Works

### 1. Auto-Generate (AutoPilot)
```
Schedule Check (every 30 min)
    ↓
Check if current hour matches posting_hours
    ↓
Generate content with Gemini AI
    ↓
Create main post + 5 comments
    ↓
Queue for posting
    ↓
Scheduler posts to Threads (concurrent for all accounts)
```

### 2. Auto-Reply
```
Monitor (every 5 min)
    ↓
Check for new comments on posts
    ↓
Generate reply with Gemini AI
    ↓
Post reply with friendly style
```

### 3. Concurrent Processing
- All 3 accounts process simultaneously using Promise.all()
- No sequential delays between accounts
- Faster content generation

## 📊 Database Schema

### Key Tables
- **accounts**: Threads account credentials
- **autopilot_configs**: Schedule & theme settings
- **auto_reply_config**: Reply settings & style
- **posts**: Post history & tracking
- **settings**: Global settings (API keys, model, prompts)

### Important Settings
```sql
-- Check current settings
SELECT key, value FROM settings;

-- Key settings:
- gemini_api_key: Gemini API key
- gemini_model: gemini-2.5-pro
- prompt_organic: Default prompt template
```

## 🔧 Configuration Management

### Change Comment Count
```bash
# Update for specific account
sqlite3 data/threadsbot.db "UPDATE autopilot_configs SET comment_count = 5 WHERE account_id = 2;"

# Verify
sqlite3 data/threadsbot.db "SELECT username, comment_count FROM accounts a JOIN autopilot_configs ac ON a.id = ac.account_id;"
```

### Change Posting Schedule
```bash
# Update posting hours (format: "08,12,16,20")
sqlite3 data/threadsbot.db "UPDATE autopilot_configs SET posting_hours = '08,12,16,20' WHERE account_id = 2;"
```

### Enable/Disable Auto Reply
```bash
# Enable
sqlite3 data/threadsbot.db "UPDATE auto_reply_config SET is_enabled = 1 WHERE account_id = 2;"

# Disable
sqlite3 data/threadsbot.db "UPDATE auto_reply_config SET is_enabled = 0 WHERE account_id = 2;"
```

## 📝 Prompt System

### Default Prompt Template
Located in: `settings.prompt_organic`

**Features**:
- Dynamic comment count support (1-5)
- Placeholders: `{topic}`, `{theme_description}`, `{comment_count}`
- Optimized for viral engagement
- Casual, conversational tone

**Sections**:
1. Main Post (hook + knowledge gap)
2. Comment 1-5 (context, value, CTA, deep dive, closing)

### Custom Prompt
Can be set via dashboard settings menu. Supports same placeholders.

## 🔄 Scheduler Jobs

### Running Jobs
1. **AutoPilot Monitor** (every 30 min)
   - Check posting schedule
   - Generate content
   - Queue posts

2. **Auto-Reply Monitor** (every 5 min)
   - Check for new comments
   - Generate replies
   - Post replies

3. **Queue Worker** (every 10 min)
   - Process pending posts
   - Post to Threads

4. **Token Refresh** (daily 3 AM)
   - Refresh Threads access tokens

## 📊 Monitoring

### Check Service Status
```bash
sudo supervisorctl status threadsbot
```

### View Logs
```bash
# Real-time logs
tail -f /home/ubuntu/threadsbot/dashboard.log

# Search for errors
tail -100 /home/ubuntu/threadsbot/dashboard.log | grep -i error

# Check recent posts
tail -50 /home/ubuntu/threadsbot/dashboard.log | grep "Post created"
```

### Database Queries
```bash
# Recent posts
sqlite3 data/threadsbot.db "SELECT a.username, p.posted_at, p.comment_count, p.status FROM posts p JOIN accounts a ON p.account_id = a.id ORDER BY p.id DESC LIMIT 10;"

# Posts today
sqlite3 data/threadsbot.db "SELECT a.username, COUNT(*) FROM posts p JOIN accounts a ON p.account_id = a.id WHERE DATE(p.posted_at) = DATE('now') GROUP BY a.username;"

# Success rate
sqlite3 data/threadsbot.db "SELECT status, COUNT(*) FROM posts GROUP BY status;"
```

## 🚨 Troubleshooting

### Posts Not Generating
1. Check service: `sudo supervisorctl status threadsbot`
2. Check logs: `tail -f dashboard.log`
3. Verify schedule: `sqlite3 data/threadsbot.db "SELECT posting_hours FROM autopilot_configs;"`
4. Check Gemini API: Verify API key in settings

### Auto Reply Not Working
1. Check if enabled: `sqlite3 data/threadsbot.db "SELECT is_enabled FROM auto_reply_config;"`
2. Check logs for errors
3. Verify Threads tokens are valid

### Gemini Response Truncated
- Current issue: Prompt too complex for some comment counts
- Workaround: Keep default 5 comments
- Solution: Split generation (main post + comments separately)

## 🔐 Security

- API keys stored in database (encrypted recommended)
- Threads tokens stored securely
- .env file contains SESSION_SECRET
- Database file permissions: user-only access

## 📈 Performance

### Current Metrics
- **Concurrent Accounts**: 3 (simultaneous)
- **Posts per Day**: 12 (4 per account)
- **Comments per Post**: 5
- **Auto Reply Check**: Every 5 minutes
- **Success Rate**: 96.2%

### Optimization Done
1. ✅ Increased maxOutputTokens: 2048 → 8192
2. ✅ Enabled concurrent processing (Promise.all)
3. ✅ Added fallback for partial responses
4. ✅ Dynamic prompt based on comment count

## 🔄 Recent Fixes (2026-03-11)

1. **Fixed Gemini API Key**: Added to .env
2. **Fixed Schedule Logic**: Corrected AND/OR logic in GoldGen
3. **Enabled Concurrent Processing**: All accounts post simultaneously
4. **Added Fallback Comments**: Handle partial Gemini responses
5. **Dynamic Comment Count**: Prompt adjusts based on setting
6. **Updated Prompt Template**: Support 1-5 comments

## 📋 Maintenance Checklist

### Daily
- [ ] Check service status
- [ ] Monitor logs for errors
- [ ] Verify posts are being generated

### Weekly
- [ ] Review post success rate
- [ ] Check Threads token expiry
- [ ] Monitor disk space

### Monthly
- [ ] Update dependencies
- [ ] Review and optimize prompts
- [ ] Backup database
- [ ] Check API quotas

## 🎯 Next Steps / Future Improvements

1. **Split Generation**: Separate main post + comments generation
2. **Advanced Scheduling**: Custom hours per account
3. **Content Queue**: Pre-generate content queue
4. **Analytics Dashboard**: Engagement metrics
5. **A/B Testing**: Test different prompts/styles
6. **Multi-language**: Support other languages

## 📞 Quick Reference

### Start/Stop Service
```bash
sudo supervisorctl start threadsbot
sudo supervisorctl stop threadsbot
sudo supervisorctl restart threadsbot
```

### View Configuration
```bash
# All settings
sqlite3 data/threadsbot.db "SELECT * FROM settings;"

# Account config
sqlite3 data/threadsbot.db "SELECT * FROM autopilot_configs;"

# Auto reply config
sqlite3 data/threadsbot.db "SELECT * FROM auto_reply_config;"
```

### Manual Trigger
```bash
# Trigger posting for account ID 2
curl -X POST http://localhost:5008/autopilot/trigger/2
```

## 📚 Related Documentation

- **DEPLOYMENT_GUIDE.md**: Full deployment instructions
- **QUICK_REFERENCE.md**: Quick commands reference
- **BUG_FIX_SCHEDULE_20260311.md**: GoldGen schedule fix
- **AUDIT_REPORT_20260311.md**: GoldGen audit report

---

**Version**: 2.0
**Last Verified**: 2026-03-11 21:50
**Status**: ✅ Production Ready
