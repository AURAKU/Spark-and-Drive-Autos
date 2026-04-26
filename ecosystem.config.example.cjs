/**
 * PM2 example for Hostinger VPS (or any Linux server).
 *
 * Usage:
 *   cp ecosystem.config.example.cjs ecosystem.config.cjs
 *   # Edit cwd, env vars; do not commit real secrets.
 *   pm2 start ecosystem.config.cjs
 *   pm2 save && pm2 startup
 *
 * Prefer setting secrets via the server's environment or `pm2 ecosystem` + `--env production`
 * instead of committing ecosystem.config.cjs with passwords.
 */
module.exports = {
  apps: [
    {
      name: "spark-drive",
      cwd: "/var/www/spark-drive",
      script: "npm",
      args: "run start",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
        PORT: "3000",
        // Set these on the server (export before pm2, or use env_production below):
        // AUTH_URL: "https://yourdomain.com",
        // NEXTAUTH_URL: "https://yourdomain.com",
        // DATABASE_URL: "postgresql://user:pass@127.0.0.1:5432/sparkdrive?schema=public",
      },
    },
    {
      name: "spark-drive-worker",
      cwd: "/var/www/spark-drive",
      script: "npm",
      args: "run worker:parts-finder",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
