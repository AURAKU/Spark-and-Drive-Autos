import Link from "next/link";

import { PartsFinderCtaLink } from "@/components/parts-finder/parts-finder-cta-link";
import { PartsFinderProxiedImage } from "@/components/parts-finder/parts-finder-proxied-image";
import { notFound, redirect } from "next/navigation";

import { PartsFinderResultCards } from "@/components/parts-finder/parts-finder-result-cards";
import { requireSessionOrRedirect } from "@/lib/auth-helpers";
import { getPartsFinderAccessSnapshot } from "@/lib/parts-finder/access";
import { normalizePartsFinderImageUrl } from "@/lib/parts-finder/image-url";
import { getPartsFinderSessionForUser } from "@/lib/parts-finder/persistence";

export const dynamic = "force-dynamic";

const OEM_STOP_WORDS = new Set([
  "TOYOTA",
  "COROLLA",
  "FACTORY",
  "FILTER",
  "PONTIAC",
  "ENGINE",
  "OIL",
]);

function cleanOemCodes(values: string[]): string[] {
  return [...new Set(values.map((x) => x.trim().toUpperCase()))].filter((code) => {
    if (!code || OEM_STOP_WORDS.has(code)) return false;
    const hasDigit = /\d/.test(code);
    const looksCode = /^[A-Z0-9-]{5,24}$/.test(code);
    return hasDigit && looksCode;
  });
}

function extractMayAlsoFit(items: string[]): Array<{ make: string; model: string; years?: string; note: string }> {
  const out: Array<{ make: string; model: string; years?: string; note: string }> = [];
  const rx = /\b(Toyota|Lexus|Honda|Nissan|Mazda|Kia|Hyundai|Ford|Chevrolet|Pontiac|Scion)\s+([A-Za-z0-9-]+)(?:\s*\(?([12][0-9]{3}(?:\s*-\s*[12][0-9]{3})?)\)?)?/gi;
  for (const text of items) {
    let match: RegExpExecArray | null = rx.exec(text);
    while (match) {
      out.push({
        make: match[1] ?? "Vehicle",
        model: match[2] ?? "Model",
        years: match[3]?.replace(/\s+/g, " ").trim(),
        note: "Verify by VIN/chassis before purchase.",
      });
      match = rx.exec(text);
    }
  }
  return out.slice(0, 6);
}

function quickVerdict(params: {
  confidence: "LOW" | "MEDIUM";
  oemCount: number;
  matchCount: number;
}): string {
  if (params.confidence === "MEDIUM" && params.oemCount >= 2) {
    return "Most likely correct part, but engine variant must be confirmed.";
  }
  if (params.matchCount >= 2 && params.oemCount >= 1) {
    return "Multiple compatible options found. Verify using VIN/chassis before purchase.";
  }
  return "Low confidence match. Manual verification is required before purchase.";
}

function sanitizeCustomerText(input: string | null | undefined): string {
  const raw = (input ?? "").trim();
  if (!raw) return "";
  const blocked = /(ai|openai|anthropic|serper|web-?discovery|external data|provider unavailable|timed out|amazon|walmart|ebay|autozone)/i;
  if (!blocked.test(raw)) return raw;
  return "Compatibility guidance based on catalog patterns and supplier fitment signals.";
}

function normalizeResultImageList(
  images: Array<{ url?: string; kind?: string }> | null | undefined,
): Array<{ url: string; kind: string }> {
  if (!Array.isArray(images)) return [];
  return images
    .map((im) => {
      const url = normalizePartsFinderImageUrl(im?.url);
      if (!url) return null;
      return { url, kind: typeof im?.kind === "string" ? im.kind : "REFERENCE" };
    })
    .filter((x): x is { url: string; kind: string } => x !== null);
}

