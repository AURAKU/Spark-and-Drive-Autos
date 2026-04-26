"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { PartsFinderProxiedImage } from "@/components/parts-finder/parts-finder-proxied-image";
import { normalizePartsFinderImageUrl } from "@/lib/parts-finder/image-url";

type SafeResult = {
  id: string;
  candidate: {
    candidatePartName?: string;
    confidenceLabel?: string;
    confidenceScore?: number;
    fitmentNotes?: string | null;
    oemCodes?: Array<{ code?: string; label?: string | null }>;
    images?: Array<{ url?: string; kind?: string }>;
    summaryExplanation?: string;
    partFunctionSummary?: string;
    verificationLevel?: "verified" | "likely" | "unverified";
    verificationSource?: "vin_match" | "oem_match" | "cross_reference" | "pattern";
    verificationScore?: number;
  };
  confidenceLabel?: string | null;
  confidenceScore?: number | null;
  isTopResult?: boolean;
};

function toTier(score: number, label: string): "high" | "medium" | "low" {
  if (label === "VERIFIED_MATCH" || score >= 85) return "high";
  if (label === "LIKELY_MATCH" || score >= 65) return "medium";
  return "low";
}

function fitmentStatus(tier: "high" | "medium" | "low"): "likely" | "verify" | "low" {
  if (tier === "high") return "likely";
  if (tier === "medium") return "verify";
  return "low";
}

function tierHeading(tier: "high" | "medium" | "low"): string {
  if (tier === "high") return "Top Matches";
  if (tier === "medium") return "Other Compatible Options";
  return "Requires Verification";
}

function extractCompatibleVehicles(text: string): string[] {
  const rx = /\b(Toyota|Lexus|Honda|Nissan|Mazda|Kia|Hyundai|Ford|Chevrolet|Pontiac|Scion)\s+([A-Za-z0-9-]+)\b/gi;
  const out: string[] = [];
  let m: RegExpExecArray | null = rx.exec(text);
  while (m) {
    out.push(`${m[1]} ${m[2]}`);
    m = rx.exec(text);
  }
  return [...new Set(out)].slice(0, 4);
}

