const path = require('node:path');

module.exports = {
  apps: [
    {
      name: 'yd-ai-bff',
      cwd: __dirname,
      script: path.join(__dirname, 'dist', 'app.js'), // 使用构建后的 JS 文件
      interpreter: process.execPath,

      // 实例配置 - 使用所有 CPU 核心
      instances: 'max', // 自动使用所有 CPU 核数
      exec_mode: 'cluster', // 集群模式，充分利用多核 CPU

      // 生产环境使用编译后的 JS，不需要 ts-node
      // interpreter: './node_modules/.bin/ts-node',
      // interpreter_args: '--transpile-only',

      // 自动重启配置
      autorestart: true,
      max_restarts: 10, // 最大重启次数，防止无限重启
      min_uptime: '10s', // 最小运行时间，避免频繁重启
      max_memory_restart: '500M', // 内存超过 500M 自动重启，防止内存泄漏

      // 监听文件变化（仅开发环境）
      watch: false, // 生产环境不应该 watch
      watch_delay: 1000,
      ignore_watch: ['node_modules', 'logs', 'dist', '.git'],

      // 环境变量
      env: {
        NODE_ENV: 'development',
        TS_NODE_PROJECT: './tsconfig.json',
        PORT: 8081, // cluster 模式会自动递增
      },
      env_production: {
        NODE_ENV: 'production',
        TS_NODE_PROJECT: './tsconfig.json',
        PORT: 8082, // cluster 模式会自动递增
      },

      // 日志配置
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      log_file: './logs/pm2-combined.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      time: true, // 在日志中显示时间戳

      // 零停机重载配置 - 生产环境热更新核心
      kill_timeout: 5000, // 5 秒内优雅关闭，超时则强制杀死
      wait_ready: false, // ts-node 在集群模式下 process.send 可能不工作，禁用 wait_ready
      listen_timeout: 10000, // 等待应用监听端口的超时时间
      shutdown_with_message: true, // 支持 shutdown 消息
      kill_retry_time: 100, // 重试间隔

      // 其他优化
      combine_logs: true, // 合并多个实例的日志
      merge_logs: true,
      increment_var: 'PORT', // 每个实例自动递增的环境变量
    },
  ],
};
