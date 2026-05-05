#!/usr/bin/env node
/**
 * 1) Lists App Router routes from every src/app/.../page.tsx (static structure).
 * 2) Optional HTTP probe: BASE_URL=... node scripts/audit-routes.mjs --probe
 *    Fails on any 5xx. Accepts 200–499 except 5xx (includes 401/403 for gated pages).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(__dirname, "..", "src", "app");

function walk(dir) {
  /** @type {string[]} */
  const out = [];
  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, name.name);
    if (name.isDirectory()) walk(p).forEach((x) => out.push(x));
    else if (name.isFile() && name.name === "page.tsx") out.push(p);
  }
  return out;
}

function toRoute(filePath) {
  const rel = path.relative(appDir, filePath);
  const parts = rel.split(path.sep).slice(0, -1);
  const segs = [];
  for (const part of parts) {
    if (part.startsWith("(") && part.endsWith(")")) continue;
    segs.push(part);
  }
  return "/" + segs.join("/").replace(/\/+/g, "/").replace(/^\//, "") || "";
}

const files = walk(appDir);
const routes = [...new Set(files.map(toRoute))].sort();
console.log(`Found ${routes.length} routes (page.tsx):\n`);
for (const r of routes) console.log(r || "/");

const probe = process.argv.includes("--probe");
const base = (process.env.BASE_URL ?? process.env.SMOKE_BASE_URL ?? "").replace(/\/$/, "");

if (probe) {
  if (!base) {
    console.error("\n--probe requires BASE_URL or SMOKE_BASE_URL");
    process.exit(1);
  }
  console.log(`\nProbing ${base} (fails on 5xx)…\n`);
  /** @type {string[]} */
  const fails = [];
  for (const route of routes) {
    const path = route || "/";
    if (path.includes("[")) {
      console.log(`SKIP (dynamic) ${path}`);
      continue;
    }
    try {
      const url = `${base}${path}`;
      const r = await fetch(url, { method: "GET", redirect: "manual", headers: { Accept: "*/*" } });
      const bad = r.status >= 500;
      console.log(`${bad ? "FAIL" : "OK"} ${r.status} ${path}`);
      if (bad) fails.push(`${path}: ${r.status}`);
    } catch (e) {
      console.log(`FAIL ${path} → ${e instanceof Error ? e.message : e}`);
      fails.push(path);
    }
  }
  if (fails.length) {
    console.error("\nProbe failures:", fails.join("; "));
    process.exit(1);
  }
  console.log("\nProbe finished: no 5xx on static routes.");
}