export function PartsFinderResultCards(props: {
  sessionId: string;
  results: unknown;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<null | "save" | "source" | "chat" | "quote">(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [vinModalOpen, setVinModalOpen] = useState(false);
  const [vinInput, setVinInput] = useState("");

  const rows = useMemo(() => {
    if (!Array.isArray(props.results)) return [];
    return props.results as SafeResult[];
  }, [props.results]);

  async function callJson(url: string, body: Record<string, unknown>, mode: "save" | "source" | "chat" | "quote") {
    setBusy(mode);
    setMessage(null);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        message?: string;
        code?: string;
        redirectTo?: string;
      };
      if (!res.ok || data.ok === false) {
        if (data.redirectTo) {
          router.push(data.redirectTo);
          return false;
        }
        if (data.code === "AUTH_REQUIRED") {
          router.push(`/login?callbackUrl=${encodeURIComponent(`/parts-finder/results/${props.sessionId}`)}`);
          return false;
        }
        setMessage(data.error ?? "We could not complete this action. Please try again.");
        return false;
      }
      setMessage(data.message ?? "Action completed.");
      return true;
    } finally {
      setBusy(null);
    }
  }

  async function onSave() {
    const ok = await callJson("/api/parts-finder/results/save", { resultId: props.sessionId }, "save");
    if (ok) {
      setSaved(true);
      setMessage("Request saved successfully.");
    }
  }

  async function onRequestSourcing(topName: string, topSnapshot?: unknown) {
    setBusy("source");
    setMessage(null);
    try {
      const createRes = await fetch("/api/verified-parts/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          partsFinderSearchId: props.sessionId,
          partName: topName || "part candidate",
          selectedMatchSnapshot: topSnapshot ?? null,
        }),
      });
      const created = (await createRes.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        code?: string;
        redirectTo?: string;
        request?: { id?: string };
      };
      if (!createRes.ok || created.ok === false || !created.request?.id) {
        if (created.redirectTo) {
          router.push(created.redirectTo);
          return;
        }
        if (created.code === "AUTH_REQUIRED") {
          router.push(`/login?callbackUrl=${encodeURIComponent(`/parts-finder/results/${props.sessionId}`)}`);
          return;
        }
        setMessage("Request saved. Payment setup is pending.");
        return;
      }
      const payRes = await fetch(`/api/verified-parts/${encodeURIComponent(created.request.id)}/pay`, {
        method: "POST",
      });
      const pay = (await payRes.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        code?: string;
        redirectTo?: string;
        policyKey?: string;
        authorizationUrl?: string;
      };
      if (!payRes.ok || pay.ok === false || !pay.authorizationUrl) {
        if (pay.redirectTo) {
          router.push(pay.redirectTo);
          return;
        }
        if (pay.code === "LEGAL_ACCEPTANCE_REQUIRED") {
          setMessage("Accept required legal terms from your dashboard, then retry payment.");
          return;
        }
        if (pay.code === "AUTH_REQUIRED") {
          router.push(`/login?callbackUrl=${encodeURIComponent(`/parts-finder/results/${props.sessionId}`)}`);
          return;
        }
        setMessage("We could not complete this action. Please try again.");
        return;
      }
      window.location.href = pay.authorizationUrl;
    } finally {
      setBusy(null);
    }
  }

  async function onOpenChat() {
    const ok = await callJson("/api/parts-finder/conversion", { resultId: props.sessionId, conversionType: "OPEN_CHAT" }, "chat");
    if (ok) router.push(`/dashboard/chats?partsFinderSession=${encodeURIComponent(props.sessionId)}`);
  }

  async function onRequestQuote() {
    const top = rows[0]?.candidate ?? {};
    const hasVinInContext = /\bvin\b/i.test(`${top.fitmentNotes ?? ""} ${top.summaryExplanation ?? ""}`);
    if (!hasVinInContext) {
      setVinModalOpen(true);
      return;
    }
    const ok = await callJson("/api/parts-finder/conversion", { resultId: props.sessionId, conversionType: "REQUEST_QUOTE" }, "quote");
    if (ok) router.push(`/dashboard/inquiry-requests?partsFinderSession=${encodeURIComponent(props.sessionId)}#inquiries`);
  }

  async function submitVinCheck() {
    const vinLike = vinInput.trim().toUpperCase();
    if (!vinLike) {
      setMessage("Enter VIN or chassis number to continue.");
      return;
    }
    const top = rows[0]?.candidate ?? {};
    await onRequestSourcing(top.candidatePartName ?? "part candidate", {
      ...top,
      vinOrChassis: vinLike,
    });
    setVinModalOpen(false);
  }

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No curated results available for this session.</p>;
  }

  const topCandidateName = rows[0]?.candidate?.candidatePartName ?? "part candidate";
  const grouped = {
    high: [] as SafeResult[],
    medium: [] as SafeResult[],
    low: [] as SafeResult[],
  };
  for (const row of rows) {
    const candidate = row.candidate ?? {};
    const confidenceLabel = row.confidenceLabel ?? candidate.confidenceLabel ?? "NEEDS_VERIFICATION";
    const confidenceScore = row.confidenceScore ?? candidate.confidenceScore ?? 0;
    grouped[toTier(confidenceScore, confidenceLabel)].push(row);
  }
  const orderedSections: Array<["high" | "medium" | "low", SafeResult[]]> = [
    ["high", grouped.high],
    ["medium", grouped.medium],
    ["low", grouped.low],
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onRequestSourcing.bind(null, topCandidateName, rows[0]?.candidate ?? null)}
          disabled={busy !== null}
          className="rounded-lg bg-[var(--brand)] px-3 py-2 text-sm font-semibold text-black disabled:opacity-60"
        >
          {busy === "source" ? "Requesting..." : "Request Verified Part"}
        </button>
        <button
          type="button"
          onClick={onOpenChat}
          disabled={busy !== null}
          className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted/40 disabled:opacity-60"
        >
          {busy === "chat" ? "Opening..." : "Talk to Parts Specialist"}
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={busy !== null || saved}
          className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted/40 disabled:opacity-60"
        >
          {busy === "save" ? "Saving..." : saved ? "Saved" : "Save Result"}
        </button>
        <button
          type="button"
          onClick={onRequestQuote}
          disabled={busy !== null}
          className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted/40 disabled:opacity-60"
        >
          {busy === "quote" ? "Submitting..." : "Get Exact Match (VIN Check)"}
        </button>
      </div>
      {message ? <p className="text-xs text-muted-foreground">{message}</p> : null}
      {vinModalOpen ? (
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-xs font-semibold text-foreground">Enter VIN or chassis number for exact fitment check</p>
          <div className="mt-2 flex gap-2">
            <input
              value={vinInput}
              onChange={(e) => setVinInput(e.target.value)}
              placeholder="VIN or chassis"
              className="h-9 flex-1 rounded-md border border-border bg-background px-2 text-xs"
            />
            <button
              type="button"
              onClick={() => void submitVinCheck()}
              className="rounded-md border border-border px-2.5 py-1 text-xs hover:bg-muted/40"
            >
              Submit
            </button>
            <button
              type="button"
              onClick={() => setVinModalOpen(false)}
              className="rounded-md border border-border px-2.5 py-1 text-xs hover:bg-muted/40"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
      {orderedSections.map(([tier, sectionRows]) => (
        sectionRows.length > 0 ? (
          <section key={tier} className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{tierHeading(tier)}</h3>
            {sectionRows.map((row) => {
              const candidate = row.candidate ?? {};
              const confidenceLabel = row.confidenceLabel ?? candidate.confidenceLabel ?? "NEEDS_VERIFICATION";
              const confidenceScore = row.confidenceScore ?? candidate.confidenceScore ?? 0;
              const rowTier = toTier(confidenceScore, confidenceLabel);
              const status = fitmentStatus(rowTier);
              const brandGuess = (candidate.candidatePartName ?? "").split(" ")[0] || "Catalog";
              const partNumber = Array.isArray(candidate.oemCodes)
                ? candidate.oemCodes.map((x) => x.code).filter(Boolean)[0]
                : null;
              const references = Array.isArray(candidate.oemCodes)
                ? candidate.oemCodes.map((x) => x.code).filter(Boolean).slice(0, 4)
                : [];
              const imageUrls = Array.isArray(candidate.images)
                ? candidate.images
                    .map((x) => normalizePartsFinderImageUrl(x?.url))
                    .filter((url): url is string => Boolean(url))
                    .slice(0, 4)
                : [];
              const compatibleVehicles = extractCompatibleVehicles(
                `${candidate.fitmentNotes ?? ""} ${candidate.summaryExplanation ?? ""}`,
              );
              const verificationLevel =
                candidate.verificationLevel ?? (rowTier === "high" ? "verified" : rowTier === "medium" ? "likely" : "unverified");
              const verificationText =
                verificationLevel === "verified"
                  ? "✅ Verified Fit"
                  : verificationLevel === "likely"
                    ? "🟡 Likely Fit"
                    : "⚠️ Verify Before Purchase";
              return (
                <article key={row.id} className="rounded-xl border border-border bg-card p-4">
                  <h3 className="mt-1 text-base font-semibold">{candidate.candidatePartName ?? "Unspecified part candidate"}</h3>
                  <p className="mt-1 text-xs font-semibold text-foreground">{verificationText}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Brand: {brandGuess} {partNumber ? `· Part number: ${partNumber}` : "· Part number: Not confidently identified"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Match confidence: {confidenceLabel} · {confidenceScore}%
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Verification score: {Math.round(Number(candidate.verificationScore ?? confidenceScore))}%
                  </p>
                  <p className="mt-1 text-xs text-foreground">
                    Fitment status:{" "}
                    <span className="font-semibold">
                      {status === "likely" ? "Likely match" : status === "verify" ? "Needs verification" : "Low confidence"}
                    </span>
                  </p>
                  {references.length > 0 ? (
                    <p className="mt-2 text-xs">
                      Reference candidates: <span className="font-medium">{references.join(", ")}</span>
                    </p>
                  ) : (
                    <p className="mt-2 text-xs text-amber-500">Reference candidates not confidently identified.</p>
                  )}
                  {compatibleVehicles.length > 0 ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Compatible vehicles: <span className="font-medium">{compatibleVehicles.join(", ")}</span>
                    </p>
                  ) : null}
                  <p className="mt-2 text-sm text-muted-foreground">
                    {candidate.fitmentNotes ?? candidate.summaryExplanation ?? "Fitment guidance indicates verification is required."}
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {candidate.partFunctionSummary ??
                      "Function in vehicle should be verified with VIN/chassis and supplier fitment confirmation."}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Matched based on OEM cross-reference and engine compatibility patterns.
                  </p>
                  <p className="mt-2 text-xs text-amber-500">VIN/chassis verification required before purchase.</p>
                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {imageUrls.length > 0 ? (
                      imageUrls.map((url, idx) => (
                        <PartsFinderProxiedImage
                          key={`${row.id}-img-${idx}`}
                          imageUrl={url}
                          alt={`${candidate.candidatePartName ?? "Part"} product image ${idx + 1}`}
                        />
                      ))
                    ) : (
                      <div className="col-span-2 flex min-h-64 items-center justify-center rounded-md border border-dashed border-border bg-muted/20 px-1 text-center text-xs text-muted-foreground sm:col-span-2">
                        Product image unavailable
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </section>
        ) : null
      ))}
    </div>
  );
}
