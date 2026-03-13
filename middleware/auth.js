const AuthService = require('../services/auth');

// Authentication middleware
const requireAuth = async (req, res, next) => {
  try {
    // Check session first
    if (req.session.userId) {
      const user = await AuthService.getUserById(req.session.userId);
      if (user && user.status === 'active') {
        req.user = user;
        return next();
      }
    }

    // Check JWT token in header
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (token) {
      const decoded = AuthService.verifyToken(token);
      if (decoded) {
        const user = await AuthService.getUserById(decoded.userId);
        if (user && user.status === 'active') {
          req.user = user;
          return next();
        }
      }
    }

    // Redirect to login for web requests
    if (req.headers.accept?.includes('text/html')) {
      return res.redirect('/login');
    }

    // Return JSON error for API requests
    return res.status(401).json({ error: 'Authentication required' });
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({ error: 'Authentication error' });
  }
};

// Check plan limits middleware
const checkLimit = (action) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const canPerform = await AuthService.checkLimit(req.user.id, action);
      if (!canPerform) {
        const limits = {
          add_account: `Limit akun tercapai (${req.user.max_accounts} akun)`,
          create_post: `Limit posting bulanan tercapai (${req.user.max_posts_per_month} posts)`,
          add_queue_item: `Limit queue tercapai (${req.user.max_queue_items} items)`
        };

        if (req.headers.accept?.includes('text/html')) {
          return res.redirect(`/?error=${encodeURIComponent(limits[action] || 'Limit tercapai')}&upgrade=true`);
        }

        return res.status(403).json({ 
          error: limits[action] || 'Limit tercapai',
          upgrade_required: true,
          current_plan: req.user.plan
        });
      }

      next();
    } catch (error) {
      console.error('Limit check error:', error);
      return res.status(500).json({ error: 'Limit check failed' });
    }
  };
};

// Admin only middleware
const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.plan !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// Plan feature check
const requireFeature = (feature) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const features = req.user.features || {};
    if (!features[feature]) {
      return res.status(403).json({ 
        error: `Feature '${feature}' not available in ${req.user.plan} plan`,
        upgrade_required: true 
      });
    }

    next();
  };
};

module.exports = {
  requireAuth,
  checkLimit,
  requireAdmin,
  requireFeature
};
