/**
 * Runs before `next dev`: Docker Compose + wait for DB port from DATABASE_URL + prisma db push.
 * Always exits 0 so the dev server still starts (warnings only if DB is down).
 */
import { execSync } from "node:child_process";
import { createConnection } from "node:net";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { ensureLocalEnv } from "./ensure-local-env.mjs";

const DEV_PORT = process.env.DEV_PORT || "5173";

/** True if something accepts TCP connections on host:port (e.g. old Next dev server). */
function portInUse(port, host = "127.0.0.1") {
  return new Promise((resolve) => {
    const s = createConnection({ port: Number(port), host }, () => {
      s.end();
      resolve(true);
    });
    s.on("error", () => resolve(false));
  });
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

function readDatabaseUrl() {
  const envPath = path.join(root, ".env");
  if (!fs.existsSync(envPath)) return null;
  const raw = fs.readFileSync(envPath, "utf8");
  for (const line of raw.split("\n")) {
    const m = line.match(/^\s*DATABASE_URL\s*=\s*"?([^"\n]+)"?/);
    if (m) return m[1].trim();
  }
  return process.env.DATABASE_URL ?? null;
}

function parseDbPort(url) {
  if (!url) return { port: "5433", host: "127.0.0.1" };
  try {
    const u = new URL(url);
    const port = u.port || "5432";
    return { port, host: u.hostname };
  } catch {
    return { port: "5433", host: "127.0.0.1" };
  }
}

function waitPort(port, host = "127.0.0.1", timeoutMs = 20000) {
  return new Promise((resolve, reject) => {
    const t0 = Date.now();
    const h = host === "localhost" ? "127.0.0.1" : host;
    const attempt = () => {
      const s = createConnection({ port: Number(port), host: h }, () => {
        s.end();
        resolve();
      });
      s.on("error", () => {
        s.destroy();
        if (Date.now() - t0 > timeoutMs) {
          reject(new Error(`Timeout waiting for ${h}:${port}`));
        } else {
          setTimeout(attempt, 400);
        }
      });
    };
    attempt();
  });
}

async function pushDbWithRetry() {
  for (let i = 0; i < 3; i++) {
    try {
      execSync("npx prisma db push", { cwd: root, stdio: "inherit" });
      return;
    } catch {
      if (i === 2) throw new Error("prisma db push failed after 3 attempts");
      console.warn("[prep-dev] prisma db push failed, retrying in 2s…\n");
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
}

async function main() {
  ensureLocalEnv();

  if (await portInUse(DEV_PORT)) {
    console.log(`[prep-dev] Port ${DEV_PORT} is in use — releasing it for Next.js (stale dev server)…`);
    try {
      execSync(`node "${path.join(__dirname, "kill-port.mjs")}" ${DEV_PORT}`, { stdio: "inherit" });
    } catch {
      console.warn(`[prep-dev] Could not free :${DEV_PORT}. Run: npm run kill:5173\n`);
    }
    console.log("");
  }

  let dockerCli = false;
  try {
    execSync("docker info", { stdio: "pipe" });
    dockerCli = true;
  } catch {
    console.warn(
      "\n[prep-dev] Docker CLI not found. Use a running PostgreSQL and a correct DATABASE_URL in .env.\n"
    );
  }

  if (dockerCli) {
    try {
      execSync("docker compose up -d --wait", { cwd: root, stdio: "inherit" });
      console.log("[prep-dev] Docker Compose services are up.\n");
    } catch (e) {
      console.warn("[prep-dev] docker compose failed:", e?.message || e, "\n");
    }
  }

  const dbUrl = readDatabaseUrl();
  const { port, host } = parseDbPort(dbUrl);
  const tcpHost = !host || host === "localhost" ? "127.0.0.1" : host;
  console.log(`[prep-dev] Waiting for Postgres at ${tcpHost}:${port} (from DATABASE_URL)…`);

  try {
    await waitPort(port, tcpHost);
    console.log(`[prep-dev] Port ${port} is accepting connections.\n`);
  } catch {
    console.warn(
      `[prep-dev] Nothing on ${port} — start Docker (\`npm run docker:up\`) or fix DATABASE_URL in .env\n`
    );
  }

  try {
    await pushDbWithRetry();
    console.log("[prep-dev] Prisma schema applied (db push).\n");
  } catch (e) {
    console.warn("[prep-dev] prisma db push failed:", e?.message || e, "\n");
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.warn("[prep-dev]", e);
    process.exit(0);
  });
