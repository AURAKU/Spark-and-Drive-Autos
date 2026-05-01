#!/usr/bin/env node
/**
 * Lightweight production smoke checks. Set BASE_URL (e.g. https://yourdomain.com).
 * Does not require auth for most checks; upload sign expects 401 without session.
 */
const base = (process.env.BASE_URL ?? process.env.SMOKE_BASE_URL ?? "").replace(/\/$/, "");
if (!base) {
  console.error("Set BASE_URL or SMOKE_BASE_URL (e.g. https://sparkanddrive.example.com)");
  process.exit(1);
}

async function get(path, init) {
  const url = `${base}${path}`;
  const r = await fetch(url, { ...init, redirect: "manual" });
  return { url, status: r.status, ok: r.ok };
}

async function main() {
  /** @type {string[]} */
  const failures = [];

  const checks = [
    ["GET /inventory", () => get("/inventory", { headers: { Accept: "text/html" } })],
    ["GET /api/currency/rates", () => get("/api/currency/rates")],
    ["POST /api/uploads/sign (expect 401)", async () => {
      const r = await fetch(`${base}/api/uploads/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ purpose: "ghana-card", mimeType: "image/jpeg" }),
      });
      return { url: "/api/uploads/sign", status: r.status, ok: r.status === 401 };
    }],
  ];

  for (const [label, fn] of checks) {
    try {
      const { url, status, ok } = await fn();
      const pass = ok || (label.includes("401") && status === 401);
      console.log(`${pass ? "OK" : "FAIL"} ${label} → ${status} ${url}`);
      if (!pass) failures.push(`${label}: ${status}`);
    } catch (e) {
      console.log(`FAIL ${label} → ${e instanceof Error ? e.message : e}`);
      failures.push(label);
    }
  }

  if (failures.length) {
    console.error("\nFailures:", failures.join("; "));
    process.exit(1);
  }
  console.log("\nAll smoke checks passed.");
}

await main();
