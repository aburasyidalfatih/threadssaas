module.exports = {
  apps: [{
    name: 'threadsbot',
    script: 'server.js',
    cwd: '/home/ubuntu/threadsbot',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production'
    },
    error_file: '/home/ubuntu/threadsbot/logs/pm2-error.log',
    out_file: '/home/ubuntu/threadsbot/logs/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    merge_logs: true,
    // Auto restart on crash
    min_uptime: '10s',
    max_restarts: 10,
    // Cron restart (optional - restart daily at 3AM)
    cron_restart: '0 3 * * *'
  }]
};
