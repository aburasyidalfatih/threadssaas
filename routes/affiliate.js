const express = require('express');
const router = express.Router();
const db = require('../config/database');
const GeminiService = require('../services/gemini');
const { checkAuth } = require('../middleware/auth');

// Product page
router.get('/', checkAuth, (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.render('affiliate', {
    page: 'affiliate',
    user: req.session.userId ? { id: req.session.userId, name: req.session.userName, email: req.session.userEmail } : null
  });
});

// API endpoint for product data
router.get('/api/data', (req, res) => {
  const products = db.prepare('SELECT * FROM affiliate_products ORDER BY created_at DESC').all();
  const accounts = db.prepare("SELECT * FROM accounts WHERE is_active = 1").all();
  const scheduledPosts = db.prepare(`
    SELECT p.*, a.username
    FROM posts p
    LEFT JOIN accounts a ON p.account_id = a.id
    WHERE p.type = 'affiliate' AND p.status = 'scheduled'
    ORDER BY p.scheduled_at ASC
  `).all();
  
  const stats = {
    totalProducts: products.length,
    totalVariations: db.prepare("SELECT COUNT(*) as c FROM product_variations").get().c,
    activeAccounts: accounts.length
  };
  
  res.json({ success: true, products, accounts, stats, scheduledPosts });
});

// Add product
router.post('/product/add', checkAuth, (req, res) => {
  const { product_name, description, affiliate_link } = req.body;
  try {
    db.prepare('INSERT INTO affiliate_products (product_name, description, affiliate_link) VALUES (?, ?, ?)')
      .run(product_name, description, affiliate_link);
    res.redirect('/product?success=Produk+berhasil+ditambahkan');
  } catch (error) {
    res.redirect('/product?error=' + encodeURIComponent(error.message));
  }
});

// Delete product
router.post('/product/delete/:id', checkAuth, (req, res) => {
  db.prepare('DELETE FROM affiliate_products WHERE id = ?').run(req.params.id);
  res.redirect('/product');
});

// Cancel scheduled post
router.post('/cancel-schedule/:id', (req, res) => {
  try {
    // Get post content to find variation
    const post = db.prepare('SELECT content_main FROM posts WHERE id = ?').get(req.params.id);
    
    if (post && post.content_main) {
      // Unmark variation as scheduled
      db.prepare('UPDATE product_variations SET is_scheduled = 0 WHERE content_main = ?').run(post.content_main);
    }
    
    // Delete post
    db.prepare('DELETE FROM posts WHERE id = ?').run(req.params.id);
    
    res.json({ success: true });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

// Update product
router.post('/product/update/:id', (req, res) => {
  const { product_name, description, affiliate_link } = req.body;
  try {
    db.prepare('UPDATE affiliate_products SET product_name = ?, description = ?, affiliate_link = ? WHERE id = ?')
      .run(product_name, description, affiliate_link, req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

// Generate product content variations
router.post('/generate-variations', async (req, res) => {
  const { product_id, comment_count, variation_count } = req.body;

  // Set timeout lebih lama
  req.setTimeout(120000); // 2 menit
  res.setTimeout(120000);

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
      console.log(`[Generate] Processing variation ${i+1}/${count}: ${angle}`);
      
      const content = await GeminiService.generateAffiliateContent(
        product.product_name,
        product.description,
        product.affiliate_link,
        comments,
        angle
      );
      
      variations.push({
        angle: angle.split(':')[0],
        content_main: content.main_post,
        content_comments: content.comments || []
      });
    }

    res.json({ success: true, variations, product });
  } catch (error) {
    console.error('[Generate Variations Error]', error);
    res.json({ success: false, error: error.message });
  }
});

// Save variations to product_variations (belum dijadwalkan)
router.post('/save-variations', async (req, res) => {
  const { product_id, variations } = req.body;
  
  try {
    const product = db.prepare('SELECT * FROM affiliate_products WHERE id = ?').get(product_id);
    if (!product) {
      return res.json({ success: false, error: 'Product not found' });
    }
    
    const variationsArray = JSON.parse(variations);
    let savedCount = 0;
    
    variationsArray.forEach(variation => {
      try {
        db.prepare(`
          INSERT INTO product_variations (product_id, angle, content_main, content_comments)
          VALUES (?, ?, ?, ?)
        `).run(
          product_id,
          variation.angle,
          variation.content_main,
          JSON.stringify(variation.content_comments)
        );
        savedCount++;
      } catch (err) {
        console.error('Error saving variation:', err);
      }
    });
    
    res.json({ success: true, savedCount });
  } catch (error) {
    console.error('[Save Variations Error]', error);
    res.json({ success: false, error: error.message });
  }
});

// Get variations for a product
router.get('/variations/:product_id', (req, res) => {
  const variations = db.prepare('SELECT * FROM product_variations WHERE product_id = ? ORDER BY created_at DESC').all(req.params.product_id);
  res.json({ success: true, variations });
});

// Schedule variation to post queue
router.post('/schedule-variation', async (req, res) => {
  const { variation_id, account_id, scheduled_time } = req.body;
  
  try {
    const variation = db.prepare('SELECT * FROM product_variations WHERE id = ?').get(variation_id);
    if (!variation) {
      return res.json({ success: false, error: 'Variation not found' });
    }
    
    const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(account_id);
    if (!account) {
      return res.json({ success: false, error: 'Account not found' });
    }
    
    // Insert ke posts table
    db.prepare(`
      INSERT INTO posts (account_id, content_main, scheduled_at, status, type)
      VALUES (?, ?, ?, 'scheduled', 'affiliate')
    `).run(account_id, variation.content_main, scheduled_time);
    
    // Mark variation as scheduled
    db.prepare('UPDATE product_variations SET is_scheduled = 1 WHERE id = ?').run(variation_id);
    
    res.json({ success: true });
  } catch (error) {
    console.error('[Schedule Variation Error]', error);
    res.json({ success: false, error: error.message });
  }
});

module.exports = router;
