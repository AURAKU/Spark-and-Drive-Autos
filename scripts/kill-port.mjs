#!/usr/bin/env node
/**
 * Free a TCP port (macOS/Linux: uses lsof). Usage: node scripts/kill-port.mjs [port]
 * Example: npm run kill:5173
 *
 * Tries LISTEN sockets first (matches IPv4/IPv6 :::port), then falls back to any match.
 */
import { execSync } from "node:child_process";

const port = process.argv[2] || "5173";

function collectPids() {
  const pids = new Set();
  const tryCmd = (cmd) => {
    try {
      const out = execSync(cmd, { encoding: "utf8" }).trim();
      for (const line of out.split(/\n/)) {
        for (const pid of line.split(/\s+/).filter(Boolean)) {
          if (/^\d+$/.test(pid)) pids.add(pid);
        }
      }
    } catch {
      /* no matches */
    }
  };
  // Prefer processes that are listening (catches Next on :::5173)
  tryCmd(`lsof -nP -iTCP:${port} -sTCP:LISTEN -t`);
  if (pids.size === 0) {
    tryCmd(`lsof -nP -i :${port} -t`);
  }
  if (pids.size === 0) {
    tryCmd(`lsof -ti :${port}`);
  }
  return [...pids];
}

function main() {
  if (process.platform === "win32") {
    console.error("On Windows, run: netstat -ano | findstr :5173  then  taskkill /PID <pid> /F");
    process.exit(1);
  }
  const pids = collectPids();
  if (pids.length === 0) {
    console.log(`[kill-port] Nothing listening on :${port}`);
    return;
  }
  for (const pid of pids) {
    try {
      execSync(`kill -9 ${pid}`, { stdio: "pipe" });
      console.log(`[kill-port] Stopped process ${pid} (was using :${port})`);
    } catch {
      console.warn(`[kill-port] Could not kill PID ${pid}`);
    }
  }
}

main();
