import { normalizePartsFinderImageUrl } from "@/lib/parts-finder/image-url";
import type { NormalizedPartsQuery } from "@/lib/parts-finder/normalize-query";
import { buildExternalSearchQueries } from "@/lib/parts-finder/normalize-query";

import type { ExternalCandidate } from "@/lib/parts-finder/external/types";

type SerperOrganic = {
  title: string;
  snippet?: string;
  link?: string;
  thumbnailUrl?: string;
  imageUrl?: string;
  image?: string;
};
type SerperImageRow = {
  title?: string;
  imageUrl?: string;
  thumbnailUrl?: string;
  source?: string;
};

function normalizeImageUrl(url: string | null | undefined): string | null {
  return normalizePartsFinderImageUrl(url);
}

function extractRefs(text: string): string[] {
  const out = text.match(/\b[A-Z0-9]{6,24}\b/g) ?? [];
  return [...new Set(out)].slice(0, 6);
}

function extractFitmentClues(text: string): string[] {
  const matches = text.match(/\b(20\d{2}|19\d{2}|fits|fitment|compatible|for)\b/gi) ?? [];
  return [...new Set(matches.map((m) => m.toLowerCase()))].slice(0, 6);
}

function extractAlternateRefs(text: string): string[] {
  const out = text.match(/\b(?:alt|replaces?|replacement)\s*[:#-]?\s*([A-Z0-9-]{5,24})\b/gi) ?? [];
  return [...new Set(out.map((row) => row.replace(/^(alt|replaces?|replacement)\s*[:#-]?\s*/i, "").toUpperCase()))].slice(0, 6);
}

function extractImageHints(text: string): string[] {
  return [...new Set(text.toLowerCase().split(/[^a-z0-9]+/g).filter((token) => token.length > 3))].slice(0, 8);
}

/**
 * Calls Serper.dev Google JSON API when `SERPER_API_KEY` is set.
 * Docs: https://serper.dev — enable in production for real web results.
 */
async function fetchSerperOnce(query: string, trace?: { jobId?: string }): Promise<ExternalCandidate[]> {
  const key = process.env.SERPER_API_KEY;
  if (!key) return [];
  if (trace?.jobId) {
    console.info("[parts-finder] Serper request started", { jobId: trace.jobId, query });
  }

  let res: Response | null = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    try {
      res = await fetch("https://google.serper.dev/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-KEY": key,
        },
        body: JSON.stringify({ q: query, num: 10 }),
        next: { revalidate: 0 },
        signal: controller.signal,
      });
      if (res.ok) break;
    } catch {
      if (attempt === 1) return [];
    } finally {
      clearTimeout(timer);
    }
  }

  if (!res || !res.ok) return [];

  const json = (await res.json()) as { organic?: SerperOrganic[] };
  const organic = json.organic ?? [];
  const out: ExternalCandidate[] = [];

  for (const row of organic) {
    if (!row.title?.trim()) continue;
    let host = "web";
    try {
      if (row.link) host = new URL(row.link).hostname.replace(/^www\./, "");
    } catch {
      host = "web";
    }
    const thumbnailUrlRaw = row.thumbnailUrl ?? row.imageUrl ?? row.image ?? null;
    const thumbnailUrl = normalizeImageUrl(typeof thumbnailUrlRaw === "string" ? thumbnailUrlRaw : null);
    out.push({
      title: row.title.trim(),
      snippet: (row.snippet ?? "").trim(),
      sourceHint: host,
      ingestionSource: "SERPER_WEB",
      thumbnailUrl,
      sourceIdentity: host,
      sourceUrl: row.link ?? null,
      description: (row.snippet ?? "").trim(),
      oemReferences: extractRefs(`${row.title} ${row.snippet ?? ""}`),
      alternateReferences: extractAlternateRefs(`${row.title} ${row.snippet ?? ""}`),
      fitmentClues: extractFitmentClues(`${row.title} ${row.snippet ?? ""}`),
      imageHints: extractImageHints(row.title),
    });
  }

  if (trace?.jobId) {
    console.info("[parts-finder] Serper response received", { jobId: trace.jobId, hits: out.length });
  }
  return out;
}

async function fetchSerperImagesOnce(query: string, trace?: { jobId?: string }): Promise<ExternalCandidate[]> {
  const key = process.env.SERPER_API_KEY;
  if (!key) return [];
  let res: Response | null = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    try {
      res = await fetch("https://google.serper.dev/images", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-KEY": key,
        },
        body: JSON.stringify({ q: query, num: 10 }),
        next: { revalidate: 0 },
        signal: controller.signal,
      });
      if (res.ok) break;
    } catch {
      if (attempt === 1) return [];
    } finally {
      clearTimeout(timer);
    }
  }
  if (!res || !res.ok) return [];
  const json = (await res.json()) as { images?: SerperImageRow[] };
  const images = json.images ?? [];
  const out: ExternalCandidate[] = [];
  for (const row of images) {
    const title = row.title?.trim() || "Parts reference image";
    const thumbnailUrl = normalizeImageUrl(row.imageUrl ?? row.thumbnailUrl ?? null);
    if (!thumbnailUrl) continue;
    let host = "web";
    try {
      host = row.source ? new URL(row.source).hostname.replace(/^www\./, "") : "web";
    } catch {
      host = "web";
    }
    out.push({
      title,
      snippet: "Catalog image candidate",
      sourceHint: host,
      ingestionSource: "SERPER_WEB",
      thumbnailUrl,
      sourceIdentity: host,
      sourceUrl: null,
      description: "Image candidate",
      oemReferences: extractRefs(title),
      alternateReferences: [],
      fitmentClues: [],
      imageHints: extractImageHints(title),
    });
  }
  if (trace?.jobId) {
    console.info("[parts-finder] Serper image response received", { jobId: trace.jobId, hits: out.length });
  }
  return out;
}

/** When no API key or sparse results — structured previews only (never fabricates OEM numbers). */
function buildFallbackCandidates(n: NormalizedPartsQuery): ExternalCandidate[] {
  const vehicle = [n.brand, n.model, n.year ? String(n.year) : ""].filter(Boolean).join(" ");
  const part = n.partIntent || "replacement component";

  const seeds = [
    `${vehicle ? `${vehicle} · ` : ""}${part} — supplier listings and cross-references`,
    `${vehicle ? `${vehicle} ` : ""}compatible ${part.toLowerCase()} options (market scan)`,
    `${vehicle ? `${vehicle} ` : ""}service parts reference overview`,
    n.vinTail ? `VIN-linked parts intelligence · tail ${n.vinTail}` : "",
    n.chassisTail ? `Chassis-linked components · suffix ${n.chassisTail}` : "",
  ].filter(Boolean);

  return seeds.slice(0, 5).map((title) => ({
    title,
    snippet:
      "Configure SERPER_API_KEY for live web ingestion. This preview ranks intent only—confirm fitment before ordering.",
    sourceHint: "preview",
    ingestionSource: "FALLBACK_PREVIEW" as const,
    thumbnailUrl: null,
    sourceIdentity: "preview",
    sourceUrl: null,
    description: "Deterministic fallback preview candidate",
    oemReferences: [],
    alternateReferences: [],
    fitmentClues: [],
    imageHints: [],
  }));
}

function dedupeCandidates(items: ExternalCandidate[]): ExternalCandidate[] {
  const seen = new Set<string>();
  const out: ExternalCandidate[] = [];
  for (const x of items) {
    const k = `${x.title.slice(0, 80)}|${x.snippet.slice(0, 40)}`.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(x);
  }
  return out;
}

/**
 * Aggregates external signals: Serper when configured, otherwise deterministic fallback previews.
 */
export async function ingestExternalCandidates(n: NormalizedPartsQuery, trace?: { jobId?: string }): Promise<ExternalCandidate[]> {
  const queries = buildExternalSearchQueries(n);
  const merged: ExternalCandidate[] = [];

  if (process.env.SERPER_API_KEY) {
    // Run multiple Serper searches in parallel to reduce end-to-end wait.
    const maxQueries = 6;
    const concurrency = 3;
    const queue = queries.slice(0, maxQueries);
    let idx = 0;
    const workers = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
      while (idx < queue.length) {
        const current = queue[idx];
        idx += 1;
        if (!current) break;
        const chunk = await fetchSerperOnce(current, trace);
        if (chunk.length > 0) merged.push(...chunk);
      }
    });
    await Promise.allSettled(workers);
    const imageQuery = [n.year ? String(n.year) : "", n.brand ?? "", n.model ?? "", n.partIntent || "auto part", "product image"]
      .filter(Boolean)
      .join(" ");
    const imageCandidates = await fetchSerperImagesOnce(imageQuery, trace);
    if (imageCandidates.length > 0) merged.push(...imageCandidates);
    if (merged.length > 24) {
      merged.splice(24);
    }
  }

  const deduped = dedupeCandidates(merged);

  if (process.env.SERPER_API_KEY) {
    if (deduped.length === 0) {
      throw new Error("SERPER_EMPTY");
    }
    return deduped.slice(0, 20);
  }

  const fallback = buildFallbackCandidates(n);
  return dedupeCandidates([...deduped, ...fallback]).slice(0, 20);
}
