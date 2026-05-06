module.exports = {
  apps: [
    {
      name: 'jt808',
      script: './index.js',
      cwd: '/root/jt808-server',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '200M',
      restart_delay: 3000,
      env: {
        NODE_ENV: 'production',
        PORT: 8808,
        SUPABASE_URL: 'https://rwjbladqwubgjotlygyy.supabase.co',
        SUPABASE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ3amJsYWRxd3ViZ2pvdGx5Z3l5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE2OTc5NTksImV4cCI6MjA1NzI3Mzk1OX0.ePBRQCFfMDuqHHMnJViBXHLPbvFjVbcqp5-KeKnFJgQ',
      },
      error_file: '/root/logs/jt808-error.log',
      out_file: '/root/logs/jt808-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};
