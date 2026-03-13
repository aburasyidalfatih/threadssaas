const fetch = require('node-fetch');
const db = require('../config/database');

class GeminiService {
  static getApiKey() {
    const row = db.prepare("SELECT value FROM settings WHERE key = 'gemini_api_key'").get();
    return row?.value || process.env.GEMINI_API_KEY || '';
  }

  static getModel() {
    const row = db.prepare("SELECT value FROM settings WHERE key = 'gemini_model'").get();
    return row?.value || 'gemini-2.0-flash';
  }

  /**
   * Call Gemini API
   */
  static async callGemini(prompt) {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error('Gemini API key not configured. Please set it in Settings.');
    }

    const model = this.getModel();
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          temperature: 0.9,
          topP: 0.95,
          maxOutputTokens: 8192
        }
      })
    });

    const data = await response.json();

    if (data.error) {
      console.error('[Gemini] API Error:', JSON.stringify(data.error, null, 2));
      throw new Error(`Gemini API error: ${data.error.message}`);
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      console.error('[Gemini] Empty response:', JSON.stringify(data, null, 2));
      throw new Error('Gemini returned empty response');
    }

    return text;
  }

  /**
   * Generate main post + follow-up comments for a topic
   */
  static async generatePostContent(topic, commentCount = 3, themeDescription = '') {
    // Get custom prompt from settings
    const customPrompt = db.prepare("SELECT value FROM settings WHERE key = 'prompt_organic'").get();
    
    let prompt;
    if (customPrompt?.value) {
      // Use custom prompt with placeholders
      prompt = customPrompt.value
        .replace(/{topic}/g, topic)
        .replace(/{comment_count}/g, commentCount)
        .replace(/{theme_description}/g, themeDescription || '');
    } else {
      // Use default prompt (optimized for 2026 viral structure)
      const themeNote = themeDescription ? `\n\nCatatan tambahan: ${themeDescription}` : '';
      
      // Generate comment sections based on commentCount
      let commentSections = '';
      if (commentCount >= 1) commentSections += `\n2. KOMENTAR 1 - Context & Credibility:\n   - Jelaskan kenapa topik ini penting\n   - Tambahkan relatable pain point atau data spesifik\n   - Bangun interest untuk lanjut baca`;
      if (commentCount >= 2) commentSections += `\n\n3. KOMENTAR 2 - Core Value:\n   - Deliver insight utama atau solusi konkret\n   - Gunakan contoh spesifik atau pengalaman personal\n   - Paragraf pendek (max 2-3 kalimat)`;
      if (commentCount >= 3) commentSections += `\n\n4. KOMENTAR 3 - CTA & Engagement:\n   - Personal touch atau hot take\n   - AKHIRI dengan pertanyaan spesifik untuk engagement\n   - Buat pertanyaan yang mudah dan fun dijawab`;
      if (commentCount >= 4) commentSections += `\n\n5. KOMENTAR 4 - Deep Dive:\n   - Tambahkan perspektif atau data yang lebih mendalam\n   - Bisa berupa tips praktis atau insight eksklusif\n   - Maintain conversational tone`;
      if (commentCount >= 5) commentSections += `\n\n6. KOMENTAR 5 - Closing & Reflection:\n   - Wrap up dengan insight final atau call-to-action\n   - Bisa berupa motivasi atau challenge untuk audience\n   - Buat memorable ending`;
      
      prompt = `Kamu adalah content creator Threads yang viral dengan engagement tinggi di 2026.

Buatkan thread tentang: "${topic}"${themeNote}

STRUKTUR THREAD (AIDA):

1. MAIN POST (300-400 karakter):
   - HOOK KUAT: Mulai dengan salah satu formula ini:
     * Specific number: "Saya habiskan [angka spesifik] jam testing X..."
     * Counterintuitive: "Kebanyakan orang salah tentang X. Ini yang sebenarnya..."
     * Bold claim: "[Hal populer] overrated. Ini alternatif yang lebih baik..."
     * Story opener: "[Waktu lalu] saya hampir [gagal]. Satu hal mengubah segalanya..."
     * Direct callout: "Kalau kamu masih [kesalahan umum], baca ini..."
   - Buat knowledge gap (penasaran tapi belum kasih solusi)
   - Gunakan line break untuk readability
   - Front-load value di 3 baris pertama
${commentSections}

ATURAN KETAT:
- Bahasa Indonesia casual, conversational, authentic (bukan corporate)
- Line break setiap 2-3 kalimat untuk white space
- Emoji: 1-2 per post MAX (jangan berlebihan)
- Target 300-400 karakter per post (max 500)
- NO hashtag, NO clickbait berlebihan
- Fokus conversation over broadcasting
- Authenticity over polish

Format output (JSON):
{
  "main_post": "...",
  "comments": [${Array(commentCount).fill('"..."').join(', ')}]
}

PENTING: Output HANYA JSON, tanpa markdown atau teks tambahan.`;
    }

    const result = await this.callGemini(prompt);
    return this.parseJsonResponse(result);
  }

  /**
   * Generate affiliate promotion content
   */
  static async generateAffiliateContent(productName, description, affiliateLink, commentCount = 3, angle = null) {
    // Get custom prompt from settings
    const customPrompt = db.prepare("SELECT value FROM settings WHERE key = 'prompt_affiliate'").get();
    
    let prompt;
    if (customPrompt?.value) {
      // Use custom prompt with placeholders
      prompt = customPrompt.value
        .replace(/{product_name}/g, productName)
        .replace(/{description}/g, description)
        .replace(/{affiliate_link}/g, affiliateLink)
        .replace(/{comment_count}/g, commentCount);
      
      if (angle) {
        prompt += `\n\nGUNAKAN ANGLE INI: ${angle}`;
      }
    } else {
      // Use default prompt with angle support
      const angleInstruction = angle ? `\n\nWAJIB GUNAKAN ANGLE INI: ${angle}\nSesuaikan hook, storytelling, dan CTA dengan angle tersebut.` : '';
      
      prompt = `Kamu adalah content creator Threads yang ahli soft-selling dengan engagement tinggi di 2026.

Buatkan thread promosi untuk produk affiliate:
- Nama Produk: ${productName}
- Deskripsi: ${description}
- Link Affiliate: ${affiliateLink}${angleInstruction}

STRUKTUR THREAD AFFILIATE (AIDA):

1. MAIN POST (300-400 karakter):
   - HOOK SOFT-SELLING: Gunakan formula ini:
     * Story opener: "Kemarin temen nanya kenapa [hasil]. Jawabannya simpel..."
     * Transformation: "Dulu saya [masalah]. Sekarang [hasil]. Yang berubah:"
     * Relatable pain: "Pernah nggak sih [masalah yang relate]? Gue juga gitu..."
     * Counterintuitive: "Kebanyakan orang beli [produk mahal]. Padahal ada yang lebih worth it..."
   - JANGAN sebut produk/brand di main post
   - Buat penasaran dengan hasil/benefit, bukan produk
   - Line break untuk readability

2. KOMENTAR 1 - Build Desire:
   - Ceritakan pengalaman personal atau review jujur
   - Fokus ke PROBLEM yang dipecahkan, bukan fitur produk
   - Relatable & authentic (bukan sales pitch)

3. KOMENTAR 2 - Reveal Product + Link:
   - Baru sebutkan nama produk dengan natural
   - Jelaskan 1-2 benefit spesifik (bukan list panjang)
   - Sisipkan link affiliate dengan cara natural: "Kalau mau cek: [link]"
   - Jangan hard selling

4. KOMENTAR 3 - Social Proof & CTA:
   - Tambahkan social proof ringan atau personal insight
   - CTA soft: "Ada yang udah pernah coba? Share pengalaman kalian dong"
   - Pertanyaan untuk engagement

ATURAN KETAT:
- Bahasa Indonesia casual, authentic, conversational
- NO hard selling, NO "beli sekarang", NO urgency fake
- Storytelling & soft-selling approach
- Line break setiap 2-3 kalimat
- Emoji: 1-2 per post MAX
- Target 300-400 karakter per post (max 500)
- NO hashtag
- Authenticity > sales pitch

Format output (JSON):
{
  "main_post": "...",
  "comments": ["...", "...", "..."]
}

PENTING: Output HANYA JSON, tanpa markdown atau teks tambahan.`;
    }

    const result = await this.callGemini(prompt);
    return this.parseJsonResponse(result);
  }

  /**
   * Generate auto-reply for incoming comment
   */
  static async generateReply(originalComment, postContext, style = 'friendly') {
    // Get custom prompt from settings
    const customPrompt = db.prepare("SELECT value FROM settings WHERE key = 'prompt_reply'").get();
    
    const styleGuide = {
      friendly: 'ramah, hangat, dan supportive',
      witty: 'cerdas, lucu, dan sedikit sarcastic',
      professional: 'sopan, informatif, dan profesional',
      casual: 'santai, gaul, dan relatable'
    };
    
    let prompt;
    if (customPrompt?.value) {
      // Use custom prompt with placeholders
      prompt = customPrompt.value
        .replace(/{post_context}/g, postContext)
        .replace(/{comment}/g, originalComment)
        .replace(/{style}/g, styleGuide[style] || styleGuide.friendly);
    } else {
      // Use default prompt (optimized for 2026 engagement)
      prompt = `Kamu adalah pemilik akun Threads yang membalas komentar dengan engagement tinggi di 2026.

Konteks postingan: "${postContext}"
Komentar yang perlu dibalas: "${originalComment}"

ATURAN REPLY VIRAL 2026:

1. GAYA REPLY: ${styleGuide[style] || styleGuide.friendly}

2. STRUKTUR REPLY:
   - Acknowledge komentar mereka (validasi/apresiasi)
   - Tambahkan value baru (insight/perspektif/pertanyaan balik)
   - Buat conversational (bukan robotic)

3. TEKNIK ENGAGEMENT:
   - Gunakan "kamu/lo/kalian" untuk personal connection
   - Kalau mereka bertanya, jawab spesifik + tanya balik
   - Kalau mereka share pengalaman, relate + tambahkan insight
   - Kalau mereka setuju, deepen conversation dengan pertanyaan
   - Kalau mereka tidak setuju, acknowledge + share perspektif lain

4. ATURAN KETAT:
   - Max 150 karakter (singkat & padat)
   - Bahasa Indonesia casual & authentic
   - NO template/robotic response
   - NO emoji berlebihan (max 1)
   - Fokus: continue conversation, bukan close it

CONTOH GOOD REPLY:
- "Setuju banget! Gue juga pernah ngalamin ini. Btw, udah coba [alternatif]?"
- "Nah ini! Banyak yang skip bagian ini padahal penting. Kamu biasanya gimana?"
- "Interesting take! Gue lihat dari angle berbeda sih. Menurutmu [pertanyaan]?"

Output: HANYA teks reply, tanpa tanda kutip atau format tambahan.`;
    }

    const result = await this.callGemini(prompt);
    return result.replace(/^["']|["']$/g, '').trim();
  }

  /**
   * Parse JSON from Gemini response, handling markdown code blocks
   */
  static parseJsonResponse(text) {
    console.log('[Gemini] Raw response:', text.substring(0, 300));
    
    // Remove markdown code blocks if present
    let cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    console.log('[Gemini] Cleaned response:', cleaned.substring(0, 300));

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (e) {
      // Try to extract JSON from text
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          parsed = JSON.parse(jsonMatch[0]);
        } catch (e2) {
          // If parsing still fails, return partial response with default comments
          console.warn('[Gemini] Partial response detected, using fallback comments');
          try {
            const partial = JSON.parse(jsonMatch[0] + ']}');
            if (partial.main_post && !partial.comments) {
              partial.comments = [
                'Ini adalah insight pertama yang penting untuk dipahami.',
                'Lanjutkan dengan perspektif yang lebih mendalam tentang topik ini.',
                'Kesimpulannya, hal ini memiliki dampak signifikan dalam kehidupan sehari-hari.'
              ];
            }
            parsed = partial;
          } catch (e3) {
            throw new Error(`Failed to parse Gemini response as JSON: ${text.substring(0, 200)}`);
          }
        }
      } else {
        throw new Error(`No valid JSON found in Gemini response: ${text.substring(0, 200)}`);
      }
    }

    // Validate and truncate content to 500 characters max
    if (parsed.main_post && parsed.main_post.length > 500) {
      console.warn(`[Gemini] Main post too long (${parsed.main_post.length} chars), truncating to 497...`);
      parsed.main_post = parsed.main_post.substring(0, 497) + '...';
    }

    if (parsed.comments && Array.isArray(parsed.comments)) {
      parsed.comments = parsed.comments.map((comment, idx) => {
        if (comment.length > 500) {
          console.warn(`[Gemini] Comment ${idx + 1} too long (${comment.length} chars), truncating to 497...`);
          return comment.substring(0, 497) + '...';
        }
        return comment;
      });
    }

    return parsed;
  }
}

module.exports = GeminiService;
