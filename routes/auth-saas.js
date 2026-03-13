const express = require('express');
const router = express.Router();
const AuthService = require('../services/auth');

// Login page
router.get('/login', (req, res) => {
  if (req.session.userId) {
    return res.redirect('/dashboard');
  }
  
  res.render('login', {
    hideNavbar: true,
    error: req.query.error,
    message: req.query.message
  });
});

// Register page
router.get('/register', (req, res) => {
  if (req.session.userId) {
    return res.redirect('/dashboard');
  }
  
  res.render('auth/register', {
    hideNavbar: true,
    error: req.query.error,
    message: req.query.message
  });
});

// Login POST
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.redirect('/login?error=' + encodeURIComponent('Email dan password harus diisi'));
    }

    const user = await AuthService.login(email, password);
    
    // Set session
    req.session.userId = user.id;
    req.session.userName = user.name;
    req.session.userEmail = user.email;
    req.session.userPlan = user.plan;

    res.redirect('/');
  } catch (error) {
    console.error('Login error:', error);
    res.redirect('/login?error=' + encodeURIComponent(error.message));
  }
});

// Register POST
router.post('/register', async (req, res) => {
  try {
    const { email, password, name, confirm_password } = req.body;

    // Validation
    if (!email || !password || !name) {
      return res.redirect('/register?error=' + encodeURIComponent('Semua field harus diisi'));
    }

    if (password !== confirm_password) {
      return res.redirect('/register?error=' + encodeURIComponent('Password tidak cocok'));
    }

    if (password.length < 6) {
      return res.redirect('/register?error=' + encodeURIComponent('Password minimal 6 karakter'));
    }

    const user = await AuthService.register(email, password, name);
    
    // Auto login after register
    req.session.userId = user.id;
    req.session.userName = user.name;
    req.session.userEmail = user.email;
    req.session.userPlan = user.plan;

    res.redirect('/?message=' + encodeURIComponent('Akun berhasil dibuat! Trial 7 hari dimulai.'));
  } catch (error) {
    console.error('Register error:', error);
    res.redirect('/register?error=' + encodeURIComponent(error.message));
  }
});

// Logout
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
    }
    res.redirect('/login?message=' + encodeURIComponent('Berhasil logout'));
  });
});

// Logout GET route (for direct links)
router.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
    }
    res.redirect('/login?message=' + encodeURIComponent('Berhasil logout'));
  });
});

// Profile page
router.get('/profile', async (req, res) => {
  if (!req.session.userId) {
    return res.redirect('/login');
  }

  try {
    const user = await AuthService.getUserById(req.session.userId);
    res.render('profile', { 
      layout: 'main', // Use main layout for profile
      user 
    });
  } catch (error) {
    console.error('Profile error:', error);
    res.redirect('/?error=' + encodeURIComponent('Gagal memuat profil'));
  }
});

// API: Get current user
router.get('/api/user', async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const user = await AuthService.getUserById(req.session.userId);
    res.json({ user });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

module.exports = router;
