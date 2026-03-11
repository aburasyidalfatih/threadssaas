#!/bin/bash

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║        BACKING UP THREADSBOT TO GITHUB                        ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Check if git is initialized
if [ ! -d ".git" ]; then
  echo "[1/5] Initializing git repository..."
  git init
  echo "✓ Git initialized"
else
  echo "[1/5] Git repository already exists"
fi

echo ""
echo "[2/5] Configuring git..."
git config user.email "backup@threadsbot.local"
git config user.name "ThreadsBot Backup"
echo "✓ Git configured"

echo ""
echo "[3/5] Adding files to git..."
git add -A
echo "✓ Files added"

echo ""
echo "[4/5] Creating commit..."
git commit -m "ThreadsBot Backup - $(date '+%Y-%m-%d %H:%M:%S')" || echo "✓ Already committed"
echo "✓ Commit created"

echo ""
echo "[5/5] Adding remote and pushing..."
git remote remove origin 2>/dev/null || true
git remote add origin https://github.com/aburasyidalfatih/threadsbot.git
echo "✓ Remote added"

echo ""
echo "Ready to push. Run:"
echo "  git branch -M main"
echo "  git push -u origin main"
echo ""
echo "Note: You need to authenticate with GitHub first"
echo "Use: git config --global credential.helper store"
