#!/usr/bin/env node
/**
 * Scans src for internal href="/..." patterns and flags targets that have no matching page.tsx route.
 * Heuristic only: dynamic segments and template literals are skipped.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const appDir = path.join(root, "src", "app");

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

function toRoutePattern(filePath) {
  const rel = path.relative(appDir, filePath);
  const parts = rel.split(path.sep).slice(0, -1);
  const segs = [];
  for (const part of parts) {
    if (part.startsWith("(") && part.endsWith(")")) continue;
    segs.push(part);
  }
  return "/" + segs.join("/").replace(/\/+/g, "/").replace(/^\//, "") || "";
}

const routeFiles = walk(appDir);
/** @type {Set<string>} */
const staticPrefixes = new Set();
for (const f of routeFiles) {
  const r = toRoutePattern(f);
  staticPrefixes.add(r === "" ? "/" : r);
  const parts = r.split("/").filter(Boolean);
  let acc = "";
  for (const p of parts) {
    if (p.startsWith("[")) break;
    acc += "/" + p;
    staticPrefixes.add(acc);
  }
}

function scanFiles(dir, exts, acc = []) {
  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, name.name);
    if (name.isDirectory()) {
      if (name.name === "node_modules" || name.name === ".next") continue;
      scanFiles(p, exts, acc);
    } else if (exts.some((e) => name.name.endsWith(e))) acc.push(p);
  }
  return acc;
}

const sources = scanFiles(path.join(root, "src"), [".tsx", ".ts", ".jsx", ".js"]);
const hrefRe = /href=\{?["'](\/[a-zA-Z0-9/_-]*)["']\}?/g;
/** @type {Map<string, string[]>} */
const hrefs = new Map();
for (const file of sources) {
  const txt = fs.readFileSync(file, "utf8");
  let m;
  while ((m = hrefRe.exec(txt)) !== null) {
    const h = m[1];
    if (h.includes("${") || h.includes("`")) continue;
    if (!hrefs.has(h)) hrefs.set(h, []);
    hrefs.get(h).push(path.relative(root, file));
  }
}

/** @param {string} href */
function mightExist(href) {
  if (href.startsWith("/api/")) return true;
  if (staticPrefixes.has(href)) return true;
  const parts = href.split("/").filter(Boolean);
  let acc = "";
  for (const p of parts) {
    acc += "/" + p;
    if (staticPrefixes.has(acc)) continue;
    if (routeFiles.some((f) => toRoutePattern(f).startsWith(acc + "/["))) return true;
    return false;
  }
  return staticPrefixes.has(acc) || acc === "";
}

const suspects = [...hrefs.keys()].filter((h) => !mightExist(h));
console.log("Internal href audit (static paths only)\n");
console.log(`Unique hrefs: ${hrefs.size}`);
if (suspects.length === 0) {
  console.log("No obvious missing static routes.\n");
  process.exit(0);
}
console.log("\nPossibly missing (verify dynamic routes manually):\n");
for (const h of suspects.sort()) {
  console.log(h);
  for (const f of hrefs.get(h) ?? []) console.log(`  ${f}`);
}
process.exit(suspects.length > 0 ? 1 : 0);
