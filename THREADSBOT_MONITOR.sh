#!/bin/bash

# ThreadsBot Monitoring & Health Check
REPORT_FILE="/home/ubuntu/threadsbot/logs/monitor_$(date +%Y%m%d_%H%M%S).log"
mkdir -p /home/ubuntu/threadsbot/logs

{
  echo "╔════════════════════════════════════════════════════════════════╗"
  echo "║              THREADSBOT HEALTH CHECK REPORT                    ║"
  echo "║              Time: $(date '+%Y-%m-%d %H:%M:%S')                    ║"
  echo "╚════════════════════════════════════════════════════════════════╝"
  echo ""
  
  # 1. Process Status
  echo "1. PROCESS STATUS:"
  if pgrep -f "node.*server.js" > /dev/null; then
    PID=$(pgrep -f "node.*server.js")
    echo "   ✓ Process running (PID: $PID)"
    ps aux | grep $PID | grep -v grep | awk '{print "   Memory:", $6"KB", "CPU:", $3"%"}'
  else
    echo "   ✗ Process not running"
  fi
  echo ""
  
  # 2. Port Status
  echo "2. PORT STATUS:"
  if netstat -tlnp 2>/dev/null | grep -q ":5008 "; then
    echo "   ✓ Port 5008 listening"
  else
    echo "   ✗ Port 5008 not listening"
  fi
  echo ""
  
  # 3. HTTP Response
  echo "3. HTTP RESPONSE:"
  RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5008)
  if [ "$RESPONSE" = "200" ]; then
    echo "   ✓ HTTP 200 OK"
  else
    echo "   ⚠ HTTP $RESPONSE"
  fi
  echo ""
  
  # 4. Configuration
  echo "4. CONFIGURATION:"
  if [ -f ".env" ]; then
    echo "   ✓ .env file exists"
    PERMS=$(stat -c %a .env)
    if [ "$PERMS" = "600" ]; then
      echo "   ✓ .env permissions: 600 (secure)"
    else
      echo "   ✗ .env permissions: $PERMS (should be 600)"
    fi
  else
    echo "   ✗ .env file missing"
  fi
  echo ""
  
  # 5. Database
  echo "5. DATABASE:"
  if [ -f "database.db" ]; then
    SIZE=$(du -h database.db | cut -f1)
    echo "   ✓ Database exists (Size: $SIZE)"
  else
    echo "   ✗ Database missing"
  fi
  echo ""
  
  # 6. Recent Logs
  echo "6. RECENT LOGS (Last 10 lines):"
  if [ -f "dashboard.log" ]; then
    tail -10 dashboard.log | sed 's/^/   /'
  else
    echo "   No logs found"
  fi
  echo ""
  
  # 7. Disk Space
  echo "7. DISK SPACE:"
  USAGE=$(df /home/ubuntu | tail -1 | awk '{print $5}')
  echo "   Usage: $USAGE"
  echo ""
  
  # 8. Summary
  echo "╔════════════════════════════════════════════════════════════════╗"
  echo "║                    SUMMARY                                     ║"
  echo "╚════════════════════════════════════════════════════════════════╝"
  
  if pgrep -f "node.*server.js" > /dev/null && netstat -tlnp 2>/dev/null | grep -q ":5008 "; then
    echo "✅ ThreadsBot is HEALTHY and OPERATIONAL"
  else
    echo "⚠️  ThreadsBot needs attention"
  fi
  
} | tee "$REPORT_FILE"

echo ""
echo "Report saved to: $REPORT_FILE"
