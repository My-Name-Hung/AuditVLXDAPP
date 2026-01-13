// PM2 Ecosystem Configuration Example
// Copy this file to ecosystem.config.js and customize for your production environment

module.exports = {
  apps: [{
    name: 'auditapp-backend',
    script: './index.js',
    instances: 1,  // Số lượng instances (1 cho single server, 'max' cho cluster mode)
    exec_mode: 'fork',  // 'fork' hoặc 'cluster'
    
    // Environment variables
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    
    // Logging
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    
    // Auto restart
    autorestart: true,
    watch: false,  // Set true để auto restart khi file thay đổi (chỉ dùng cho development)
    
    // Memory management
    max_memory_restart: '1G',  // Restart nếu vượt quá 1GB RAM
    
    // Advanced options
    min_uptime: '10s',  // Minimum uptime để coi là stable
    max_restarts: 10,  // Maximum restarts trong khoảng thời gian
    restart_delay: 4000,  // Delay giữa các lần restart (ms)
    
    // Graceful shutdown
    kill_timeout: 5000,  // Thời gian chờ trước khi force kill (ms)
    wait_ready: true,  // Chờ app emit 'ready' event
    listen_timeout: 10000  // Timeout cho listen event
  }]
};

