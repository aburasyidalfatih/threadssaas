require('dotenv').config();

// Set timezone to Asia/Jakarta (WIB)
process.env.TZ = 'Asia/Jakarta';

const express = require('express');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize database
const db = require('./config/database');
const { checkAuth } = require('./middleware/auth');

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  store: new SQLiteStore({
    db: 'sessions.db',
    dir: './data'
  }),
  secret: process.env.SESSION_SECRET || 'threadsbot-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    maxAge: 24 * 60 * 60 * 1000,
    httpOnly: true,
    secure: false
  }
}));

// View engine
app.set('view engine', 'ejs');
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

// Auth check middleware
app.use((req, res, next) => {
  const publicPaths = ['/login', '/register', '/logout'];
  const publicPrefixes = ['/login', '/register', '/product/api', '/product/generate-variations', '/product/schedule-variations', '/product/save-variations', '/product/schedule-variation', '/product/variations', '/product/cancel-schedule'];
  
  if (publicPaths.includes(req.path) || publicPrefixes.some(prefix => req.path.startsWith(prefix))) {
    return next();
  }
  if (!req.session.userId) {
    return res.redirect('/login');
  }
  next();
});

// Routes
app.use('/', require('./routes/auth'));
app.use('/', require('./routes/dashboard'));
app.use('/accounts', require('./routes/accounts'));
app.use('/posts', require('./routes/posts'));
app.use('/product', require('./routes/affiliate'));
app.use('/affiliate', require('./routes/affiliate'));
app.use('/autopilot', require('./routes/autopilot'));
app.use('/queue', require('./routes/queue'));
app.use('/settings', require('./routes/settings'));
app.use('/', require('./routes/api'));

// 404 handler
app.use((req, res) => {
  res.status(404).render('layout', {
    page: '404',
    body: '<div class="empty-state" style="padding:60px 20px"><h2 style="font-size:48px;margin-bottom:12px">404</h2><p>Halaman tidak ditemukan. <a href="/">Kembali ke Dashboard</a></p></div>'
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('[Error]', err.stack);
  res.status(500).redirect('/?error=' + encodeURIComponent('Terjadi kesalahan server'));
});

// Start scheduler
const SchedulerService = require('./services/scheduler');

const server = app.listen(PORT, () => {
  console.log(`🤖 ThreadsBot running at http://localhost:${PORT}`);
  SchedulerService.init();
});

// Graceful shutdown
const shutdown = () => {
  console.log('\n🛑 Shutting down gracefully...');
  server.close(() => {
    db.close();
    console.log('✅ Server closed.');
    process.exit(0);
  });
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
