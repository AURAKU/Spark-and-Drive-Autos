#!/usr/bin/env node
/**
 * Lists app router pages and GETs each URL (dynamic segments filled with placeholders).
 * Usage: BASE_URL=http://localhost:5173 node scripts/audit-pages.mjs
 */
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.BASE_URL?.replace(/\/$/, "") || "http://localhost:5173";
const REQUEST_TIMEOUT_MS = Number(process.env.REQUEST_TIMEOUT_MS || 6000);
const RETRIES = Number(process.env.RETRIES || 1);
const MAX_AUDIT_MS = Number(process.env.MAX_AUDIT_MS || 180000);

function walk(dir, urlSegments) {
  /** @type {{ urlSegments: string[], file: string }[]} */
  const results = [];
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const ent of entries) {
    if (ent.name.startsWith("_") || ent.name === "api") continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name.startsWith("(")) {
        results.push(...walk(full, urlSegments));
      } else {
        results.push(...walk(full, [...urlSegments, ent.name]));
      }
    } else if (ent.name === "page.tsx") {
      results.push({ urlSegments: [...urlSegments], file: full });
    }
  }
  return results;
}

function segmentToPlaceholder(seg) {
  if (!seg.startsWith("[")) return seg;
  const inner = seg.slice(1, -1); // [...slug]
  const name = inner.replace(/^\.\.\./, "");
  if (name.includes("slug")) return "sample-car-slug";
  if (name.includes("orderId")) return "00000000-0000-0000-0000-000000000001";
  if (name.includes("paymentId")) return "00000000-0000-0000-0000-000000000002";
  if (name.includes("jobId")) return "00000000-0000-0000-0000-000000000003";
  if (name.includes("messageId")) return "00000000-0000-0000-0000-000000000004";
  if (name.includes("receiptId")) return "00000000-0000-0000-0000-000000000005";
  if (name.includes("verificationId")) return "00000000-0000-0000-0000-000000000006";
  return "00000000-0000-0000-0000-000000000099";
}

function toUrl(segments) {
  const parts = segments.map(segmentToPlaceholder);
  return "/" + parts.join("/");
}

function urlLooksDynamic(url) {
  return (
    url.includes("sample-car-slug") ||
    url.includes("00000000-0000-0000-0000-") ||
    url.endsWith("/test-id") ||
    url.includes("/00000000-0000-0000-0000-000000000099")
  );
}

async function main() {
  try {
    await fetchWithRetry(BASE + "/");
  } catch (e) {
    console.error(
      JSON.stringify(
        {
          error: "Base URL is unreachable. Start the app server before running audit-pages.",
          baseUrl: BASE,
          detail: String(e instanceof Error ? e.message : e),
        },
        null,
        2,
      ),
    );
    process.exit(2);
  }

  const appDir = path.join(process.cwd(), "src/app");
  const pages = walk(appDir, []);
  const startedAt = Date.now();
  /** @type {{ url: string, status: number, loc?: string, file?: string, error?: string }[]} */
  const rows = [];

  for (const { urlSegments, file } of pages) {
    if (Date.now() - startedAt > MAX_AUDIT_MS) {
      rows.push({
        url: "__audit_timeout__",
        status: 0,
        error: `Audit exceeded MAX_AUDIT_MS=${MAX_AUDIT_MS}`,
      });
      break;
    }
    const urlPath = toUrl(urlSegments);
    const target = BASE + urlPath;
    try {
      const res = await fetchWithRetry(target);
      const status = res.status;
      const loc = res.headers.get("location") || undefined;
      rows.push({ url: urlPath, status, loc, file });
    } catch (e) {
      rows.push({
        url: urlPath,
        status: 0,
        error: String(e?.message || e),
        file,
      });
    }
  }

  const serverErrors = rows.filter((r) => r.status >= 500 || r.status === 0);
  const notFoundSuspicious = rows.filter((r) => {
    if (r.status !== 404) return false;
    if (urlLooksDynamic(r.url)) return false;
    return true;
  });

  const weird = rows.filter((r) => {
    const prot = r.url.startsWith("/admin") || r.url.startsWith("/dashboard");
    if (!prot) return false;
    // Expect redirect to login when unauthenticated
    const ok =
      r.status === 302 ||
      r.status === 307 ||
      r.status === 303 ||
      r.status === 401 ||
      (typeof r.loc === "string" && r.loc.includes("/login"));
    return !ok && r.status !== 200;
  });

  console.log(
    JSON.stringify(
      {
        total: rows.length,
        serverErrors,
        notFoundSuspicious,
        protectedUnexpected: weird,
      },
      null,
      2,
    ),
  );
}

async function fetchWithRetry(url) {
  /** @type {unknown} */
  let lastError;
  for (let attempt = 0; attempt <= RETRIES; attempt += 1) {
    try {
      return await fetch(url, {
        method: "GET",
        redirect: "manual",
        headers: { Accept: "text/html" },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (e) {
      lastError = e;
      if (attempt < RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, 150 * (attempt + 1)));
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
