#!/usr/bin/env node
/**
 * Production / staging smoke checks. Set BASE_URL or SMOKE_BASE_URL (no trailing slash).
 *
 * Passes when responses are not 5xx. Accepts 200, 3xx redirects, 401, 403 (expected for gated routes).
 */
const base = (process.env.BASE_URL ?? process.env.SMOKE_BASE_URL ?? "").replace(/\/$/, "");
if (!base) {
  console.error("Set BASE_URL or SMOKE_BASE_URL (e.g. https://sparkanddrive.example.com)");
  process.exit(1);
}

/** @param {number} s */
function isAcceptableStatus(s) {
  if (s >= 200 && s < 400) return true;
  if (s === 401 || s === 403) return true;
  return false;
}

async function get(path, init) {
  const url = `${base}${path}`;
  const r = await fetch(url, { ...init, redirect: "manual" });
  return { url, status: r.status };
}

async function main() {
  /** @type {string[]} */
  const failures = [];

  /** @type {readonly [string, string][]} */
  const pageGets = [
    ["GET /", "/"],
    ["GET /inventory", "/inventory"],
    ["GET /parts", "/parts"],
    ["GET /login", "/login"],
    ["GET /register", "/register"],
    ["GET /checkout", "/checkout"],
    ["GET /dashboard", "/dashboard"],
    ["GET /admin", "/admin"],
    ["GET /api/admin/health/readiness", "/api/admin/health/readiness"],
  ];

  for (const [label, path] of pageGets) {
    try {
      const { url, status } = await get(path, { headers: { Accept: "text/html,application/json,*/*" } });
      const pass = isAcceptableStatus(status);
      console.log(`${pass ? "OK" : "FAIL"} ${label} → ${status} ${url}`);
      if (!pass) failures.push(`${label}: ${status}`);
    } catch (e) {
      console.log(`FAIL ${label} → ${e instanceof Error ? e.message : e}`);
      failures.push(label);
    }
  }

  try {
    const r = await fetch(`${base}/api/uploads/sign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ purpose: "ghana-card", mimeType: "image/jpeg" }),
      redirect: "manual",
    });
    const pass = r.status === 401;
    console.log(`${pass ? "OK" : "FAIL"} POST /api/uploads/sign (expect 401) → ${r.status}`);
    if (!pass) failures.push(`POST sign: ${r.status}`);
  } catch (e) {
    console.log(`FAIL POST /api/uploads/sign → ${e instanceof Error ? e.message : e}`);
    failures.push("POST sign");
  }

  try {
    const { status } = await get("/api/currency/rates", { headers: { Accept: "application/json" } });
    const pass = status === 200;
    console.log(`${pass ? "OK" : "FAIL"} GET /api/currency/rates → ${status}`);
    if (!pass) failures.push(`currency rates: ${status}`);
  } catch (e) {
    console.log(`FAIL GET /api/currency/rates → ${e instanceof Error ? e.message : e}`);
    failures.push("currency rates");
  }

  if (failures.length) {
    console.error("\nFailures:", failures.join("; "));
    process.exit(1);
  }
  console.log("\nAll smoke checks passed (no 5xx / unexpected statuses).");
}

await main();
