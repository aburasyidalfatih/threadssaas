#!/bin/bash

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║        DETAILED MOBILE DISPLAY CHECK                          ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

echo "1. Checking main CSS file size and structure:"
wc -l public/css/style.css
echo ""

echo "2. Checking mobile CSS file:"
wc -l public/css/mobile-improvements.css
echo ""

echo "3. Checking for media queries in main CSS:"
grep -c "@media" public/css/style.css
echo "media queries in style.css"
echo ""

echo "4. Checking for responsive issues:"
echo "Looking for fixed widths that might break mobile..."
grep -n "width: [0-9]*px" public/css/style.css | head -10
echo ""

echo "5. Checking sidebar width:"
grep -n "sidebar-width" public/css/style.css
echo ""

echo "6. Checking main content margin:"
grep -n "margin-left" public/css/style.css | head -5
echo ""

echo "7. Checking for overflow issues:"
grep -n "overflow" public/css/style.css
echo ""

echo "⚠️  POTENTIAL ISSUES FOUND - Need to check:"
echo "├─ Fixed widths in main CSS"
echo "├─ Sidebar width on mobile"
echo "├─ Main content margins"
echo "├─ Overflow settings"
echo "└─ Media queries in main CSS"
