"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";

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
  };
  confidenceLabel?: string | null;
  confidenceScore?: number | null;
  isTopResult?: boolean;
};

function displayBand(index: number) {
  if (index === 0) return "Best Match";
  if (index === 1) return "Alternative Match";
  return "Needs Verification";
}

export function PartsFinderResultCards(props: {
  sessionId: string;
  results: unknown;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<null | "save" | "source" | "chat" | "quote">(null);
  const [message, setMessage] = useState<string | null>(null);

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
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; message?: string };
      if (!res.ok || data.ok === false) {
        setMessage(data.error ?? "Action failed.");
        return false;
      }
      setMessage(data.message ?? "Action completed.");
      return true;
    } finally {
      setBusy(null);
    }
  }

  async function onSave() {
    await callJson("/api/parts-finder/save-result", { resultId: props.sessionId }, "save");
  }

  async function onRequestSourcing(topName: string) {
    await callJson(
      "/api/parts-finder/request-sourcing",
      {
        resultId: props.sessionId,
        note: `Customer requested sourcing for: ${topName || "part candidate"}`,
      },
      "source",
    );
  }

  async function onOpenChat() {
    const ok = await callJson("/api/parts-finder/conversion", { resultId: props.sessionId, conversionType: "OPEN_CHAT" }, "chat");
    if (ok) router.push(`/dashboard/chats?partsFinderSession=${encodeURIComponent(props.sessionId)}`);
  }

  async function onRequestQuote() {
    const ok = await callJson("/api/parts-finder/conversion", { resultId: props.sessionId, conversionType: "REQUEST_QUOTE" }, "quote");
    if (ok) router.push(`/dashboard/inquiries?partsFinderSession=${encodeURIComponent(props.sessionId)}`);
  }

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No curated results available for this session.</p>;
  }

  const topCandidateName = rows[0]?.candidate?.candidatePartName ?? "part candidate";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onRequestSourcing.bind(null, topCandidateName)}
          disabled={busy !== null}
          className="rounded-lg bg-[var(--brand)] px-3 py-2 text-sm font-semibold text-black disabled:opacity-60"
        >
          {busy === "source" ? "Requesting..." : "Request Sourcing"}
        </button>
        <button
          type="button"
          onClick={onOpenChat}
          disabled={busy !== null}
          className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted/40 disabled:opacity-60"
        >
          {busy === "chat" ? "Opening..." : "Chat for Confirmation"}
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={busy !== null}
          className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted/40 disabled:opacity-60"
        >
          {busy === "save" ? "Saving..." : "Save Result"}
        </button>
        <button
          type="button"
          onClick={onRequestQuote}
          disabled={busy !== null}
          className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted/40 disabled:opacity-60"
        >
          {busy === "quote" ? "Submitting..." : "Request Quote"}
        </button>
      </div>
      {message ? <p className="text-xs text-muted-foreground">{message}</p> : null}
      {rows.map((row, index) => {
        const candidate = row.candidate ?? {};
        const confidenceLabel = row.confidenceLabel ?? candidate.confidenceLabel ?? "NEEDS_VERIFICATION";
        const confidenceScore = row.confidenceScore ?? candidate.confidenceScore ?? 0;
        const references = Array.isArray(candidate.oemCodes) ? candidate.oemCodes.map((x) => x.code).filter(Boolean).slice(0, 4) : [];
        const imageUrls = Array.isArray(candidate.images)
          ? candidate.images
              .map((x) => x?.url?.trim())
              .filter((url): url is string => Boolean(url))
              .slice(0, 3)
          : [];
        const imageSlots = Array.from({ length: 3 }, (_, i) => imageUrls[i] ?? null);
        return (
          <article key={row.id} className="rounded-xl border border-border bg-card p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{displayBand(index)}</p>
            <h3 className="mt-1 text-base font-semibold">{candidate.candidatePartName ?? "Unspecified part candidate"}</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {confidenceLabel} · {confidenceScore}%
            </p>
            {references.length > 0 ? (
              <p className="mt-2 text-xs">
                Likely references: <span className="font-medium">{references.join(", ")}</span>
              </p>
            ) : (
              <p className="mt-2 text-xs text-amber-500">No strong OEM reference extracted; verify before purchase.</p>
            )}
            <p className="mt-2 text-sm text-muted-foreground">
              {candidate.fitmentNotes ?? candidate.summaryExplanation ?? "Fitment requires final confirmation with VIN/chassis."}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {candidate.partFunctionSummary ??
                "Part function summary is based on detected intent and should be confirmed against your exact vehicle configuration."}
            </p>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {imageSlots.map((url, idx) =>
                url ? (
                  <a key={`${row.id}-img-${idx}`} href={url} target="_blank" rel="noreferrer" className="group">
                    <Image
                      src={url}
                      alt={`${candidate.candidatePartName ?? "Part"} reference ${idx + 1}`}
                      width={320}
                      height={160}
                      className="h-20 w-full rounded-md border border-border object-cover transition group-hover:opacity-90"
                      loading="lazy"
                    />
                  </a>
                ) : (
                  <div
                    key={`${row.id}-img-placeholder-${idx}`}
                    className="flex h-20 items-center justify-center rounded-md border border-dashed border-border bg-muted/20 px-1 text-center text-[10px] text-muted-foreground"
                  >
                    Reference image unavailable
                  </div>
                ),
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}
