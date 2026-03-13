#!/bin/bash
# Health check for ThreadsBot

LOG_FILE="/home/ubuntu/threadsbot/logs/health-check.log"

check_process() {
    if pgrep -f "node server.js" > /dev/null; then
        echo "$(date): ✅ ThreadsBot is running"
        return 0
    else
        echo "$(date): ❌ ThreadsBot is NOT running - attempting restart..."
        cd /home/ubuntu/threadsbot
        pm2 restart threadsbot
        return 1
    fi
}

check_port() {
    if netstat -tlnp 2>/dev/null | grep -q ":5008"; then
        echo "$(date): ✅ Port 5008 is listening"
        return 0
    else
        echo "$(date): ⚠️  Port 5008 is NOT listening"
        return 1
    fi
}

check_database() {
    if [ -f "/home/ubuntu/threadsbot/data/threadsbot.db" ]; then
        size=$(stat -c%s "/home/ubuntu/threadsbot/data/threadsbot.db")
        echo "$(date): ✅ Database exists (${size} bytes)"
        return 0
    else
        echo "$(date): ❌ Database file missing!"
        return 1
    fi
}

# Run checks
{
    echo "=== Health Check $(date) ==="
    check_process
    check_port
    check_database
    echo ""
} >> "$LOG_FILE"

# Keep only last 1000 lines
tail -1000 "$LOG_FILE" > "$LOG_FILE.tmp" && mv "$LOG_FILE.tmp" "$LOG_FILE"
