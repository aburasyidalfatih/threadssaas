require('dotenv').config();
const GeminiService = require('./services/gemini');

console.log('🧪 Testing 500 character validation...\n');

(async () => {
  try {
    const content = await GeminiService.generatePostContent(
      'Rahasia produktivitas yang jarang dibahas: istirahat yang berkualitas lebih penting dari kerja keras',
      5
    );
    
    console.log('\n✅ Generated content:\n');
    console.log(`Main post (${content.main_post.length} chars):`);
    console.log(content.main_post);
    console.log('\nComments:');
    content.comments.forEach((comment, idx) => {
      console.log(`\n${idx + 1}. (${comment.length} chars):`);
      console.log(comment);
    });
    
    // Check if any exceed 500
    const tooLong = [];
    if (content.main_post.length > 500) tooLong.push('main_post');
    content.comments.forEach((c, i) => {
      if (c.length > 500) tooLong.push(`comment ${i + 1}`);
    });
    
    if (tooLong.length > 0) {
      console.log('\n❌ FAILED: These exceed 500 chars:', tooLong.join(', '));
    } else {
      console.log('\n✅ SUCCESS: All content under 500 characters!');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
})();
