/**
 * Local stack health check: Docker, TCP to DB, Prisma query, secrets, port 5173.
 * Run: npm run doctor
 */
import { execSync } from "node:child_process";
import { createConnection } from "node:net";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

function loadEnvSync() {
  const p = path.join(root, ".env");
  if (!fs.existsSync(p)) {
    console.error("Missing .env — copy .env.example to .env\n");
    return {};
  }
  const raw = fs.readFileSync(p, "utf8");
  const out = {};
  for (const line of raw.split("\n")) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*"?([^"\n]*)"?/);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}

function parseDbUrl(url) {
  try {
    const u = new URL(url);
    return { host: u.hostname, port: u.port || "5432" };
  } catch {
    return null;
  }
}

function waitPort(port, host = "127.0.0.1", timeoutMs = 3000) {
  return new Promise((resolve, reject) => {
    const t0 = Date.now();
    const attempt = () => {
      const s = createConnection({ port: Number(port), host }, () => {
        s.end();
        resolve(true);
      });
      s.on("error", () => {
        s.destroy();
        if (Date.now() - t0 > timeoutMs) reject(new Error("timeout"));
        else setTimeout(attempt, 200);
      });
    };
    attempt();
  });
}

async function prismaPing() {
  const { PrismaClient } = await import("@prisma/client");
  const p = new PrismaClient();
  try {
    await p.$queryRaw`SELECT 1`;
    return true;
  } finally {
    await p.$disconnect();
  }
}

async function main() {
  const env = loadEnvSync();
  console.log("Spark and Drive Autos — local doctor\n");

  let dockerOk = false;
  try {
    execSync("docker info", { stdio: "pipe" });
    dockerOk = true;
    console.log("✓ Docker CLI available");
  } catch {
    console.log("✗ Docker CLI not available — use Docker for the default DB or your own Postgres");
  }

  if (dockerOk) {
    try {
      execSync("docker compose ps", { cwd: root, stdio: "pipe" });
      console.log("✓ docker compose in project folder OK");
    } catch {
      console.log("? docker compose ps failed — try: npm run docker:up");
    }
  }

  const dbUrl = env.DATABASE_URL;
  if (!dbUrl) {
    console.log("✗ DATABASE_URL not set in .env");
    process.exitCode = 1;
    return;
  }

  const parsed = parseDbUrl(dbUrl);
  if (!parsed) {
    console.log("✗ DATABASE_URL is not a valid URL");
    process.exitCode = 1;
    return;
  }

  const tcpHost = parsed.host === "localhost" ? "127.0.0.1" : parsed.host;
  console.log(`  DATABASE_URL → ${parsed.host}:${parsed.port}`);

  try {
    await waitPort(parsed.port, tcpHost);
    console.log(`✓ Database port is open (${tcpHost}:${parsed.port})`);
  } catch {
    console.log(`✗ Nothing listening on ${tcpHost}:${parsed.port}`);
    console.log("  Run: npm run docker:up   OR fix DATABASE_URL");
    process.exitCode = 1;
  }

  try {
    await prismaPing();
    console.log("✓ Prisma can run SELECT 1");
  } catch (e) {
    console.log("✗ Prisma cannot query — run: npx prisma db push");
    console.log(`  (${e?.message ?? e})`);
    process.exitCode = 1;
  }

  const secret = env.AUTH_SECRET ?? env.NEXTAUTH_SECRET;
  if (!secret || secret.length < 32) {
    console.log("✗ AUTH_SECRET / NEXTAUTH_SECRET must be at least 32 characters");
    process.exitCode = 1;
  } else {
    console.log("✓ AUTH secret length OK");
  }

  const authUrl = env.AUTH_URL ?? env.NEXTAUTH_URL;
  if (authUrl) {
    console.log(`  ${env.AUTH_URL ? "AUTH_URL" : "NEXTAUTH_URL"}=${authUrl}`);
    console.log("  Tip: open the same host in the browser as in this URL (localhost vs 127.0.0.1).");
  }

  try {
    await waitPort("5173", "127.0.0.1", 400);
    console.log("⚠ Port 5173 is in use — old Node/Next may still be running (often causes EADDRINUSE or weird 500s).");
    console.log("  Fix: npm run kill:5173   then   npm run dev");
    console.log("  Or one shot: npm run dev:fresh");
  } catch {
    console.log("✓ Port 5173 is free");
  }

  console.log("\n→ npm run dev     then     http://localhost:5173");
  console.log(
    "\nBuild tip: `npm run build` always clears `.next` first (avoids stale webpack chunk errors). For a faster repeat build locally: npm run build:incremental\n",
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
