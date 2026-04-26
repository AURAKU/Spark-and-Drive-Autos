# Spark & Drive Autos Production Deployment (Hostinger VPS)

## 1) VPS requirements
- Node.js `20+`
- npm `10+`
- PostgreSQL `14+` (local VPS service or managed DB)
- PM2 (recommended) or Docker
- HTTPS reverse proxy (Nginx + Certbot)

## 2) Environment setup
1. Copy `.env.production.example` to `.env.production` (or `.env` on server).
2. Fill all required production keys.
3. Keep OAuth (`AUTH_GOOGLE_*`, `AUTH_APPLE_*`) and AI keys optional.
4. Never commit real secrets.

## 3) Install and deploy commands
```bash
npm install
npx prisma generate
npx prisma migrate deploy
npm run build
npm run start
```

## 4) Super admin seed
Set:
- `SEED_SUPER_ADMIN_EMAIL`
- `SEED_SUPER_ADMIN_PASSWORD`
- `SEED_SUPER_ADMIN_NAME`

Then run:
```bash
npm run seed:admin
```

Safe behavior:
- creates super admin if missing
- updates existing user to `SUPER_ADMIN` if found
- idempotent, no destructive deletes

## 5) PM2 production setup
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

## 6) Optional Docker flow
- Build app image and run with environment-injected secrets.
- Ensure `DATABASE_URL` points to reachable production PostgreSQL.

## 7) Provider/webhook setup
- Paystack webhook URL: `https://YOUR_DOMAIN/api/webhooks/paystack`
- Paystack callback URLs should resolve from `AUTH_URL` / `NEXTAUTH_URL`.
- Verify webhook signing secret is configured.
- Google OAuth (if enabled):
  - Authorized JavaScript origins:
    - `http://localhost:5173`
    - `https://www.sparkanddriveautos.com`
  - Authorized redirect URIs:
    - `http://localhost:5173/api/auth/callback/google`
    - `https://www.sparkanddriveautos.com/api/auth/callback/google`

## 8) Email and media
- Verify Resend domain/sender for `RESET_PASSWORD_FROM_EMAIL`.
- Verify Cloudinary credentials and signed upload paths.

## 9) Redis notes
- Use valid Upstash REST URL (`https://...`) and token.
- If Redis is misconfigured, app falls back to in-memory rate limiting (non-crashing).

## 10) Hostinger DB note
- Use a production PostgreSQL `DATABASE_URL`.
- Do not ship a local `127.0.0.1` URL unless PostgreSQL runs on the same VPS and is reachable by the app process.

## 11) Readiness checks
- Admin health endpoint: `/api/admin/health/readiness`
- Paystack readiness endpoint: `/api/admin/providers/paystack/readiness`
