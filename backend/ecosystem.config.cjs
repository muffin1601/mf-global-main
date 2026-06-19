// PM2 process manager configuration.
//   Start:   pm2 start ecosystem.config.cjs --env production
//   Reload:  pm2 reload crm-api          (zero-downtime rolling restart)
//   Logs:    pm2 logs crm-api
//   Save:    pm2 save && pm2 startup     (persist across reboots)
//
// CommonJS (.cjs) so it loads regardless of "type" in package.json.

module.exports = {
  apps: [
    {
      name: "crm-api",
      script: "server.js",
      cwd: __dirname,

      // --- Cluster mode: one worker per CPU core (override with WEB_CONCURRENCY) ---
      exec_mode: "cluster",
      instances: process.env.WEB_CONCURRENCY || "max",

      // --- Stability / restarts ---
      autorestart: true,
      max_memory_restart: "500M",       // restart a worker if it leaks past 500MB
      exp_backoff_restart_delay: 200,   // back off on crash loops
      min_uptime: "10s",
      max_restarts: 10,

      // --- Graceful shutdown ---
      // Must exceed the app's internal 10s force-exit timer so PM2 lets the
      // worker drain in-flight requests before sending SIGKILL.
      kill_timeout: 11000,
      listen_timeout: 10000,

      // --- Logging (timestamps; PM2 aggregates per worker) ---
      time: true,
      merge_logs: true,
      out_file: "./logs/out.log",
      error_file: "./logs/error.log",

      // PM2 injects NODE_APP_INSTANCE per worker — server.js uses it so only
      // instance 0 runs the cron jobs.
      env: {
        NODE_ENV: "development",
        PORT: 5010,
      },
      env_production: {
        NODE_ENV: "production",
        PORT: 5010,
      },
    },
  ],
};
