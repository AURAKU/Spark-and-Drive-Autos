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
async function fetchSerperOnce(query: string): Promise<ExternalCandidate[]> {
  const key = process.env.SERPER_API_KEY;
  if (!key) return [];

  let res: Response | null = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5500);
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
    const thumbnailUrl =
      typeof thumbnailUrlRaw === "string" && /^https?:\/\//i.test(thumbnailUrlRaw)
        ? thumbnailUrlRaw
        : null;
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
export async function ingestExternalCandidates(n: NormalizedPartsQuery): Promise<ExternalCandidate[]> {
  const queries = buildExternalSearchQueries(n);
  const merged: ExternalCandidate[] = [];

  if (process.env.SERPER_API_KEY) {
    for (const q of queries) {
      const chunk = await fetchSerperOnce(q);
      merged.push(...chunk);
      if (merged.length >= 24) break;
    }
  }

  const deduped = dedupeCandidates(merged);

  if (deduped.length >= 3) {
    return deduped.slice(0, 20);
  }

  const fallback = buildFallbackCandidates(n);
  return dedupeCandidates([...deduped, ...fallback]).slice(0, 20);
}
