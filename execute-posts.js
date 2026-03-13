require('dotenv').config();
const db = require('./config/database');
const SchedulerService = require('./services/scheduler');

console.log('🚀 Executing pending posts...\n');

const posts = db.prepare("SELECT id FROM posts WHERE status = 'scheduled' AND id >= 25").all();

console.log(`Found ${posts.length} posts to execute\n`);

(async () => {
  for (const post of posts) {
    console.log(`Executing post ${post.id}...`);
    await SchedulerService.executePost(post.id);
    console.log(`Post ${post.id} done\n`);
  }
  
  console.log('✅ All posts executed');
  db.close();
  process.exit(0);
})();
