# Go live on Hostinger VPS (first-time checklist & steps)

This guide assumes you have **never** bought a domain or VPS before. Work top to bottom; check boxes as you finish.

---

## Part A — What is still missing before you are “live”

Use this as your **master checklist**. Some items only you can do (accounts, payments, DNS). Some are already handled in code or docs.

### A1. Accounts & billing (you only)

- [ ] **GitHub account** and a **repository** that holds this project (private is fine).
- [ ] **Hostinger account**.
- [ ] **VPS plan** purchased (Linux VPS; note the server **IP address** and **root** or **SSH** password/key Hostinger emails you).
- [ ] **Domain** registered (can be at Hostinger or elsewhere). You will **point DNS** at the VPS IP later.

### A2. Server software (you on the VPS; commands in Part C)

- [ ] **Ubuntu** (or similar) updated; **SSH** access works from your computer.
- [ ] **Node.js 20+** installed.
- [ ] **PostgreSQL** running (same VPS or a managed DB) and a database + user created.
- [ ] **Nginx** installed as reverse proxy.
- [ ] **HTTPS** (Let’s Encrypt / Certbot) so `https://yourdomain.com` works.
- [ ] **PM2** (or systemd) so the app **restarts** after reboot or crash.
- [ ] **Firewall**: ports **80** and **443** open; database **not** exposed to the public internet unless you know you need that.

### A3. Application configuration (you + env file on server)

- [ ] **`.env` on the server** (never commit it). Copy from `.env.example` and fill every value for production.
- [ ] **`AUTH_SECRET`** and **`NEXTAUTH_SECRET`**: long random strings (e.g. `openssl rand -base64 32`).
- [ ] **`AUTH_URL`** and **`NEXTAUTH_URL`**: exactly your public site, e.g. `https://yourdomain.com` (no trailing slash; use **https**).
- [ ] **`DATABASE_URL`**: points to production Postgres (correct user, password, host, port, database name).
- [ ] **Build on server** runs **after** production `AUTH_URL` is set (Server Actions allowlist is set at **build** time in `next.config.ts`).

### A4. Third-party services (you in each dashboard)

- [ ] **Paystack**: **live** secret + public keys; **webhook URL** set to  
  `https://yourdomain.com/api/webhooks/paystack`  
  (use the exact path your app exposes; test webhook after go-live).
- [ ] **Google OAuth** (if used): production **authorized redirect URI**  
  `https://yourdomain.com/api/auth/callback/google`
- [ ] **Apple OAuth** (if used): production callback **https** URL matching `AUTH_URL`.
- [ ] **Cloudinary**: production cloud name + keys; upload flows tested.
- [ ] **Pusher** (if you use live chat): app keys; ensure private channel auth still works over HTTPS.
- [ ] **Upstash Redis** (optional): REST URL + token if you want distributed rate limits.

### A5. Database schema (you run commands; we maintain Prisma files)

- [ ] On the server, after first deploy: `npx prisma migrate deploy`  
  (Use migrations for production; avoid `db push` on production unless you intentionally have no migration history.)
- [ ] **Backups**: schedule Postgres dumps or use host backup tools.

### A6. Security & content (ongoing)

- [ ] **Do not use** seed demo passwords in production; seed only for dev/staging if at all.
- [ ] Review **legal / policy** copy if placeholders are still generic (see README security/deployment notes).
- [ ] **Remove** any test API keys from Paystack/Cloudinary before announcing the site.

### A7. Already addressed in this repo (verify, don’t redo)

- [x] **Receipt PDF logos** load from `public/brand/` only (no developer-machine paths) — safe on VPS.
- [x] **`.gitignore`** excludes `.env` so secrets are not pushed to GitHub by mistake.

---

## Part B — Who does what

| Task | You (human) | Assistant / developer (this repo) |
|------|----------------|-------------------------------------|
| Buy domain, VPS, GitHub | Yes | No |
| SSH into server, install Node, Postgres, Nginx, Certbot, PM2 | Yes | No |
| Create DNS A record pointing domain → VPS IP | Yes | No |
| Create `.env` on server with real secrets | Yes | No (you paste secrets) |
| Paystack / Google / Apple / Cloudinary dashboards | Yes | No |
| `git pull`, `npm ci`, `prisma migrate deploy`, `npm run build`, PM2 restart | You run on server | Can give exact commands |
| Fix app bugs, paths, docs, config in the codebase | Optional | Yes (e.g. receipt logos, this guide) |

**I cannot:** log into Hostinger, GitHub, Paystack, or your VPS; run commands on your machine without you executing them; create SSL certificates on your server; know your final domain until you choose it.

**You must:** complete every row where “You” is Yes for go-live.

---

## Part C — Step-by-step (first timer)

### Phase 1 — GitHub (before the server)

