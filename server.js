require('dotenv').config();

// Set timezone to Asia/Jakarta (WIB)
process.env.TZ = 'Asia/Jakarta';

const express = require('express');
const session = require('express-session');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5009;

// Initialize database connections
const { Database, Cache, RedisSessionStore, testConnections } = require('./config/database');

// Test database connections on startup
testConnections().then(success => {
  if (!success) {
    console.error('Failed to connect to databases. Exiting...');
    process.exit(1);
  }
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Redis session store (temporarily disabled)
app.use(session({
  secret: process.env.SESSION_SECRET || 'threadsbot-saas-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    maxAge: 24 * 60 * 60 * 1000,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production'
  }
}));

// View engine - Handlebars
const { engine } = require('express-handlebars');

app.engine('hbs', engine({
  defaultLayout: 'main',
  extname: '.hbs',
  layoutsDir: path.join(__dirname, 'views/layouts'),
  partialsDir: path.join(__dirname, 'views/partials'),
  helpers: {
    uppercase: (str) => str ? str.toUpperCase() : '',
    eq: (a, b) => a === b,
    gt: (a, b) => a > b,
    percentage: (used, total) => total > 0 ? Math.round((used / total) * 100) : 0,
    formatDate: (date) => new Date(date).toLocaleDateString('id-ID'),
    truncate: (str, length) => str && str.length > length ? str.substring(0, length) + '...' : str,
    substring: (str, start, end) => str ? str.substring(start, end).toUpperCase() : '',
    lookup: (obj, key) => obj && obj[key] ? obj[key] : { queued: 0 },
    parseJSON: (str) => {
      try {
        return JSON.parse(str || '[]');
      } catch (e) {
        return [];
      }
    },
    json: (obj) => JSON.stringify(obj),
    range: (start, end) => {
      const result = [];
      for (let i = start; i <= end; i++) {
        result.push(i);
      }
      return result;
    },
    add: (a, b) => a + b,
    subtract: (a, b) => a - b,
    lt: (a, b) => a < b,
    add: (a, b) => a + b,
    percentage: (current, total) => Math.round((current / total) * 100)
  }
}));
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));

// Flash messages middleware
app.use((req, res, next) => {
  res.locals.query = req.query;
  res.locals.user = req.session.userId ? {
    id: req.session.userId,
    name: req.session.userName,
    email: req.session.userEmail
  } : null;
  next();
});

// Temporary auth check (will be replaced with proper SaaS auth)
app.use((req, res, next) => {
  const publicPaths = ['/login', '/register', '/logout'];
  const publicPrefixes = ['/login', '/register', '/product/api', '/product/generate-variations', '/product/schedule-variations', '/product/save-variations', '/product/schedule-variation', '/product/variations', '/product/cancel-schedule'];
  
  if (publicPaths.includes(req.path) || publicPrefixes.some(prefix => req.path.startsWith(prefix))) {
    return next();
  }
  
  // Let routes handle their own auth check
  next();
});

// Routes (SaaS version) - Specific routes first
app.use('/autopilot', require('./routes/autopilot'));
app.use('/accounts', require('./routes/accounts'));
app.use('/posts', require('./routes/posts'));
app.use('/product', require('./routes/product'));
app.use('/settings', require('./routes/settings'));

// Auth and dashboard routes last (catch-all)
app.use('/', require('./routes/auth-saas'));
app.use('/', require('./routes/dashboard'));

// Route aliases for compatibility
app.get('/queue', (req, res) => res.redirect('/posts/queue'));
// app.use('/posts', require('./routes/posts'));
// app.use('/product', require('./routes/affiliate'));
// app.use('/affiliate', require('./routes/affiliate'));
// app.use('/autopilot', require('./routes/autopilot'));
// app.use('/queue', require('./routes/queue'));
// app.use('/settings', require('./routes/settings'));
// app.use('/', require('./routes/api'));

// 404 handler
app.use((req, res) => {
  res.status(404).send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>404 - Not Found</title>
      <style>
        body { font-family: Arial, sans-serif; text-align: center; padding: 60px; background: #0f0f23; color: #e8e8f0; }
        h1 { font-size: 48px; margin-bottom: 12px; }
        p { margin-bottom: 20px; }
        a { color: #7c6aff; text-decoration: none; }
        a:hover { text-decoration: underline; }
      </style>
    </head>
    <body>
      <h1>404</h1>
      <p>Halaman tidak ditemukan.</p>
      <p><a href="/">Kembali ke Dashboard</a></p>
    </body>
    </html>
  `);
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('[Error]', err.stack);
  res.status(500).redirect('/?error=' + encodeURIComponent('Terjadi kesalahan server'));
});

// Start scheduler (will be updated for SaaS)
const SchedulerService = require('./services/scheduler');

const server = app.listen(PORT, () => {
  console.log(`🚀 ThreadsBot SaaS running at http://localhost:${PORT}`);
  console.log(`🌐 Public URL: https://threadssaas.kelasmaster.id`);
  // TODO: Update scheduler for PostgreSQL
  // SchedulerService.init();
});

// Graceful shutdown
const shutdown = () => {
  console.log('\n🛑 Shutting down gracefully...');
  server.close(() => {
    console.log('✅ Server closed.');
    process.exit(0);
  });
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
