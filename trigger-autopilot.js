require('dotenv').config();
const db = require('./config/database');
const AutoPilotService = require('./services/autopilot');

console.log('🚀 Triggering AutoPilot manually...\n');

AutoPilotService.runAutoPilot()
  .then(() => {
    console.log('\n✅ AutoPilot execution completed');
    db.close();
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ AutoPilot failed:', error);
    db.close();
    process.exit(1);
  });