1. Install **Git** on your Mac (if needed): [https://git-scm.com](https://git-scm.com)
2. Create a **new repository** on GitHub (empty or with README — you can push this project).
3. On your computer, in the project folder:

 ```bash
   git remote add origin https://github.com/YOUR_USER/YOUR_REPO.git
   git branch -M main
   git add -A
   git commit -m "Initial commit"
   git push -u origin main
   ```

4. Confirm on GitHub.com that files appear. **Never** commit `.env` (it is gitignored).

### Phase 2 — Hostinger: domain + VPS

1. Log into **Hostinger** → purchase a **VPS** (note **IP address**).
2. Purchase or connect a **domain** (same panel or another registrar).
3. In Hostinger **VPS** panel, note how to open **SSH** (username `root` or `ubuntu`, password or SSH key).

### Phase 3 — DNS (so the name reaches your server)

1. Open **DNS / nameservers** for your domain.
2. Add an **A record**:
   - **Host / Name:** `@` (or blank, depending on panel) → **points to** your VPS **IP**.
   - Optional: **www** → same IP, or a **CNAME** from `www` to `@`.
3. Wait **5 minutes to 48 hours** for propagation (often under an hour).   Check with: `ping yourdomain.com` (should show the VPS IP).

### Phase 4 — First login to the VPS (from your Mac Terminal)

```bash
ssh root@YOUR_VPS_IP
```

(Use the user Hostinger gave you if not `root`.) Accept the host key when asked.

### Phase 5 — Install basics on the VPS (Ubuntu-style commands)

```bash
apt update && apt upgrade -y
apt install -y curl git nginx
```

Install **Node 20** (example using NodeSource — follow current docs if this changes):

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
node -v   # should show v20.x or higher
```

Install **PM2**:

```bash
npm install -g pm2
```

Install **PostgreSQL**:

```bash
apt install -y postgresql postgresql-contrib
```

Create DB user and database (replace passwords):

```bash
sudo -u postgres psql -c "CREATE USER sparkprod WITH PASSWORD 'YOUR_STRONG_PASSWORD';"
sudo -u postgres psql -c "CREATE DATABASE sparkdrive OWNER sparkprod;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE sparkdrive TO sparkprod;"
```

Your production `DATABASE_URL` will look like:

`postgresql://sparkprod:YOUR_STRONG_PASSWORD@127.0.0.1:5432/sparkdrive?schema=public`

### Phase 6 — Deploy the app from GitHub

```bash
mkdir -p /var/www
cd /var/www
git clone https://github.com/YOUR_USER/YOUR_REPO.git spark-drive
cd spark-drive
```

Create **`.env`** on the server (use `nano .env`):

- Paste from `.env.example` and replace **every** placeholder.
- **Critical:** `AUTH_URL=https://yourdomain.com` and `NEXTAUTH_URL=https://yourdomain.com` **before** build.

Install and build:

```bash
npm ci
npx prisma migrate deploy
npm run build
```

Start with PM2 (example port **3000** behind Nginx):

```bash
PORT=3000 pm2 start npm --name spark-drive -- start
pm2 save
pm2 startup
```

(Run the command `pm2 startup` prints so PM2 survives reboot.)

### Phase 7 — Nginx + HTTPS

Create a site file (replace `yourdomain.com`):

```bash
nano /etc/nginx/sites-available/spark-drive
```

Minimal reverse proxy:

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable and reload:

```bash
ln -s /etc/nginx/sites-available/spark-drive /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

Install **Certbot** and HTTPS:

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

After HTTPS works, confirm **`AUTH_URL`** is `https://...` and **rebuild**:

```bash
cd /var/www/spark-drive
nano .env   # fix AUTH_URL to https if needed
npm run build
pm2 restart spark-drive
```

### Phase 8 — Paystack & OAuth

1. Paystack dashboard → **live keys** in `.env`.
2. Webhook URL: `https://yourdomain.com/api/webhooks/paystack`.
3. Google Cloud Console → OAuth client → add authorized redirect for production.
4. Test a **small real payment** in live mode if possible.

### Phase 9 — Updates later

```bash
cd /var/www/spark-drive
git pull
npm ci
npx prisma migrate deploy
npm run build
pm2 restart spark-drive
```

---

## Part D — Optional: PM2 config file

Copy `ecosystem.config.example.cjs` to `ecosystem.config.cjs`, edit paths and env, then:

`pm2 start ecosystem.config.cjs`

(Keep `ecosystem.config.cjs` out of git if it embeds secrets, or use `pm2 start` with `--env production` and inject vars on the server only.)

---

## When you can say “done”

You are **done** when:

1. `https://yourdomain.com` loads your site with a **padlock** (valid SSL).
2. You can **register / log in** (and Google/Apple if enabled).
3. **Database** persists data after PM2 restart.
4. **Paystack** webhook fires (check Paystack dashboard logs) and orders/payments behave correctly.
5. You have a **backup** plan for the database.

If you want the next refinement, we can add a **single `DEPLOY_CHECKLIST.md`** in the repo root that only lists checkboxes (short), linking here for the long guide.
