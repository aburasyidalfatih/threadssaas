# ThreadsBot - Deployment Info

## 🚀 Deployment Details

- **Domain**: https://threadsbot.kelasmaster.id
- **Port**: 5006 (internal)
- **Process Manager**: Supervisor
- **Web Server**: Nginx (reverse proxy)
- **SSL**: Let's Encrypt (auto-renew)
- **Database**: SQLite (local)

## 📋 Configuration

### Environment Variables (.env)
```
PORT=5006
SESSION_SECRET=threadsbot-vps-secret-key-2026
GEMINI_API_KEY=<your-api-key>
BASE_URL=https://threadsbot.kelasmaster.id
```

### Supervisor Config
- Location: `/etc/supervisor/conf.d/threadsbot.conf`
- Service: `threadsbot`
- Logs: `/home/ubuntu/threadsbot/dashboard.log`

### Nginx Config
- Location: `/etc/nginx/sites-available/threadsbot.kelasmaster.id`
- SSL: Enabled with auto-redirect from HTTP to HTTPS

## 🔧 Common Commands

```bash
# Check status
sudo supervisorctl status threadsbot

# View logs
tail -f /home/ubuntu/threadsbot/dashboard.log

# Restart service
sudo supervisorctl restart threadsbot

# Stop service
sudo supervisorctl stop threadsbot

# Start service
sudo supervisorctl start threadsbot
```

## ⚙️ Setup Required

1. **Gemini API Key**: Add to `.env` file
   - Get from: https://aistudio.google.com/apikey
   - Then restart: `sudo supervisorctl restart threadsbot`

2. **Meta App Setup**: Configure in dashboard
   - OAuth Redirect URI: `https://threadsbot.kelasmaster.id/callback/threads`

## 📊 Monitoring

- Check port: `netstat -tlnp | grep 5006`
- Check process: `ps aux | grep threadsbot`
- Check Nginx: `sudo systemctl status nginx`

## 🔐 SSL Certificate

- Expires: 2026-06-09
- Auto-renewal: Enabled via Certbot
- Check renewal: `sudo certbot renew --dry-run`

---

**Deployed**: 2026-03-11
**Status**: ✅ Running