export default async function PublicPartsFinderResultDetailPage(props: { params: Promise<{ id: string }> }) {
  const session = await requireSessionOrRedirect("/parts-finder/search");
  const access = await getPartsFinderAccessSnapshot();
  if (!access.allowResults) {
    redirect("/parts-finder/activate");
  }

  const { id } = await props.params;
  const row = await getPartsFinderSessionForUser(id, session.user.id);
  if (!row) notFound();
  const meta = (row.metadataJson ?? {}) as Record<string, unknown>;
  const safePayload = {
    summary: meta.summary ?? null,
    confidence: meta.confidence ?? null,
    review: meta.review ?? null,
    results: meta.results ?? [],
    ai: meta.ai ?? null,
    normalizedInput: meta.normalizedInput ?? null,
    normalizedQuery: meta.normalizedQuery ?? null,
    rawHits: meta.rawHits ?? [],
    result: meta.result ?? null,
    rankedResults: meta.rankedResults ?? [],
    refinedResults: meta.refinedResults ?? [],
  };
  const ai = (safePayload.ai ?? {}) as {
    enabled?: boolean;
    summary?: string;
    possibleOemNumbers?: string[];
    possiblePartNames?: string[];
    fitmentNotes?: string[];
    confidence?: "LOW" | "MEDIUM";
    warnings?: string[];
    disclaimer?: string;
  };
  const normalizedQuery =
    (typeof safePayload.normalizedQuery === "string" && safePayload.normalizedQuery.trim().length > 0
      ? safePayload.normalizedQuery
      : null) ??
    ((safePayload.normalizedInput as { partIntent?: string | null } | null)?.partIntent ?? null);
  const results = Array.isArray(safePayload.results)
    ? (safePayload.results as Array<{
        candidate?: {
          candidatePartName?: string;
          summaryExplanation?: string;
          partFunctionSummary?: string;
          fitmentNotes?: string | null;
          oemCodes?: Array<{ code?: string; label?: string | null }>;
          images?: Array<{ url?: string; kind?: string }>;
        };
      }>)
    : [];
  const topCandidate = results[0]?.candidate;
  const topOemNumbersRaw = Array.isArray(topCandidate?.oemCodes)
    ? topCandidate.oemCodes
        .map((item) => item?.code?.trim())
        .filter((value): value is string => Boolean(value))
        .slice(0, 8)
    : [];
  const aiOemRaw = Array.isArray(ai.possibleOemNumbers) ? ai.possibleOemNumbers : [];
  const mergedOem = cleanOemCodes([...topOemNumbersRaw, ...aiOemRaw]);
  const confirmedOem = mergedOem.slice(0, 3);
  const possibleOem = mergedOem.slice(3, 8);
  const rankedRows = Array.isArray(safePayload.rankedResults)
    ? (safePayload.rankedResults as Array<{ images?: Array<{ url?: string; kind?: string }> }>)
    : [];
  const refinedRows = Array.isArray(safePayload.refinedResults)
    ? (safePayload.refinedResults as Array<{ images?: Array<{ url?: string; kind?: string }> }>)
    : [];
  const candidateImages = normalizeResultImageList(
    Array.isArray(topCandidate?.images) ? topCandidate.images : [],
  ).map((x) => x.url);
  const rawHitThumbnails = Array.isArray(safePayload.rawHits)
    ? (safePayload.rawHits as Array<{ thumbnailUrl?: string | null }>)
        .map((row) => normalizePartsFinderImageUrl(row.thumbnailUrl))
        .filter((value): value is string => Boolean(value))
    : [];
  const rankedFallbackFlat = [
    ...normalizeResultImageList(rankedRows[0]?.images).map((x) => x.url),
    ...normalizeResultImageList(refinedRows[0]?.images).map((x) => x.url),
  ];
  const supportImages = [...new Set([...candidateImages, ...rawHitThumbnails, ...rankedFallbackFlat])].slice(0, 5);
  const resultsWithImageFallback = results.map((row, idx) => {
    const candidate = row.candidate ?? {};
    const normalizedOwn = normalizeResultImageList(
      Array.isArray(candidate.images) ? candidate.images : undefined,
    );
    if (normalizedOwn.length > 0) {
      return {
        ...row,
        candidate: {
          ...candidate,
          images: normalizedOwn,
        },
      };
    }
    const fromRaw = rawHitThumbnails.slice(idx, idx + 3).map((url) => ({ url, kind: "REFERENCE" as const }));
    if (fromRaw.length > 0) {
      return { ...row, candidate: { ...candidate, images: fromRaw } };
    }
    const fromRankedIdx = normalizeResultImageList(rankedRows[idx]?.images);
    if (fromRankedIdx.length > 0) {
      return { ...row, candidate: { ...candidate, images: fromRankedIdx } };
    }
    const fromRanked0 = normalizeResultImageList(rankedRows[0]?.images);
    if (fromRanked0.length > 0) {
      return { ...row, candidate: { ...candidate, images: fromRanked0 } };
    }
    return row;
  });
  const mayAlsoFit = extractMayAlsoFit([
    ...(Array.isArray(ai.fitmentNotes) ? ai.fitmentNotes : []),
    ...(Array.isArray(ai.warnings) ? ai.warnings : []),
    topCandidate?.fitmentNotes ?? "",
    topCandidate?.summaryExplanation ?? "",
  ]);
  const vehicleInput = (safePayload.normalizedInput ?? {}) as {
    brand?: string | null;
    model?: string | null;
    year?: number | null;
    engine?: string | null;
  };
  const normalizedResult = (safePayload.result ?? null) as
    | {
        quickVerdict?: string;
        functionSummary?: string;
        maintenanceNote?: string;
        symptoms?: string;
        oemNumbers?: {
          primary?: string | null;
          alternatives?: string[];
          aftermarket?: string[];
          confidence?: "high" | "medium" | "low";
        };
      }
    | null;
  const searchedVehicle = [vehicleInput.year, vehicleInput.brand, vehicleInput.model, vehicleInput.engine]
    .filter(Boolean)
    .join(" ");
  const verdict = quickVerdict({
    confidence: ai.confidence ?? "LOW",
    oemCount: mergedOem.length,
    matchCount: results.length,
  });

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-semibold">Spark &amp; Drive Parts Intelligence</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Session {id} · Spark &amp; Drive Gear compatibility guidance.
      </p>
      <div className="mt-3 rounded-xl border border-[var(--brand)]/25 bg-[var(--brand)]/8 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--brand)]">Quick verdict</p>
        <p className="mt-1 text-sm text-foreground">{normalizedResult?.quickVerdict ?? verdict}</p>
      </div>
      <div className="mt-4 rounded-xl border border-amber-500/35 bg-amber-500/10 p-4 text-xs leading-relaxed text-amber-100">
        <p className="font-semibold uppercase tracking-wide">Fitment Notice</p>
        <p className="mt-2">
          Always confirm compatibility using VIN or chassis number before purchase. Spark &amp; Drive provides guidance
          based on catalog and supplier fitment signals. Final verification is required.
        </p>
      </div>
      <div className="mt-6">
        {topCandidate ? (
          <div className="mb-4 rounded-xl border border-border bg-card p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Part Intelligence Summary</p>
            <h2 className="mt-1 text-base font-semibold text-foreground">
              {topCandidate.candidatePartName ?? "Detected part candidate"}
            </h2>
            {searchedVehicle ? (
              <p className="mt-1 text-xs text-muted-foreground">Vehicle searched: {searchedVehicle}</p>
            ) : null}
            <p className="mt-2 text-sm text-muted-foreground">
              {topCandidate.summaryExplanation ??
                "Catalog and supplier fitment signals were reviewed to identify likely part candidates for your vehicle."}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {normalizedResult?.functionSummary ??
                topCandidate.partFunctionSummary ??
                "This component supports core vehicle operation and should be replaced with a VIN/chassis-matched part to avoid fitment or performance issues."}
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <div className="rounded-lg border border-border bg-muted/20 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Maintenance note</p>
                <p className="mt-1 text-xs text-foreground">
                  {normalizedResult?.maintenanceNote ??
                    "Replace according to manufacturer schedule or earlier when contamination, leakage, or pressure issues are observed."}
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/20 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Symptoms to watch</p>
                <p className="mt-1 text-xs text-foreground">
                  {normalizedResult?.symptoms ??
                    "Reduced performance, unusual engine noise, warning lights, or poor lubrication response may indicate mismatch or wear."}
                </p>
              </div>
            </div>
            <div className="mt-3 rounded-lg border border-border bg-muted/20 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Compatibility insight</p>
              <p className="mt-1 text-sm text-foreground">Supplier/catalog evidence reviewed.</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Confidence: {ai.confidence ?? "LOW"} · Verification status: VIN/chassis confirmation required.
              </p>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <div className="rounded-lg border border-border bg-muted/20 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">OEM / Reference Numbers</p>
                <p className="mt-1 text-xs text-foreground">
                  Primary:{" "}
                  <span className="font-medium">
                    {normalizedResult?.oemNumbers?.primary ??
                      (confirmedOem.length > 0 ? confirmedOem.join(", ") : "Not confidently identified")}
                  </span>
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Alternatives:{" "}
                  <span className="font-medium">
                    {normalizedResult?.oemNumbers?.alternatives?.length
                      ? normalizedResult.oemNumbers.alternatives.join(", ")
                      : possibleOem.length > 0
                        ? possibleOem.join(", ")
                        : "None"}
                  </span>
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Aftermarket:{" "}
                  <span className="font-medium">
                    {normalizedResult?.oemNumbers?.aftermarket?.length
                      ? normalizedResult.oemNumbers.aftermarket.join(", ")
                      : ai.possiblePartNames?.slice(0, 3).join(", ") || "None identified"}
                  </span>
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/20 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">May also fit</p>
                {mayAlsoFit.length > 0 ? (
                  <ul className="mt-1 space-y-1 text-xs text-foreground">
                    {mayAlsoFit.map((row) => (
                      <li key={`${row.make}-${row.model}-${row.years ?? "na"}`}>
                        {row.make} {row.model}
                        {row.years ? ` (${row.years})` : ""} - <span className="text-muted-foreground">{row.note}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-xs text-muted-foreground">No additional vehicle fitment was confidently inferred.</p>
                )}
              </div>
            </div>
            {supportImages.length > 0 ? (
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {supportImages.slice(0, 4).map((url, idx) => (
                  <PartsFinderProxiedImage
                    key={`${url}-${idx}`}
                    imageUrl={url}
                    alt={`${topCandidate.candidatePartName ?? "Part"} product image ${idx + 1}`}
                  />
                ))}
              </div>
            ) : (
              <div className="mt-3 flex min-h-64 items-center justify-center rounded-md border border-dashed border-border bg-muted/20 px-2 text-center text-xs text-muted-foreground">
                Product image unavailable
              </div>
            )}
          </div>
        ) : null}

        {normalizedQuery ? (
          <div className="mb-4 rounded-xl border border-border bg-card p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Normalized query</p>
            <p className="mt-1 text-sm text-foreground">{normalizedQuery}</p>
          </div>
        ) : null}

        <div className="mb-4 rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-foreground">Compatibility insight</p>
            <span className="rounded-full border border-[var(--brand)]/30 bg-[var(--brand)]/10 px-2 py-0.5 text-[10px] font-semibold text-[var(--brand)]">
              {ai.confidence ?? "LOW"} confidence
            </span>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {sanitizeCustomerText(ai.summary) ||
              "Catalog and supplier fitment signals were reviewed. Final confirmation requires VIN/chassis verification before purchase."}
          </p>
          {Array.isArray(ai.fitmentNotes) && ai.fitmentNotes.length > 0 ? (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
              {ai.fitmentNotes.map((note) => (
                <li key={note}>{sanitizeCustomerText(note)}</li>
              ))}
            </ul>
          ) : null}
          {Array.isArray(ai.warnings) && ai.warnings.length > 0 ? (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-amber-500">
              {ai.warnings
                .map((warning) => sanitizeCustomerText(warning))
                .filter(Boolean)
                .map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
            </ul>
          ) : null}
          <p className="mt-3 text-[11px] text-amber-400">
            Verification required before purchase.
          </p>
        </div>

        <PartsFinderResultCards sessionId={id} results={resultsWithImageFallback} />
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
        <PartsFinderCtaLink href="/parts-finder/search" size="compact" className="!px-3.5">
          Find Parts
        </PartsFinderCtaLink>
        <Link href="/dashboard/parts-finder/searches" className="rounded-lg border border-border px-3 py-1.5 hover:bg-muted/40">
          Search history
        </Link>
      </div>
    </div>
  );
}
