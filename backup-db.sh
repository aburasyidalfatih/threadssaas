#!/bin/bash
# Daily backup for ThreadsBot database

BACKUP_DIR="/home/ubuntu/threadsbot/backups"
DB_FILE="/home/ubuntu/threadsbot/data/threadsbot.db"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p "$BACKUP_DIR"

# Backup database
if [ -f "$DB_FILE" ]; then
    cp "$DB_FILE" "$BACKUP_DIR/threadsbot_${DATE}.db"
    gzip "$BACKUP_DIR/threadsbot_${DATE}.db"
    echo "$(date): Backup created: threadsbot_${DATE}.db.gz"
    
    # Keep only last 7 days
    find "$BACKUP_DIR" -name "threadsbot_*.db.gz" -mtime +7 -delete
else
    echo "$(date): Database file not found!"
fi
