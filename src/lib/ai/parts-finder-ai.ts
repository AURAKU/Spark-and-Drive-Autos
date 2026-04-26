import { createHash } from "crypto";

type SerperLikeResult = {
  title?: string;
  snippet?: string;
  sourceUrl?: string | null;
  oemReferences?: string[];
  alternateReferences?: string[];
  fitmentClues?: string[];
};

type AiSummaryOutput = {
  enabled: boolean;
  summary: string;
  possibleOemNumbers: string[];
  possiblePartNames: string[];
  fitmentNotes: string[];
  confidence: "LOW" | "MEDIUM";
  warnings: string[];
  disclaimer: string;
};

const DISCLAIMER =
  "Fitment guidance only. Verify using VIN/chassis and supplier confirmation before purchase.";

const AI_CACHE_TTL_SECONDS = 6 * 60 * 60;

function extractPossibleOem(text: string): string[] {
  const matches = text.match(/\b[A-Z0-9-]{6,24}\b/g) ?? [];
  return [...new Set(matches)].slice(0, 8);
}

function fallbackNormalize(input: string): string {
  return input
    .replace(/\s+/g, " ")
    .replace(/[^\w\s\-/#]/g, " ")
    .trim();
}

function fallbackSummary(query: string, serperResults: SerperLikeResult[]): AiSummaryOutput {
  const joined = serperResults.map((r) => `${r.title ?? ""} ${r.snippet ?? ""}`).join(" ");
  const possibleOemNumbers = extractPossibleOem(joined);
  const possiblePartNames = [...new Set(serperResults.map((r) => r.title?.trim()).filter(Boolean) as string[])].slice(0, 5);
  return {
    enabled: false,
    summary: "Compatibility guidance based on catalog patterns and supplier fitment signals.",
    possibleOemNumbers,
    possiblePartNames,
    fitmentNotes: ["Cross-check candidate parts with VIN/chassis and supplier fitment sheets."],
    confidence: "LOW",
    warnings: [],
    disclaimer: DISCLAIMER,
  };
}

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
        model: "gpt-4o-mini",
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

export async function summarizePartsResults(input: {
  query: string;
  normalizedQuery: string;
  serperResults: SerperLikeResult[];
}, trace?: { jobId?: string }): Promise<AiSummaryOutput> {
  if (!isAiEnabled()) {
    if (trace?.jobId) console.info("[parts-finder] OpenAI summary skipped", { jobId: trace.jobId, reason: "AI_DISABLED" });
    return fallbackSummary(input.query, input.serperResults);
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    if (trace?.jobId) console.info("[parts-finder] OpenAI summary skipped", { jobId: trace.jobId, reason: "NO_API_KEY" });
    return fallbackSummary(input.query, input.serperResults);
  }

  const cacheKey = `pf:ai:sum:${createHash("sha256")
    .update(JSON.stringify({ q: input.query, n: input.normalizedQuery, r: input.serperResults.slice(0, 8) }))
    .digest("hex")}`;
  const cached = await readCache<AiSummaryOutput>(cacheKey);
  if (cached) return cached;

  const compactResults = input.serperResults.slice(0, 8).map((row) => ({
    title: row.title ?? "",
    snippet: row.snippet ?? "",
    sourceUrl: row.sourceUrl ?? null,
    oemReferences: row.oemReferences ?? [],
    alternateReferences: row.alternateReferences ?? [],
    fitmentClues: row.fitmentClues ?? [],
  }));

  const controller = new AbortController();
  if (trace?.jobId) console.info("[parts-finder] OpenAI summary started", { jobId: trace.jobId });
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You summarize automotive parts evidence safely. Never guarantee exact fitment, never claim 95-99% accuracy, never invent OEM numbers. Return JSON with keys: summary, possibleOemNumbers, possiblePartNames, fitmentNotes, confidence, warnings.",
          },
          {
            role: "user",
            content: JSON.stringify({
              query: input.query,
              normalizedQuery: input.normalizedQuery,
              results: compactResults,
            }),
          },
        ],
      }),
      signal: controller.signal,
    });
    if (!response.ok) return fallbackSummary(input.query, input.serperResults);
    const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = payload.choices?.[0]?.message?.content?.trim();
    if (!content) return fallbackSummary(input.query, input.serperResults);
    const parsed = JSON.parse(content) as Partial<AiSummaryOutput>;
    const mergedOem = [...(parsed.possibleOemNumbers ?? []), ...extractPossibleOem(JSON.stringify(compactResults))];
    const output: AiSummaryOutput = {
      enabled: true,
      summary: (parsed.summary?.trim() || "Evidence summary generated from available sources.").slice(0, 700),
      possibleOemNumbers: [...new Set(mergedOem.map((x) => x.trim().toUpperCase()).filter(Boolean))].slice(0, 10),
      possiblePartNames: [...new Set((parsed.possiblePartNames ?? []).map((x) => x.trim()).filter(Boolean))].slice(0, 8),
      fitmentNotes: [...new Set((parsed.fitmentNotes ?? []).map((x) => x.trim()).filter(Boolean))].slice(0, 6),
      confidence: parsed.confidence === "MEDIUM" ? "MEDIUM" : "LOW",
      warnings: [...new Set((parsed.warnings ?? []).map((x) => x.trim()).filter(Boolean))].slice(0, 6),
      disclaimer: DISCLAIMER,
    };
    await writeCache(cacheKey, output);
    if (trace?.jobId) console.info("[parts-finder] OpenAI summary completed", { jobId: trace.jobId });
    return output;
  } catch {
    if (trace?.jobId) console.info("[parts-finder] OpenAI summary fallback", { jobId: trace.jobId, reason: "REQUEST_FAILED" });
    return fallbackSummary(input.query, input.serperResults);
  } finally {
    clearTimeout(timeout);
  }
}
