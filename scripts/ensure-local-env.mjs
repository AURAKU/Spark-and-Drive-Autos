/**
 * If `.env` is missing but `.env.example` exists, copy it so `next dev` and Prisma work on first clone.
 * Safe: never overwrites an existing `.env`.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const envPath = path.join(root, ".env");
const examplePath = path.join(root, ".env.example");

export function ensureLocalEnv() {
  if (fs.existsSync(envPath)) return false;
  if (!fs.existsSync(examplePath)) {
    console.warn(
      "[ensure-local-env] No .env and no .env.example — create .env with DATABASE_URL and AUTH_SECRET (see docs in repo).\n"
    );
    return false;
  }
  fs.copyFileSync(examplePath, envPath);
  console.log(
    "[ensure-local-env] Created .env from .env.example — set DATABASE_URL (see docker-compose.yml for local Docker) and replace AUTH_SECRET placeholders before production.\n"
  );
  return true;
}

const runDirect =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename);
if (runDirect) {
  ensureLocalEnv();
}
