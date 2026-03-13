# Product Page - Generate Variations Feature
**Date**: 2026-03-13 06:00
**Status**: ✅ Backend Ready, Frontend Pending

## 🎯 Fitur Baru: Generate Variasi Konten Produk

### Konsep:
Input 1 produk → Generate 5 variasi konten dengan angle berbeda → Schedule ke akun pilihan

### Backend Implementation ✅

#### 1. **New Endpoints**

**POST `/product/generate-variations`**
```javascript
Body: {
  product_id: number,
  comment_count: number (default: 3),
  variation_count: number (default: 5)
}

Response: {
  success: true,
  variations: [
    {
      angle: "Problem-Solution",
      content_main: "...",
      content_comments: ["...", "...", "..."]
    },
    // ... 4 more variations
  ],
  product: { ... }
}
```

**POST `/product/schedule-variations`**
```javascript
Body: {
  account_id: number,
  product_id: number,
  variations: JSON string of variations array
}

Response: {
  success: true,
  savedCount: 5
}
```

#### 2. **5 Content Angles**

1. **Problem-Solution**
   - Hook: Fokus pada masalah yang dipecahkan
   - Story: Dari frustasi ke solusi
   - CTA: "Pernah ngalamin masalah ini?"

2. **Before-After**
   - Hook: Transformasi yang dialami
   - Story: Perjalanan perubahan
   - CTA: "Mau hasil yang sama?"

3. **Social Proof**
   - Hook: Testimoni atau bukti sosial
   - Story: Pengalaman orang lain
   - CTA: "Udah banyak yang buktiin"

4. **Scarcity/Urgency**
   - Hook: Keterbatasan waktu/stok
   - Story: Kenapa harus sekarang
   - CTA: "Jangan sampai kehabisan"

5. **Educational/Tips**
   - Hook: Tips atau insight
   - Story: Edukasi value
   - CTA: "Mau tau tips lainnya?"

#### 3. **GeminiService Update** ✅
- Added `angle` parameter to `generateAffiliateContent()`
- Angle instruction appended to prompt
- Each variation gets unique angle-specific content

#### 4. **Database Integration** ✅
- Variations saved to `content_queue` table
- Topic format: `{angle}: {product_name}`
- Status: `queued` (ready for auto-posting)
- Linked to selected account

### Frontend Requirements (TODO)

#### 1. **Product List Display**
```html
<div class="product-card">
  <h4>Product Name</h4>
  <p>Description</p>
  <div class="product-actions">
    <button onclick="generateVariations(productId)">
      🎨 Generate 5 Variasi
    </button>
    <button onclick="deleteProduct(productId)">🗑️</button>
  </div>
</div>
```

#### 2. **Generate Variations Modal**
```html
<div class="modal">
  <h3>Generate Variasi Konten</h3>
  <select id="target-account">
    <option>Pilih Akun Target</option>
  </select>
  <input type="range" id="comment-count" min="2" max="7" value="3">
  <button onclick="startGenerate()">Generate</button>
</div>
```

#### 3. **Variations Preview**
```html
<div class="variations-grid">
  <div class="variation-card" data-angle="Problem-Solution">
    <div class="variation-header">
      <span class="angle-badge">Problem-Solution</span>
      <input type="checkbox" checked>
    </div>
    <div class="variation-preview">
      <strong>Main Post:</strong>
      <p>...</p>
      <strong>Comments (3):</strong>
      <ol><li>...</li></ol>
    </div>
  </div>
  <!-- 4 more cards -->
</div>
<button onclick="scheduleSelected()">
  📅 Jadwalkan ke Queue
</button>
```

#### 4. **Progress Indicator**
```html
<div class="generate-progress">
  <div class="progress-bar">
    <div class="progress-fill" style="width: 60%"></div>
  </div>
  <p>Generating variation 3 of 5...</p>
</div>
```

### User Flow:

1. User adds product (name, description, link)
2. Product appears in list
3. Click "Generate 5 Variasi"
4. Modal opens:
   - Select target account
   - Adjust comment count
   - Click generate
5. Loading indicator (5-10 seconds)
6. 5 variations displayed in grid
7. User can:
   - Preview each variation
   - Uncheck unwanted variations
   - Edit individual variations (optional)
8. Click "Jadwalkan ke Queue"
9. Selected variations saved to queue
10. Success message + redirect to /queue

### Benefits:

✅ **Time Saving**: 1 input → 5 konten siap pakai
✅ **Variety**: 5 angle berbeda = reach audience lebih luas
✅ **Consistency**: Semua konten tetap soft-selling & authentic
✅ **Scheduling**: Langsung masuk queue untuk auto-posting
✅ **Flexibility**: Bisa pilih akun mana yang promosi produk ini

### Next Steps:

1. ✅ Backend endpoints ready
2. ✅ GeminiService updated
3. ⏳ Create new affiliate.ejs with layout
4. ⏳ Add product list rendering
5. ⏳ Add generate variations UI
6. ⏳ Add variations preview grid
7. ⏳ Add schedule to queue functionality
8. ⏳ Add loading states & error handling

### API Usage Example:

```javascript
// Generate variations
const response = await fetch('/product/generate-variations', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    product_id: 1,
    comment_count: 3,
    variation_count: 5
  })
});

const { variations } = await response.json();

// Schedule to queue
await fetch('/product/schedule-variations', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    account_id: 2,
    product_id: 1,
    variations: JSON.stringify(variations)
  })
});
```

---

**Status**: Backend complete, ready for frontend implementation
**Estimated Time**: 30-45 minutes for full frontend
