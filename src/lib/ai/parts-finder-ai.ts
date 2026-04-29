import { createHash } from "crypto";

type SerperLikeResult = {
  title?: string;
  snippet?: string;
  sourceUrl?: string | null;
  oemReferences?: string[];
  alternateReferences?: string[];
  fitmentClues?: string[];
};

export type AiSimilarApplication = {
  make: string;
  model: string;
  yearRange: string;
  note: string;
};

export type AiSummaryOutput = {
  enabled: boolean;
  summary: string;
  possibleOemNumbers: string[];
  possiblePartNames: string[];
  fitmentNotes: string[];
  confidence: "LOW" | "MEDIUM";
  warnings: string[];
  disclaimer: string;
  /** Where the part mounts / lives on the vehicle — member-safe prose only */
  locationOnVehicle: string;
  /** What the part does in the system */
  functionRole: string;
  /** Typical wear failure modes and why replacement matters */
  whyReplace: string;
  /** Operational importance to safety, emissions, or drivability */
  operationalImportance: string;
  similarApplications: AiSimilarApplication[];
};

const DISCLAIMER =
  "Fitment guidance only. Verify using VIN/chassis and supplier confirmation before purchase.";

const AI_CACHE_TTL_SECONDS = 6 * 60 * 60;
const SUMMARY_TIMEOUT_MS = 45_000;
const OEM_CANDIDATE_MAX = 48;
const PROSE_MAX = 900;

const LEAK_PATTERN =
  /https?:\/\/\S+|www\.\S+|\b(openai|chatgpt|gpt-\d|anthropic|claude|serper|perplexity|bing|google\s*search|web\s*search|search\s*results|according\s+to\s+(the\s+)?(search|web|internet)|scraped?|third[-\s]?party\s+(api|data|source)|external\s+(api|provider|source))\b/gi;

function partsFinderModel(): string {
  return process.env.OPENAI_PARTS_FINDER_MODEL?.trim() || "gpt-4o-mini";
}

function sanitizeProse(input: string | undefined | null, maxLen: number): string {
  let s = (input ?? "").replace(/\s+/g, " ").trim();
  if (!s) return "";
  for (let i = 0; i < 3; i++) {
    const next = s.replace(LEAK_PATTERN, "").replace(/\s+/g, " ").trim();
    if (next === s) break;
    s = next;
  }
  return s.slice(0, maxLen);
}

function normalizeOemToken(raw: string): string {
  return raw.replace(/[^A-Z0-9-]/gi, "").toUpperCase();
}

function extractPossibleOem(text: string): string[] {
  const matches = text.match(/\b[A-Z0-9-]{6,24}\b/g) ?? [];
  return [...new Set(matches.map((m) => normalizeOemToken(m)))].filter(Boolean);
}

function collectAllowedOemCandidates(rows: SerperLikeResult[]): string[] {
  const set = new Set<string>();
  for (const row of rows) {
    for (const list of [row.oemReferences, row.alternateReferences]) {
      if (!list) continue;
      for (const x of list) {
        const n = normalizeOemToken(x);
        if (n.length >= 6 && n.length <= 24) set.add(n);
      }
    }
    const blob = `${row.title ?? ""} ${row.snippet ?? ""}`;
    for (const x of extractPossibleOem(blob)) {
      if (x.length >= 6) set.add(x);
    }
  }
  return [...set].slice(0, OEM_CANDIDATE_MAX);
}

function filterOemToAllowed(codes: string[] | undefined, allowed: Set<string>): string[] {
  if (!codes?.length) return [];
  const out: string[] = [];
  for (const c of codes) {
    const n = normalizeOemToken(c);
    if (n && allowed.has(n)) out.push(n);
  }
  return [...new Set(out)].slice(0, 12);
}

