#!/bin/bash
# Log rotation for ThreadsBot

LOG_DIR="/home/ubuntu/threadsbot"
MAX_SIZE=10485760  # 10MB in bytes

rotate_log() {
    local logfile=$1
    if [ -f "$logfile" ]; then
        size=$(stat -f%z "$logfile" 2>/dev/null || stat -c%s "$logfile" 2>/dev/null)
        if [ "$size" -gt "$MAX_SIZE" ]; then
            timestamp=$(date +%Y%m%d_%H%M%S)
            mv "$logfile" "${logfile}.${timestamp}"
            touch "$logfile"
            # Keep only last 5 rotated logs
            ls -t "${logfile}".* 2>/dev/null | tail -n +6 | xargs rm -f 2>/dev/null
            echo "$(date): Rotated $logfile (size: $size bytes)"
        fi
    fi
}

rotate_log "$LOG_DIR/dashboard.log"

# Compress old logs older than 7 days
find "$LOG_DIR" -name "dashboard.log.*" -mtime +7 -exec gzip {} \;

# Delete compressed logs older than 30 days
find "$LOG_DIR" -name "dashboard.log.*.gz" -mtime +30 -delete
