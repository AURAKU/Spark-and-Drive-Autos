# Spark and Drive Autos

Premium automotive commerce MVP: inventory, sourcing requests, concierge chat, Paystack payments, orders, and admin operations—built with **Next.js 15 (App Router)**, **TypeScript**, **Tailwind CSS**, **shadcn/ui**, **Prisma**, **PostgreSQL**, and **Auth.js**.

## Prerequisites

- Node.js **20+** (required by Tailwind CSS v4 / tooling; `engines` is set in `package.json`).
- PostgreSQL database (local Docker, Neon, Supabase, Railway, etc.).

### Tailwind native binding (optional dependency)

If `npm run build` fails with “Cannot find native binding” for `@tailwindcss/oxide`, install the platform package explicitly (example for Apple Silicon):

```bash
npm install @tailwindcss/oxide-darwin-arm64 --save-dev
```

Then remove `node_modules` and reinstall if needed.

## Setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Environment**

   ```bash
   cp .env.example .env
   ```

   Edit `.env`: set a strong `AUTH_SECRET` (32+ characters). For local Docker, defaults in `.env.example` match `docker-compose.yml`. Set **`AUTH_URL` and `NEXTAUTH_URL`** to `http://localhost:5173` (must match the address bar exactly). Paystack return URLs use the same origin. Add Paystack / Cloudinary when you need those features.

3. **Database**

   **Option A — Docker (recommended for local):** starts PostgreSQL, applies schema, seeds demo data.

   ```bash
   npm run setup:local
   ```

   Requires [Docker](https://www.docker.com/) with Compose v2 (`docker compose up -d --wait`).

   **Option B — your own Postgres:** point `DATABASE_URL` at your instance, then:

   ```bash
   npx prisma db push
   npm run db:seed
   ```

4. **Run the app**

   ```bash
   npm run dev
   ```

   `npm run dev` first runs `scripts/prep-dev.mjs` (starts Docker Postgres if possible, waits for port **5433**, then `prisma db push`). Docker maps Postgres to **5433** so it does not clash with a local Postgres on 5432. Open [http://localhost:5173](http://localhost:5173).

   To skip that prep (e.g. DB already running): `npm run dev:quick`.

   **If you see “Database not connected”:** Docker must be running, then run `npm run setup:local` once, or `npm run docker:up` and `npx prisma db push && npm run db:seed`.

   **Health check:** `npm run doctor` verifies Docker, TCP to Postgres, Prisma `SELECT 1`, auth secret length, and whether port **5173** is already in use (stale dev server). If the port is busy, run `npm run kill:5173` then `npm run dev` again.

   **Odd build errors** (e.g. “Cannot find module for page”): delete `.next` and run `npm run build` again.

## Demo credentials (development seed only)

- **Admin:** `admin@sparkdriveautos.com` / `DemoAdmin2026!`
- **Customer:** `customer@sparkdriveautos.com` / `DemoUser2026!`

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Prep DB (Docker + `db push`) then dev on **5173** |
| `npm run dev:quick` | Dev on **5173** without prep |
| `npm run docker:up` | Start Postgres container |
| `npm run docker:down` | Stop Postgres container |
| `npm run setup:local` | Docker up + `db push` + seed |
| `npm run build` | Production build |
| `npm run start` | Production server: uses **`PORT`** if set (e.g. cloud), else **5173** (see `scripts/start.mjs`) |
| `npm run db:generate` | Generate Prisma Client |
| `npm run db:push` | Push schema to database (dev) |
| `npm run db:migrate` | Create/apply migrations (dev) |
| `npm run db:seed` | Seed demo data |
| `npm run db:studio` | Open Prisma Studio |
| `npm run doctor` | Local stack check (DB, secrets, port 5173) |

## API summary (high level)

| Area | Endpoint / mechanism |
| --- | --- |
| Auth | `Auth.js` credentials provider — `/api/auth/*` |
| Registration | `POST /api/auth/register` (rate limited) |
| Inquiries | `POST /api/inquiries` (guest + user, Zod validated) |
| Sourcing requests | `POST /api/car-requests` |
| Chat | `POST/GET /api/chat/messages` (guest cookie + user scoped) |
| Payments | `POST /api/payments/initialize` → Paystack hosted checkout |
| Webhooks | `POST /api/webhooks/paystack` (HMAC signature verification) |
| Uploads | `POST /api/upload/cloudinary-signature` (admin-only signed uploads) |
| Cars (admin) | Server action `createCar` in `src/actions/cars.ts` |

## Security notes

- Passwords hashed with **bcrypt**.
- **RBAC** via `UserRole` and `isAdminRole` guard for `/admin/*`.
- **Zod** validation on APIs; plain-text sanitization for user-generated content.
- **Rate limiting** via in-memory buckets (and optional **Upstash Redis** when env vars are set).
- **Paystack** server verification + webhook idempotency safeguards (review webhook handler for your exact event shapes).
- **AuditLog** helper for admin car creation (extend to other mutations).

## Deployment

### Hostinger VPS (step-by-step, first-time)

See **[docs/DEPLOYMENT-HOSTINGER-VPS-FIRST-TIMER.md](docs/DEPLOYMENT-HOSTINGER-VPS-FIRST-TIMER.md)** for a full checklist, beginner commands (Node, Postgres, Nginx, SSL, PM2), and what you must do vs. what lives in code.

Optional PM2 template: `ecosystem.config.example.cjs`.

### Vercel (alternative)

1. Create a Vercel project pointing at this repo.
2. Set environment variables in the Vercel dashboard (match `.env.example`).
3. Provision PostgreSQL (Neon/Supabase/RDS) and set `DATABASE_URL`.
4. Run migrations: `prisma migrate deploy` in CI or Vercel build step (add script if desired).
5. Configure Paystack live keys + webhook URL: `https://YOUR_DOMAIN/api/webhooks/paystack`.
6. Configure Cloudinary folder + upload preset as needed for media workflows.

### Deployment checklist

- [ ] Strong `AUTH_SECRET` in production
- [ ] `AUTH_URL` / `NEXTAUTH_URL` match the **exact** public origin (Server Actions allowlist is derived from these in `next.config.ts`; optional `SERVER_ACTION_ALLOWED_ORIGINS` for extra `host:port` values)
- [ ] `NEXTAUTH_URL` matches canonical domain (if you still use it alongside `AUTH_URL`)
- [ ] Database backups enabled
- [ ] Paystack webhook signing secret verified against live events
- [ ] Cloudinary upload restrictions (size/type) enforced client + server
- [ ] Pusher channels secured (use private channels + auth endpoint when going live)
- [ ] Replace placeholder legal/policy pages
- [ ] Enable observability (OpenTelemetry / Log drains)

## Project structure (abbrev.)

- `src/app/(public)/*` — marketing, inventory, vehicle detail, auth, checkout
- `src/app/dashboard/*` — customer dashboard
- `src/app/admin/*` — operations dashboard
- `src/app/api/*` — route handlers
- `prisma/schema.prisma` — data model
- `src/lib/*` — prisma client, paystack, rate limits, sanitization
- `src/actions/*` — server actions (admin car create)

## License

Proprietary — Spark and Drive Autos. All rights reserved unless otherwise stated.
