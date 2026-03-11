#!/bin/bash

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║     CHECKING THREADS ACCOUNTS CAPACITY                        ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

echo "1. Checking database schema:"
sqlite3 database.db ".schema" | grep -i "account\|threads" | head -20
echo ""

echo "2. Checking for account management code:"
grep -r "account" views/accounts.ejs | head -5
echo ""

echo "3. Checking API routes:"
grep -r "accounts" routes/ 2>/dev/null | head -10
echo ""

echo "4. Checking database tables:"
sqlite3 database.db ".tables"
echo ""

echo "5. Checking accounts table structure:"
sqlite3 database.db ".schema accounts" 2>/dev/null || echo "No accounts table found"
echo ""

echo "6. Checking current accounts in database:"
sqlite3 database.db "SELECT COUNT(*) as total_accounts FROM accounts;" 2>/dev/null || echo "Cannot query accounts"
echo ""

echo "7. Checking for multi-account support in code:"
grep -r "multiple\|multi\|account" public/js/app.js | head -5
echo ""

echo "8. Checking accounts.ejs page:"
wc -l views/accounts.ejs
echo ""

echo "9. Looking for account limit configuration:"
grep -r "limit\|max.*account" . --include="*.js" --include="*.py" 2>/dev/null | head -5
