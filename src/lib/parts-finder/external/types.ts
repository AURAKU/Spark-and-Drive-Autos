/** Single organic-style hit after ingestion (web or deterministic fallback). Never shown raw to end users. */
export type ExternalCandidate = {
  title: string;
  snippet: string;
  /** Domain or source label for internal ranking — not shown as raw URLs to users in MVP UI. */
  sourceHint: string;
  ingestionSource: "SERPER_WEB" | "FALLBACK_PREVIEW";
  /** Optional thumbnail if ingestion provides one. */
  thumbnailUrl?: string | null;
  oemReferences?: string[];
  alternateReferences?: string[];
  fitmentClues?: string[];
  imageHints?: string[];
  sourceIdentity?: string;
  sourceUrl?: string | null;
  description?: string;
};
