const express = require('express');
const router = express.Router();
const { Database } = require('../config/database');
const AuthService = require('../services/auth');

// Product page
router.get('/', async (req, res) => {
  if (!req.session.userId) {
    return res.redirect('/login');
  }

  try {
    // Get user with limits
    const user = await AuthService.getUserById(req.session.userId);
    
    // Get user's products
    const products = await Database.all(`
      SELECT * FROM user_products 
      WHERE user_id = $1 
      ORDER BY created_at DESC
    `, [req.session.userId]) || [];

    // Get user's active accounts
    const accounts = await Database.all(`
      SELECT ua.id, ua.username
      FROM user_accounts ua 
      WHERE ua.user_id = $1 
        AND ua.access_token IS NOT NULL 
        AND (ua.token_expires_at IS NULL OR ua.token_expires_at > NOW())
      ORDER BY ua.username ASC
    `, [req.session.userId]) || [];

    // Calculate stats
    const stats = {
      totalProducts: products.length,
      totalVariations: 0, // TODO: Calculate variations
      activeAccounts: accounts.length
    };

    res.render('product/index', {
      user,
      products,
      accounts,
      stats,
      page: 'product'
    });

  } catch (error) {
    console.error('Product page error:', error);
    res.redirect('/dashboard?error=' + encodeURIComponent('Gagal memuat halaman produk'));
  }
});

// Add product
router.post('/add', async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { product_name, affiliate_link, description } = req.body;

    if (!product_name || !affiliate_link || !description) {
      return res.status(400).json({ error: 'Semua field harus diisi' });
    }

    // Add product
    await Database.run(`
      INSERT INTO user_products (user_id, product_name, affiliate_link, description, created_at)
      VALUES ($1, $2, $3, $4, $5)
    `, [
      req.session.userId,
      product_name,
      affiliate_link,
      description,
      new Date()
    ]);

    res.redirect('/product?success=' + encodeURIComponent('Produk berhasil ditambahkan'));

  } catch (error) {
    console.error('Add product error:', error);
    res.redirect('/product?error=' + encodeURIComponent('Gagal menambahkan produk'));
  }
});

// Generate variations
router.post('/generate-variations', async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { product_id, variation_count } = req.body;

    if (!product_id || !variation_count) {
      return res.status(400).json({ error: 'Data tidak lengkap' });
    }

    // Get product
    const product = await Database.get(`
      SELECT * FROM user_products 
      WHERE id = $1 AND user_id = $2
    `, [product_id, req.session.userId]);

    if (!product) {
      return res.status(404).json({ error: 'Produk tidak ditemukan' });
    }

    // TODO: Implement AI variation generation
    // For now, return mock variations
    const variations = [];
    for (let i = 1; i <= parseInt(variation_count); i++) {
      variations.push({
        id: i,
        content: `🔥 ${product.product_name} - Variasi ${i}\n\n${product.description}\n\nDapatkan sekarang: ${product.affiliate_link}\n\n#affiliate #produk #rekomendasi`
      });
    }

    res.json({
      success: true,
      variations: variations,
      product: product
    });

  } catch (error) {
    console.error('Generate variations error:', error);
    res.status(500).json({ error: 'Gagal generate variasi' });
  }
});

// Delete product
router.delete('/:id', async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const productId = req.params.id;

    // Verify product belongs to user
    const product = await Database.get(
      'SELECT id FROM user_products WHERE id = $1 AND user_id = $2',
      [productId, req.session.userId]
    );

    if (!product) {
      return res.status(404).json({ error: 'Produk tidak ditemukan' });
    }

    // Delete product
    await Database.run('DELETE FROM user_products WHERE id = $1', [productId]);

    res.json({ success: true, message: 'Produk berhasil dihapus' });

  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({ error: 'Gagal menghapus produk' });
  }
});

module.exports = router;