function fallbackNormalize(input: string): string {
  return input
    .replace(/\s+/g, " ")
    .replace(/[^\w\s\-/#]/g, " ")
    .trim();
}

function fallbackSummary(
  query: string,
  serperResults: SerperLikeResult[],
  vehicle?: VehicleContext,
): AiSummaryOutput {
  const allowed = collectAllowedOemCandidates(serperResults);
  const possibleOemNumbers = allowed.slice(0, 12);
  const possiblePartNames = [...new Set(serperResults.map((r) => r.title?.trim()).filter(Boolean) as string[])].slice(
    0,
    5,
  );
  const vLabel = [vehicle?.brand, vehicle?.model, vehicle?.year].filter(Boolean).join(" ");
  return {
    enabled: false,
    summary: sanitizeProse(
      vLabel
        ? `Compatibility guidance for ${query.trim() || "your part request"} on ${vLabel}.`
        : `Compatibility guidance for ${query.trim() || "your part request"}.`,
      PROSE_MAX,
    ),
    possibleOemNumbers,
    possiblePartNames,
    fitmentNotes: ["Cross-check candidate parts with VIN/chassis and supplier fitment sheets."],
    confidence: "LOW",
    warnings: [],
    disclaimer: DISCLAIMER,
    locationOnVehicle: "",
    functionRole:
      "This component integrates with surrounding assemblies to maintain designed vehicle performance. Exact mounting varies by platform; confirm with VIN-specific documentation.",
    whyReplace:
      "Wear, contamination, or loss of sealing can reduce performance and may affect related systems. Replace when inspection or maintenance schedules indicate, or when symptoms appear.",
    operationalImportance:
      "Correct specification supports reliable operation. Incorrect fitment can cause premature wear, warning indicators, or compromised drivability.",
    similarApplications: [],
  };
}

type VehicleContext = {
  brand?: string | null;
  model?: string | null;
  year?: number | null;
  engine?: string | null;
};

function redisEnabled() {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  return Boolean(url && token && /^https:\/\//i.test(url));
}

async function readCache<T>(key: string): Promise<T | null> {
  if (!redisEnabled()) return null;
  try {
    const { Redis } = await import("@upstash/redis");
    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });
    const raw = await redis.get<string | null>(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function writeCache<T>(key: string, value: T) {
  if (!redisEnabled()) return;
  try {
    const { Redis } = await import("@upstash/redis");
    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });
    await redis.set(key, JSON.stringify(value), { ex: AI_CACHE_TTL_SECONDS });
  } catch {
    // non-fatal cache write
  }
}

export function isAiEnabled(): boolean {
  const provider = process.env.AI_PROVIDER?.trim() ?? "openai";
  if (provider === "none") return false;
  if (provider === "openai") return Boolean(process.env.OPENAI_API_KEY?.trim());
  if (provider === "anthropic") return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

export async function normalizePartsQuery(input: string, trace?: { jobId?: string }): Promise<string> {
  const source = input.trim();
  if (!source) return "";
  if (!isAiEnabled()) {
    if (trace?.jobId) console.info("[parts-finder] Query normalization fallback", { jobId: trace.jobId, reason: "AI_DISABLED" });
    return fallbackNormalize(source);
  }

  const cacheKey = `pf:ai:norm:${createHash("sha256").update(source).digest("hex")}`;
  const cached = await readCache<{ normalized: string }>(cacheKey);
  if (cached?.normalized) return cached.normalized;

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return fallbackNormalize(source);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: partsFinderModel(),
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "Normalize automotive part search text. Return JSON: {\"normalized\":\"...\"}. Keep only safe, concise, factual wording.",
          },
          { role: "user", content: source },
        ],
      }),
      signal: controller.signal,
    });
    if (!response.ok) return fallbackNormalize(source);
    const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = payload.choices?.[0]?.message?.content?.trim();
    if (!content) return fallbackNormalize(source);
    const parsed = JSON.parse(content) as { normalized?: string };
    const normalized = fallbackNormalize(parsed.normalized ?? source);
    await writeCache(cacheKey, { normalized });
    return normalized;
  } catch {
    return fallbackNormalize(source);
  } finally {
    clearTimeout(timeout);
  }
}

function parseSimilarApplications(raw: unknown): AiSimilarApplication[] {
  if (!Array.isArray(raw)) return [];
  const out: AiSimilarApplication[] = [];
  for (const item of raw.slice(0, 6)) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const make = sanitizeProse(String(o.make ?? ""), 80);
    const model = sanitizeProse(String(o.model ?? ""), 80);
    const yearRange = sanitizeProse(String(o.yearRange ?? ""), 40);
    const note = sanitizeProse(String(o.note ?? ""), 240);
    if (!make || !model) continue;
    out.push({ make, model, yearRange, note: note || "Confirm with VIN before purchase." });
  }
  return out.slice(0, 5);
}

