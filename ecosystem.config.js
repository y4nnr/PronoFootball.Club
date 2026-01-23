module.exports = {
  apps: [
    {
      name: 'toopil-nextjs',
      script: 'npm',
      args: 'start',
      cwd: '/root/dev/PronoFootball.Club',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s'
    },
    {
      name: 'live-scores-updater',
      script: 'bash',
      args: '-c "while true; do curl -s -X POST http://localhost:3000/api/update-live-scores && curl -s -X POST http://localhost:3000/api/update-live-scores-rugby && sleep 3 && curl -s -X POST http://localhost:3000/api/trigger-frontend-refresh && sleep 17; done"',
      cwd: '/root/dev/PronoFootball.Club',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production'
      },
      error_file: './logs/live-scores-error.log',
      out_file: './logs/live-scores-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s'
    },
    {
      name: 'game-status-worker',
      script: 'scripts/game-status-worker.js',
      cwd: '/root/dev/PronoFootball.Club',
      instances: 1,
      exec_mode: 'fork',
      interpreter: 'node',
      env: {
        NODE_ENV: 'production'
      },
      error_file: './logs/game-status-error.log',
      out_file: './logs/game-status-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s'
    }
  ]
};
