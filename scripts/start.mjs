/**
 * Production server: `next start` on PORT (e.g. cloud) or 5173 when unset (local parity with dev).
 * Usage: npm run start   |   PORT=3000 npm run start
 */
import { spawn } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = process.env.PORT || "5173";

const child = spawn("npx", ["next", "start", "-p", port], {
  cwd: root,
  stdio: "inherit",
  shell: true,
  env: process.env,
});

child.on("exit", (code) => process.exit(code ?? 0));
