/**
 * Production: run a successful build before start — e.g.
 *   npm ci && npx prisma migrate deploy && npm run build && pm2 startOrReload ecosystem.config.js
 * `npm start` runs env validation then `next start` (serves `.next` from the prior build).
 */
module.exports = {
  apps: [
    {
      name: "spark-drive-autos",
      script: "npm",
      args: "start",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
