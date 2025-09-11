module.exports = {
  apps: [
    {
      name: 'aigentz',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3005',
      instances: 'max',
      exec_mode: 'cluster',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'development',
      },
      env_production: {
        NODE_ENV: 'production',
      },
      log_date_format: 'YYYY-MM-DD HH:mm Z',
      error_file: 'logs/error.log',
      out_file: 'logs/out.log',
      merge_logs: true,
      log_type: 'json',
    },
  ],
};

// Create logs directory if it doesn't exist
const fs = require('fs');
if (!fs.existsSync('logs')) {
  fs.mkdirSync('logs');
}
