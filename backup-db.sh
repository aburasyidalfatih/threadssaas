#!/bin/bash

BACKUP_DIR="/home/ubuntu/threadsbot/backups"
DB_FILE="/home/ubuntu/threadsbot/data/threadsbot.db"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/threadsbot_$TIMESTAMP.db"

mkdir -p "$BACKUP_DIR"

# Backup database
cp "$DB_FILE" "$BACKUP_FILE"

# Keep only last 7 days of backups
find "$BACKUP_DIR" -name "threadsbot_*.db" -mtime +7 -delete

echo "[$(date)] Database backed up to $BACKUP_FILE"
