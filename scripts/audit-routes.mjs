#!/usr/bin/env node
/**
 * Lists App Router routes from every src/app/.../page.tsx file (static structure only).
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
  const parts = rel.split(path.sep).slice(0, -1); // drop page.tsx
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
