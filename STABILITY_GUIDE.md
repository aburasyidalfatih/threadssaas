# ThreadsBot Stability Guide

## ✅ Current Status: STABLE with SQLite

**Database:** SQLite (128KB, 22 posts, 5 accounts)  
**Memory:** ~80MB (2% of 3.8GB)  
**CPU:** 0.1% (very light)  
**Verdict:** PostgreSQL NOT needed

---

## 📊 Why SQLite is Sufficient

### Volume Analysis
- **Current:** 5 accounts × 4 posts/day = 20 posts/day
- **Annual:** ~7,300 posts/year
- **SQLite Capacity:** Millions of rows easily
- **Conclusion:** ✅ No scaling issues

### Concurrency Analysis
- **Autopilot:** Every 30 minutes (sequential)
- **Auto-reply:** Every 5 minutes (sequential)
- **Queue worker:** Every 10 minutes (sequential)
- **Concurrent writes:** NONE
- **Conclusion:** ✅ No locking issues

### Resource Efficiency
- **SQLite:** 0 overhead, embedded, 128KB
- **PostgreSQL:** ~50-100MB RAM + service overhead
- **Conclusion:** ✅ SQLite more efficient

---

## 🔧 Stability Improvements Implemented

### 1. ✅ 500 Character Validation
**File:** `services/gemini.js`
- Auto-truncate main post if >500 chars
- Auto-truncate all comments if >500 chars
- Prevents Threads API errors

### 2. ✅ Automated Maintenance
**Cron Jobs Added:**
```bash
*/15 * * * * /home/ubuntu/threadsbot/health-check.sh      # Every 15 min
0 2 * * * /home/ubuntu/threadsbot/backup-db.sh            # Daily 2 AM
0 */6 * * * /home/ubuntu/threadsbot/rotate-logs.sh        # Every 6 hours
```

### 3. ✅ Health Monitoring
**Script:** `health-check.sh`
- Checks if process is running
- Checks if port 5008 is listening
- Checks if database exists
- Auto-restart on failure

### 4. ✅ Database Backup
**Script:** `backup-db.sh`
- Daily backup at 2 AM
- Compressed with gzip
- Keeps last 7 days
- Location: `/home/ubuntu/threadsbot/backups/`

### 5. ✅ Log Rotation
**Script:** `rotate-logs.sh`
- Rotates logs >10MB
- Keeps last 5 rotated logs
- Compresses logs >7 days old
- Deletes compressed logs >30 days

---

## 🚀 Manual Operations

### Start/Stop/Restart
```bash
# Start
cd /home/ubuntu/threadsbot
nohup node server.js >> dashboard.log 2>&1 &

# Stop
pkill -f "node server.js"

# Restart
pkill -f "node server.js" && sleep 2 && cd /home/ubuntu/threadsbot && nohup node server.js >> dashboard.log 2>&1 &

# Check status
netstat -tlnp | grep 5008
ps aux | grep "node server.js" | grep -v grep
```

### Check Logs
```bash
# Real-time
tail -f /home/ubuntu/threadsbot/dashboard.log

# Last 50 lines
tail -50 /home/ubuntu/threadsbot/dashboard.log

# Search errors
grep -i error /home/ubuntu/threadsbot/dashboard.log | tail -20

# Health check log
tail -50 /home/ubuntu/threadsbot/logs/health-check.log
```

### Database Operations
```bash
# Check database size
du -sh /home/ubuntu/threadsbot/data/threadsbot.db

# Count posts
sqlite3 /home/ubuntu/threadsbot/data/threadsbot.db "SELECT COUNT(*) FROM posts;"

# Recent posts
sqlite3 /home/ubuntu/threadsbot/data/threadsbot.db "SELECT id, status, created_at FROM posts ORDER BY id DESC LIMIT 10;"

# Manual backup
/home/ubuntu/threadsbot/backup-db.sh
```

### Trigger Autopilot Manually
```bash
cd /home/ubuntu/threadsbot
node trigger-autopilot.js
```

---

## 📈 Monitoring

### Key Metrics to Watch
1. **Disk Space:** Should stay <90%
   ```bash
   df -h /home/ubuntu
   ```

2. **Memory Usage:** Should stay <80%
   ```bash
   free -h
   ```

3. **Database Size:** Growth should be linear
   ```bash
   du -sh /home/ubuntu/threadsbot/data/threadsbot.db
   ```

4. **Log Size:** Should rotate properly
   ```bash
   ls -lh /home/ubuntu/threadsbot/dashboard.log*
   ```

### Expected Growth
- **Database:** ~50KB per 100 posts
- **Logs:** ~1MB per day (with rotation)
- **Backups:** ~10MB per week (compressed)

---

## 🔐 Security

### File Permissions
```bash
chmod 600 /home/ubuntu/threadsbot/.env
chmod 600 /home/ubuntu/threadsbot/data/threadsbot.db
chmod 700 /home/ubuntu/threadsbot/backups
```

### Sensitive Data
- `.env` file contains API keys
- Database contains access tokens
- Never commit to git
- Regular backups essential

---

## 🆘 Troubleshooting

### Bot Not Posting
1. Check if running: `netstat -tlnp | grep 5008`
2. Check logs: `tail -50 /home/ubuntu/threadsbot/dashboard.log`
3. Check Gemini API key: Visit dashboard → Settings
4. Trigger manual: `node trigger-autopilot.js`

### Database Locked
```bash
# Check for zombie processes
ps aux | grep sqlite3

# Kill if found
pkill sqlite3

# Restart bot
pkill -f "node server.js" && sleep 2 && cd /home/ubuntu/threadsbot && nohup node server.js >> dashboard.log 2>&1 &
```

### Disk Full
```bash
# Check space
df -h

# Clean old logs
find /home/ubuntu/threadsbot -name "*.log.*" -mtime +30 -delete

# Clean old backups
find /home/ubuntu/threadsbot/backups -name "*.db.gz" -mtime +14 -delete
```

---

## 📝 Maintenance Schedule

### Daily (Automated)
- ✅ Database backup (2 AM)
- ✅ Health check (every 15 min)

### Weekly (Manual)
- Check disk space
- Review error logs
- Verify autopilot posting

### Monthly (Manual)
- Review database size growth
- Clean old backups if needed
- Update dependencies if needed

---

## 🎯 When to Consider PostgreSQL

Only migrate to PostgreSQL if:
1. **>50 accounts** (high concurrent writes)
2. **>100,000 posts** (database >50MB)
3. **Multiple servers** (need centralized DB)
4. **Complex queries** (analytics, reporting)

**Current status:** NONE of the above apply ✅

---

## 📞 Quick Commands

```bash
# Status check
curl -I https://threadsbot.kelasmaster.id

# Restart
pkill -f "node server.js" && sleep 2 && cd /home/ubuntu/threadsbot && nohup node server.js >> dashboard.log 2>&1 &

# View logs
tail -f /home/ubuntu/threadsbot/dashboard.log

# Trigger posting
cd /home/ubuntu/threadsbot && node trigger-autopilot.js

# Database backup
/home/ubuntu/threadsbot/backup-db.sh

# Health check
/home/ubuntu/threadsbot/health-check.sh
```

---

**Last Updated:** 2026-03-12  
**Status:** ✅ Production Ready  
**Database:** SQLite (Stable)
