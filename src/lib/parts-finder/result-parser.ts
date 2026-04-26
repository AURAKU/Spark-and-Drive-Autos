import type { ExternalCandidate } from "@/lib/parts-finder/external/types";
import type { ParsedSearchHit } from "@/lib/parts-finder/search-types";

const NOISE_PATTERNS = [
  /\bbuy now\b/gi,
  /\bfree shipping\b/gi,
  /\bclick here\b/gi,
  /\badd to cart\b/gi,
  /\baccessory kit\b/gi,
  /\bshop now\b/gi,
  /\blimited offer\b/gi,
  /\bbest price\b/gi,
  /\bwholesale\b/gi,
  /\bamazon\b/gi,
  /\bwalmart\b/gi,
  /\bebay\b/gi,
  /\bautozone\b/gi,
  /\brockauto\b/gi,
  /\bali(express|baba)\b/gi,
];

function cleanNoise(text: string): string {
  let out = text;
  for (const pattern of NOISE_PATTERNS) {
    out = out.replace(pattern, " ");
  }
  return out.replace(/\s+/g, " ").trim();
}

function extractTokens(text: string): string[] {
  return [...new Set(text.toLowerCase().split(/[^a-z0-9]+/g).filter((t) => t.length > 2))].slice(0, 24);
}

function signatureOf(candidate: ExternalCandidate): string {
  const title = cleanNoise(candidate.title).toLowerCase();
  const snippet = cleanNoise(candidate.snippet).toLowerCase().slice(0, 160);
  const refs = [...(candidate.oemReferences ?? []), ...(candidate.alternateReferences ?? [])]
    .map((x) => x.toLowerCase())
    .sort()
    .join("|");
  const identity = (candidate.sourceIdentity ?? candidate.sourceHint).toLowerCase();
  return `${candidate.ingestionSource}|${identity}|${title}|${snippet}|${refs}`;
}

export function parseExternalCandidates(candidates: ExternalCandidate[]): ParsedSearchHit[] {
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const key = signatureOf(candidate);
    if (seen.has(key)) return false;
    seen.add(key);
    return cleanNoise(candidate.title).length > 2;
  }).map((candidate) => ({
    title: cleanNoise(candidate.title).slice(0, 220),
    snippet: cleanNoise(candidate.snippet).slice(0, 600),
    sourceHint: candidate.sourceHint,
    ingestionSource: candidate.ingestionSource,
    thumbnailUrl: candidate.thumbnailUrl ?? null,
    matchTokens: extractTokens(`${candidate.title} ${candidate.snippet}`),
    oemReferences: candidate.oemReferences ?? [],
    alternateReferences: candidate.alternateReferences ?? [],
    fitmentClues: candidate.fitmentClues ?? [],
    description: candidate.description ?? null,
    imageHints: candidate.imageHints ?? [],
    sourceIdentity: candidate.sourceIdentity ?? candidate.sourceHint,
    sourceUrl: candidate.sourceUrl ?? null,
    evidenceSignature: signatureOf(candidate),
  }));
}
