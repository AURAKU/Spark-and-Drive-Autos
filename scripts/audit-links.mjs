#!/usr/bin/env node
/**
 * Crawl same-origin links from BASE_URL and report broken pages.
 * Usage: BASE_URL=http://localhost:5173 node scripts/audit-links.mjs
 */
const BASE_URL = (process.env.BASE_URL || "http://localhost:5173").replace(/\/$/, "");
const origin = new URL(BASE_URL).origin;
const MAX_PAGES = Number(process.env.MAX_PAGES || 250);
const REQUEST_TIMEOUT_MS = Number(process.env.REQUEST_TIMEOUT_MS || 20000);
const RETRIES = Number(process.env.RETRIES || 2);
const MAX_AUDIT_MS = Number(process.env.MAX_AUDIT_MS || 900000);

function extractHrefs(html) {
  const hrefs = [];
  const re = /href\s*=\s*"([^"]+)"/gi;
  let m;
  while ((m = re.exec(html)) !== null) hrefs.push(m[1]);
  return hrefs;
}

function normalize(urlLike, fromUrl) {
  try {
    const u = new URL(urlLike, fromUrl);
    if (u.origin !== origin) return null;
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    if (
      u.pathname.startsWith("/_next") ||
      u.pathname.startsWith("/api/") ||
      u.pathname.startsWith("/favicon") ||
      u.pathname.startsWith("/assets/")
    ) {
      return null;
    }
    u.hash = "";
    return u.toString();
  } catch {
    return null;
  }
}

async function request(url) {
  /** @type {unknown} */
  let lastError;
  for (let attempt = 0; attempt <= RETRIES; attempt += 1) {
    try {
      const res = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
      return {
        status: res.status,
        location: res.headers.get("location"),
        body: res.status === 200 ? await res.text() : "",
      };
    } catch (e) {
      lastError = e;
      if (attempt < RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, 200 * (attempt + 1)));
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

async function main() {
  const startedAt = Date.now();
  const queue = [BASE_URL + "/"];
  const seen = new Set();
  const failures = [];
  const summary = [];

  while (queue.length > 0 && seen.size < MAX_PAGES) {
    if (Date.now() - startedAt > MAX_AUDIT_MS) {
      failures.push({
        url: "__audit_timeout__",
        status: 0,
        kind: "timeout",
        error: `Audit exceeded MAX_AUDIT_MS=${MAX_AUDIT_MS}`,
      });
      break;
    }
    const url = queue.shift();
    if (!url || seen.has(url)) continue;
    seen.add(url);
    try {
      const { status, location, body } = await request(url);
      summary.push({ url, status });
      if (status >= 500 || status === 404 || status === 0) {
        failures.push({ url, status, kind: "http" });
      }
      if (status === 200 && body) {
        const hrefs = extractHrefs(body);
        for (const h of hrefs) {
          const next = normalize(h, url);
          if (next && !seen.has(next)) queue.push(next);
        }
      } else if ((status === 302 || status === 307 || status === 303) && location) {
        const next = normalize(location, url);
        if (next && !seen.has(next)) queue.push(next);
      }
    } catch (e) {
      failures.push({ url, status: 0, kind: "fetch", error: String(e?.message || e) });
    }
  }

  console.log(
    JSON.stringify(
      {
        crawled: seen.size,
        failures,
        sampleStatuses: summary.slice(0, 80),
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