export async function summarizePartsResults(
  input: {
    query: string;
    normalizedQuery: string;
    serperResults: SerperLikeResult[];
    vehicleContext?: VehicleContext;
  },
  trace?: { jobId?: string },
): Promise<AiSummaryOutput> {
  const vehicle = input.vehicleContext;
  if (!isAiEnabled()) {
    if (trace?.jobId) console.info("[parts-finder] OpenAI summary skipped", { jobId: trace.jobId, reason: "AI_DISABLED" });
    return fallbackSummary(input.query, input.serperResults, vehicle);
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    if (trace?.jobId) console.info("[parts-finder] OpenAI summary skipped", { jobId: trace.jobId, reason: "NO_API_KEY" });
    return fallbackSummary(input.query, input.serperResults, vehicle);
  }

  const allowedOemCandidates = collectAllowedOemCandidates(input.serperResults);
  const allowedSet = new Set(allowedOemCandidates);

  const cacheKey = `pf:ai:sum:v2:${createHash("sha256")
    .update(
      JSON.stringify({
        q: input.query,
        n: input.normalizedQuery,
        v: vehicle ?? null,
        allowed: allowedOemCandidates,
        ev: input.serperResults.slice(0, 10).map((r) => [r.title, r.snippet, r.oemReferences, r.fitmentClues]),
      }),
    )
    .digest("hex")}`;
  const cached = await readCache<AiSummaryOutput>(cacheKey);
  if (cached?.summary) return cached;

  const evidenceForModel = input.serperResults.slice(0, 10).map((row) => ({
    title: row.title ?? "",
    snippet: row.snippet ?? "",
    oemReferences: row.oemReferences ?? [],
    alternateReferences: row.alternateReferences ?? [],
    fitmentClues: row.fitmentClues ?? [],
  }));

  const controller = new AbortController();
  if (trace?.jobId) console.info("[parts-finder] OpenAI summary started", { jobId: trace.jobId });
  const timeout = setTimeout(() => controller.abort(), SUMMARY_TIMEOUT_MS);
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: partsFinderModel(),
        temperature: 0.15,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `You are the technical writer for Spark Parts Finder. Produce structured automotive guidance as JSON only.

Rules:
- Voice: neutral workshop manual style for vehicle owners and parts staff.
- Never mention data sources, APIs, vendors, websites, links, URLs, "search", "results pages", scraping, AI, models, or how information was obtained.
- Never output URLs, domains, or citation-style references.
- possibleOemNumbers: include ONLY strings that appear exactly in allowedOemCandidates (same spelling). If none apply, use [].
- Do not invent or guess OEM/part numbers. Do not claim guaranteed fitment or exact-match certainty.
- similarApplications: up to 5 entries for other nameplates or year bands that often share this part category on related platforms. Use conservative phrasing ("often used on", "may share"). If unsure, use [].
- confidence: "MEDIUM" only when allowedOemCandidates has at least 2 distinct tokens that clearly relate to the part intent; otherwise "LOW".
- Keep each prose field concise and practical.

Return JSON keys: summary, possibleOemNumbers, possiblePartNames, fitmentNotes, confidence, warnings, locationOnVehicle, functionRole, whyReplace, operationalImportance, similarApplications (array of {make, model, yearRange, note}).`,
          },
          {
            role: "user",
            content: JSON.stringify({
              query: input.query,
              normalizedQuery: input.normalizedQuery,
              vehicle,
              allowedOemCandidates,
              evidence: evidenceForModel,
            }),
          },
        ],
      }),
      signal: controller.signal,
    });
    if (!response.ok) return fallbackSummary(input.query, input.serperResults, vehicle);
    const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = payload.choices?.[0]?.message?.content?.trim();
    if (!content) return fallbackSummary(input.query, input.serperResults, vehicle);
    const parsed = JSON.parse(content) as Partial<AiSummaryOutput> & {
      similarApplications?: unknown;
    };

    const mergedOem = filterOemToAllowed(
      [...(parsed.possibleOemNumbers ?? []), ...extractPossibleOem(JSON.stringify(evidenceForModel))],
      allowedSet,
    );

    const similarApplications = parseSimilarApplications(parsed.similarApplications);

    const output: AiSummaryOutput = {
      enabled: true,
      summary: sanitizeProse(
        parsed.summary?.trim() || "Technical summary for this part request.",
        PROSE_MAX,
      ),
      possibleOemNumbers: mergedOem,
      possiblePartNames: [...new Set((parsed.possiblePartNames ?? []).map((x) => sanitizeProse(String(x), 120)).filter(Boolean))].slice(
        0,
        8,
      ),
      fitmentNotes: [...new Set((parsed.fitmentNotes ?? []).map((x) => sanitizeProse(String(x), 400)).filter(Boolean))].slice(0, 6),
      confidence: parsed.confidence === "MEDIUM" && allowedOemCandidates.length >= 2 ? "MEDIUM" : "LOW",
      warnings: [...new Set((parsed.warnings ?? []).map((x) => sanitizeProse(String(x), 400)).filter(Boolean))].slice(0, 6),
      disclaimer: DISCLAIMER,
      locationOnVehicle: sanitizeProse(parsed.locationOnVehicle, PROSE_MAX),
      functionRole: sanitizeProse(parsed.functionRole, PROSE_MAX),
      whyReplace: sanitizeProse(parsed.whyReplace, PROSE_MAX),
      operationalImportance: sanitizeProse(parsed.operationalImportance, PROSE_MAX),
      similarApplications,
    };

    if (!output.functionRole) output.functionRole = fallbackSummary(input.query, input.serperResults, vehicle).functionRole;
    if (!output.whyReplace) output.whyReplace = fallbackSummary(input.query, input.serperResults, vehicle).whyReplace;
    if (!output.operationalImportance)
      output.operationalImportance = fallbackSummary(input.query, input.serperResults, vehicle).operationalImportance;

    await writeCache(cacheKey, output);
    if (trace?.jobId) console.info("[parts-finder] OpenAI summary completed", { jobId: trace.jobId });
    return output;
  } catch {
    if (trace?.jobId) console.info("[parts-finder] OpenAI summary fallback", { jobId: trace.jobId, reason: "REQUEST_FAILED" });
    return fallbackSummary(input.query, input.serperResults, vehicle);
  } finally {
    clearTimeout(timeout);
  }
}
