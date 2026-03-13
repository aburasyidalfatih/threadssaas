const express = require('express');
const router = express.Router();
const db = require('../config/database');
const AffiliateGenerator = require('../services/affiliate-generator');
const GeminiService = require('../services/gemini');
const SchedulerService = require('../services/scheduler');
const { checkAuth } = require('../middleware/auth');

// Product page
router.get('/', checkAuth, (req, res) => {
  const products = db.prepare('SELECT * FROM affiliate_products ORDER BY created_at DESC').all();
  const accounts = db.prepare("SELECT * FROM accounts WHERE is_active = 1").all();
  const defaultCommentCount = db.prepare("SELECT value FROM settings WHERE key = 'default_comment_count'").get();
  
  // Stats
  const stats = {
    totalProducts: products.length,
    totalPosts: db.prepare("SELECT COUNT(*) as c FROM posts WHERE type = 'affiliate'").get().c,
    activeAccounts: accounts.length
  };
  
  res.render('affiliate', {
    page: 'affiliate',
    products,
    accounts,
    stats,
    defaultCommentCount: parseInt(defaultCommentCount?.value || '3', 10),
    user: req.session.userId ? { id: req.session.userId, name: req.session.userName, email: req.session.userEmail } : null
  });
});

// API endpoint for product data
router.get('/api/data', checkAuth, (req, res) => {
  const products = db.prepare('SELECT * FROM affiliate_products ORDER BY created_at DESC').all();
  const accounts = db.prepare("SELECT * FROM accounts WHERE is_active = 1").all();
  
  const stats = {
    totalProducts: products.length,
    totalPosts: db.prepare("SELECT COUNT(*) as c FROM posts WHERE type = 'affiliate'").get().c,
    activeAccounts: accounts.length
  };
  
  res.json({ success: true, products, accounts, stats });
});
    accounts,
    stats,
    defaultCommentCount: parseInt(defaultCommentCount?.value || '3', 10),
    user: req.session.userId ? { id: req.session.userId, name: req.session.userName, email: req.session.userEmail } : null
  });
});

// Add product
router.post('/product/add', (req, res) => {
  const { product_name, description, affiliate_link, category } = req.body;
  try {
    AffiliateGenerator.saveProduct(product_name, description, affiliate_link, category);
    res.redirect('/affiliate');
  } catch (error) {
    res.redirect('/affiliate?error=' + encodeURIComponent(error.message));
  }
});

// Delete product
router.post('/product/delete/:id', (req, res) => {
  AffiliateGenerator.deleteProduct(req.params.id);
  res.redirect('/affiliate');
});

// Generate product content
router.post('/generate', async (req, res) => {
  const { product_id, comment_count } = req.body;

  try {
    const product = db.prepare('SELECT * FROM affiliate_products WHERE id = ?').get(product_id);
    if (!product) {
      return res.json({ success: false, error: 'Product not found' });
    }

    const content = await GeminiService.generateAffiliateContent(
      product.product_name,
      product.description,
      product.affiliate_link,
      parseInt(comment_count || '3', 10)
    );

    res.json({ success: true, content, product });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

// Post product content
router.post('/post', async (req, res) => {
  const { account_id, product_name, content_main, content_comments, comment_count } = req.body;
  try {
    const comments = typeof content_comments === 'string' ? content_comments : JSON.stringify(content_comments);
    const result = db.prepare(`
      INSERT INTO posts (account_id, type, topic, content_main, content_comments, comment_count, status)
      VALUES (?, 'affiliate', ?, ?, ?, ?, 'scheduled')
    `).run(account_id, `Promo: ${product_name}`, content_main, comments, parseInt(comment_count || '3', 10));

    SchedulerService.executePost(result.lastInsertRowid);
    res.json({ success: true, postId: result.lastInsertRowid });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

// Generate product content variations
router.post('/generate-variations', async (req, res) => {
  const { product_id, comment_count, variation_count } = req.body;

  try {
    const product = db.prepare('SELECT * FROM affiliate_products WHERE id = ?').get(product_id);
    if (!product) {
      return res.json({ success: false, error: 'Product not found' });
    }

    const count = parseInt(variation_count || '5', 10);
    const comments = parseInt(comment_count || '3', 10);
    
    const angles = [
      'Problem-Solution: Fokus pada masalah yang dipecahkan produk',
      'Before-After: Ceritakan transformasi sebelum dan sesudah pakai produk',
      'Social Proof: Gunakan testimoni atau bukti sosial',
      'Scarcity/Urgency: Tekankan keterbatasan waktu atau stok',
      'Educational/Tips: Berikan tips atau edukasi terkait produk'
    ];
    
    const variations = [];
    
    for (let i = 0; i < Math.min(count, 5); i++) {
      const angle = angles[i];
      const content = await GeminiService.generateAffiliateContent(
        product.product_name,
        product.description,
        product.affiliate_link,
        comments,
        angle
      );
      
      variations.push({
        angle: angle.split(':')[0],
        ...content
      });
    }

    res.json({ success: true, variations, product });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

// Schedule variations to queue
router.post('/schedule-variations', async (req, res) => {
  const { account_id, product_id, variations } = req.body;
  
  try {
    const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(account_id);
    if (!account) {
      return res.json({ success: false, error: 'Account not found' });
    }
    
    const product = db.prepare('SELECT * FROM affiliate_products WHERE id = ?').get(product_id);
    if (!product) {
      return res.json({ success: false, error: 'Product not found' });
    }
    
    const variationsArray = JSON.parse(variations);
    let savedCount = 0;
    
    variationsArray.forEach(variation => {
      try {
        db.prepare(`
          INSERT INTO content_queue (account_id, topic, content_main, content_comments, comment_count, status)
          VALUES (?, ?, ?, ?, ?, 'queued')
        `).run(
          account_id,
          `${variation.angle}: ${product.product_name}`,
          variation.content_main,
          JSON.stringify(variation.content_comments),
          variation.content_comments.length
        );
        savedCount++;
      } catch (err) {
        console.error('Error saving variation:', err);
      }
    });
    
    res.json({ success: true, savedCount });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

// API endpoint for product data
router.get('/api/data', (req, res) => {
  const products = db.prepare('SELECT * FROM affiliate_products ORDER BY created_at DESC').all();
  const accounts = db.prepare("SELECT * FROM accounts WHERE is_active = 1").all();
  
  const stats = {
    totalProducts: products.length,
    totalPosts: db.prepare("SELECT COUNT(*) as c FROM posts WHERE type = 'affiliate'").get().c,
    activeAccounts: accounts.length
  };
  
  res.json({ success: true, products, accounts, stats });
});

module.exports = router;
