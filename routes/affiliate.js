const express = require('express');
const router = express.Router();
const db = require('../config/database');
const AffiliateGenerator = require('../services/affiliate-generator');
const GeminiService = require('../services/gemini');
const SchedulerService = require('../services/scheduler');

// Product page
router.get('/', (req, res) => {
  const products = AffiliateGenerator.getProducts();
  const accounts = db.prepare("SELECT * FROM accounts WHERE is_active = 1").all();
  const defaultCommentCount = db.prepare("SELECT value FROM settings WHERE key = 'default_comment_count'").get();
  res.render('affiliate', {
    page: 'affiliate',
    products,
    accounts,
    defaultCommentCount: parseInt(defaultCommentCount?.value || '3', 10)
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

module.exports = router;
