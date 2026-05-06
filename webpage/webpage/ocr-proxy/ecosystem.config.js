module.exports = {
  apps: [
    {
      name: 'ocr-proxy',
      script: './server.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production',
      },
      error_file: '/root/logs/ocr-proxy-error.log',
      out_file: '/root/logs/ocr-proxy-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
    },
  ],
};
