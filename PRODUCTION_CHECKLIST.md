# ThreadsBot Production Checklist

## ✅ Deployment Status

### Infrastructure
- ✅ Port 5008 (tidak conflict dengan aplikasi lain)
- ✅ Nginx reverse proxy configured
- ✅ SSL/HTTPS enabled (Let's Encrypt, expires 2026-06-09)
- ✅ Supervisor auto-restart configured
- ✅ Database backup script (daily 2 AM)
- ✅ Log rotation configured (daily, keep 7 days)

### Application
- ✅ Node.js dependencies installed
- ✅ SQLite database initialized
- ✅ Scheduler built-in (no external cronjob needed)
- ✅ Error handling comprehensive
- ✅ Graceful shutdown implemented

### Monitoring
- ✅ Logs: `/home/ubuntu/threadsbot/dashboard.log`
- ✅ Backups: `/home/ubuntu/threadsbot/backups/`
- ✅ Status: `sudo supervisorctl status threadsbot`

## 📋 REQUIRED BEFORE GOING LIVE

### 1. Configure API Keys
```bash
# Edit .env file
nano /home/ubuntu/threadsbot/.env

# Add:
GEMINI_API_KEY=your_gemini_api_key_here
```

### 2. Setup Meta App
1. Go to https://developers.facebook.com/
2. Create/select your app
3. Add Threads API product
4. Configure OAuth Redirect URI:
   - `https://threadsbot.kelasmaster.id/callback/threads`
5. Get App ID and App Secret
6. Enter credentials in dashboard

### 3. Test Posting
1. Access https://threadsbot.kelasmaster.id
2. Login with Meta account
3. Create test post
4. Verify it posts to Threads

### 4. Monitor First 24 Hours
```bash
# Watch logs in real-time
tail -f /home/ubuntu/threadsbot/dashboard.log

# Check process status
sudo supervisorctl status threadsbot

# Check disk usage
df -h /home/ubuntu/threadsbot/

# Check memory
ps aux | grep threadsbot
```

## 🔄 Scheduled Tasks

### Automatic (Built-in)
- **Every 5 min**: Auto-reply monitor
- **Every 10 min**: Content queue worker
- **Every 30 min**: AutoPilot generator
- **Daily 3 AM**: Token refresh

### Cron Jobs
- **Daily 2 AM**: Database backup (keep 7 days)
- **Daily**: Log rotation (keep 7 days)

## 🚨 Troubleshooting

### Application not responding
```bash
sudo supervisorctl restart threadsbot
tail -f /home/ubuntu/threadsbot/dashboard.log
```

### Database issues
```bash
# Check database integrity
sqlite3 /home/ubuntu/threadsbot/data/threadsbot.db "PRAGMA integrity_check;"

# Restore from backup
cp /home/ubuntu/threadsbot/backups/threadsbot_YYYYMMDD_HHMMSS.db \
   /home/ubuntu/threadsbot/data/threadsbot.db
sudo supervisorctl restart threadsbot
```

### Nginx issues
```bash
sudo nginx -t
sudo systemctl restart nginx
```

## 📊 Performance Baseline

- **Disk Usage**: ~21MB (app) + SQLite database
- **Memory**: ~100-150MB typical
- **CPU**: Low (mostly idle, spikes during posting)
- **Database**: SQLite with WAL mode (optimized)

## 🔐 Security Notes

- ✅ HTTPS enabled
- ✅ Environment variables for secrets
- ✅ No hardcoded credentials
- ✅ Database foreign keys enabled
- ✅ Input validation in routes

## 📞 Support

For issues:
1. Check logs: `tail -f /home/ubuntu/threadsbot/dashboard.log`
2. Check status: `sudo supervisorctl status threadsbot`
3. Review error_log in database for failed posts

---

**Last Updated**: 2026-03-11
**Status**: ✅ READY FOR PRODUCTION
