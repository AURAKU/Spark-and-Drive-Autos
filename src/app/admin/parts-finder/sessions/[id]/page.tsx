import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { PartsFinderJsonPanel } from "@/components/parts-finder/parts-finder-json-panel";
import { PageHeading } from "@/components/typography/page-headings";
import { requireAdmin } from "@/lib/auth-helpers";
import { PARTS_FINDER_PRODUCT_NAME } from "@/lib/parts-finder/marketing-copy";
import { applyPartsFinderReviewOverride } from "@/lib/parts-finder/persistence";
import { partsFinderReviewOverrideSchema } from "@/lib/parts-finder/schemas";
import { prisma } from "@/lib/prisma";
import { safeAuth } from "@/lib/safe-auth";

import { isAdminRole } from "@/auth";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
type Props = { params: Promise<{ id: string }>; searchParams: SearchParams };

export default async function AdminPartsFinderSessionDetailPage(props: Props) {
  const auth = await safeAuth();
  if (!auth?.user?.role || !isAdminRole(auth.user.role)) redirect("/dashboard");

  const { id } = await props.params;
  const sp = await props.searchParams;
  const opSuccess = typeof sp.success === "string" ? sp.success : "";
  const opError = typeof sp.error === "string" ? sp.error : "";
  const row = await prisma.partsFinderSearchSession.findFirst({
    where: {
      sessionId: id,
    },
    select: {
      id: true,
      sessionId: true,
      status: true,
      confidenceLabel: true,
      confidenceScore: true,
      safetyFlagsJson: true,
      inputJson: true,
      normalizedJson: true,
      vehicleJson: true,
      queryFormsJson: true,
      rawResultsJson: true,
      rankedResultsJson: true,
      summaryJson: true,
      confidenceJson: true,
      results: {
        orderBy: [{ isTopResult: "desc" }, { createdAt: "asc" }],
        take: 1,
        select: { id: true },
      },
      reviewOverrides: {
        orderBy: { createdAt: "desc" },
        take: 25,
        select: {
          id: true,
          status: true,
          confidence: true,
          note: true,
          summaryOverride: true,
          correctedPartName: true,
          correctedOemCodes: true,
          candidateBefore: true,
          candidateAfter: true,
          createdAt: true,
          reviewer: { select: { email: true, name: true } },
        },
      },
      outcomes: {
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          outcomeStatus: true,
          note: true,
          candidateSignature: true,
          createdAt: true,
          reviewer: { select: { email: true, name: true } },
        },
      },
      reviewedAt: true,
      reviewedById: true,
      reviewNote: true,
      adminSummaryOverride: true,
      createdAt: true,
      user: { select: { email: true, name: true } },
    },
  });
  if (!row) notFound();
  const normalized = (row.normalizedJson as Record<string, unknown> | undefined) ?? {};
  const parsedVehicle = (row.vehicleJson as Record<string, unknown> | undefined) ?? {};
  const queryForms = (row.queryFormsJson as Record<string, unknown> | undefined) ?? {};
  const rawHits = (row.rawResultsJson as unknown[] | undefined) ?? [];
  const rankedResults = (row.rankedResultsJson as unknown[] | undefined) ?? [];
  const summary = (row.summaryJson as Record<string, unknown> | undefined) ?? {};
  const confidence = (row.confidenceJson as Record<string, unknown> | undefined) ?? {};
  const safetyFlags = (row.safetyFlagsJson as Record<string, unknown> | undefined) ?? {};
  const uncertaintyNotes = Array.isArray(summary.uncertaintyNotes)
    ? (summary.uncertaintyNotes as unknown[]).map((x) => String(x))
    : [];
  const warnings = Array.isArray(summary.warnings) ? (summary.warnings as unknown[]).map((x) => String(x)) : [];
  const firstResultId = row.results[0]?.id ?? "";
  const confidenceOverall = confidence.overallConfidence ?? row.confidenceScore;
  const confidenceLabelFromJson = confidence.label ?? row.confidenceLabel;
  const reviewOverrideAction = async (formData: FormData) => {
    "use server";
    try {
      const session = await requireAdmin();
      const sessionId = String(formData.get("sessionId") ?? "").trim();
      const resultId = String(formData.get("resultId") ?? "").trim();
      const decision = String(formData.get("decision") ?? "").trim();
      const adminNote = String(formData.get("adminNote") ?? "").trim();
      const correctedPartName = String(formData.get("correctedPartName") ?? "").trim();
      const correctedOemCodesRaw = String(formData.get("correctedOemCodes") ?? "").trim();
      const correctedOemCodes = correctedOemCodesRaw
        ? correctedOemCodesRaw
            .split(",")
            .map((code) => code.trim())
            .filter(Boolean)
        : undefined;
      const parsed = partsFinderReviewOverrideSchema.parse({
        sessionId,
        resultId: resultId || undefined,
        decision,
        adminNote: adminNote || undefined,
        correctedPartName: correctedPartName || undefined,
        correctedOemCodes,
      });
      await applyPartsFinderReviewOverride({
        sessionId: parsed.sessionId,
        reviewerId: session.user.id,
        resultId: parsed.resultId,
        decision: parsed.decision,
        adminNote: parsed.adminNote,
        correctedPartName: parsed.correctedPartName,
        correctedOemCodes: parsed.correctedOemCodes,
      });
      redirect(
        `/admin/parts-finder/sessions/${sessionId}?success=${encodeURIComponent(
          "Review update saved and audited.",
        )}`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to save review update.";
      redirect(`/admin/parts-finder/sessions/${id}?error=${encodeURIComponent(message)}`);
    }
  };

  return (
    <div>
      <p className="text-sm">
        <Link href="/admin/parts-finder/searches" className="text-[var(--brand)] hover:underline">
          ← All searches
        </Link>
      </p>
      <PageHeading variant="dashboard" className="mt-4">
        Review & explainability
      </PageHeading>
      <p className="mt-2 text-sm text-muted-foreground">
        Session <span className="font-mono text-xs">{row.sessionId}</span> · {row.createdAt.toISOString().replace("T", " ").slice(0, 19)} UTC
      </p>
      {opSuccess ? (
        <div className="mt-4 rounded-lg border border-emerald-600/40 bg-emerald-600/10 p-3 text-xs text-emerald-100">
          {opSuccess}
        </div>
      ) : null}
      {opError ? (
        <div className="mt-4 rounded-lg border border-red-600/40 bg-red-600/10 p-3 text-xs text-red-100">
          {opError}
        </div>
      ) : null}
      <div className="mt-8 rounded-2xl border border-border bg-muted/20 p-5 text-sm dark:bg-white/[0.02]">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Action</p>
        <p className="mt-1 font-medium text-foreground">parts_finder.search.created</p>
        <p className="mt-4 text-xs uppercase tracking-wide text-muted-foreground">Actor</p>
        <p className="mt-1 text-foreground">{row.user?.email ?? row.user?.name ?? "System"}</p>
        <p className="mt-4 text-xs uppercase tracking-wide text-muted-foreground">Entity</p>
        <p className="mt-1 font-mono text-xs text-foreground">
          PartsFinderSession:{row.sessionId}
        </p>
        <p className="mt-4 text-xs uppercase tracking-wide text-muted-foreground">Metadata</p>
        <pre className="mt-1 overflow-x-auto rounded-lg border border-border bg-background/70 p-3 text-xs text-muted-foreground">
          {JSON.stringify(
            {
              reviewStatus: row.status ?? "PENDING_REVIEW",
              reviewerId: row.reviewedById ?? null,
              reviewedAt: row.reviewedAt?.toISOString() ?? null,
              adminNote: row.reviewNote ?? null,
              forcedSummary: row.adminSummaryOverride ?? null,
            },
            null,
            2,
          )}
        </pre>
      </div>

      <section className="mt-6 rounded-xl border border-border bg-muted/20 p-4 text-sm dark:bg-white/[0.02]">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Engine confidence & uncertainty</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-lg border border-border bg-background/50 p-3">
            <p className="text-[10px] uppercase text-muted-foreground">Session status</p>
            <p className="mt-1 font-semibold">{row.status}</p>
          </div>
          <div className="rounded-lg border border-border bg-background/50 p-3">
            <p className="text-[10px] uppercase text-muted-foreground">Confidence label</p>
            <p className="mt-1 font-semibold">{String(confidenceLabelFromJson ?? "—")}</p>
          </div>
          <div className="rounded-lg border border-border bg-background/50 p-3">
            <p className="text-[10px] uppercase text-muted-foreground">Score</p>
            <p className="mt-1 font-semibold tabular-nums">
              {confidenceOverall != null ? `${confidenceOverall}%` : "—"}
            </p>
          </div>
        </div>
        {uncertaintyNotes.length > 0 ? (
          <div className="mt-3">
            <p className="text-[10px] uppercase text-muted-foreground">Why uncertain</p>
            <ul className="mt-1 list-inside list-disc text-xs text-muted-foreground">
              {uncertaintyNotes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {warnings.length > 0 ? (
          <div className="mt-3">
            <p className="text-[10px] uppercase text-muted-foreground">Warnings</p>
            <ul className="mt-1 list-inside list-disc text-xs text-amber-200/90">
              {warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {Object.keys(safetyFlags).length > 0 ? (
          <div className="mt-3">
            <p className="text-[10px] uppercase text-muted-foreground">Safety / pipeline flags</p>
            <pre className="mt-1 overflow-x-auto rounded-lg border border-border bg-background/70 p-2 text-[11px] text-muted-foreground">
              {JSON.stringify(safetyFlags, null, 2)}
            </pre>
          </div>
        ) : null}
      </section>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <PartsFinderJsonPanel title="Normalized input" value={normalized} />
        <PartsFinderJsonPanel title="Parsed vehicle" value={parsedVehicle} />
        <PartsFinderJsonPanel title="Query forms" value={queryForms} />
        <PartsFinderJsonPanel title="Confidence + summary (raw)" value={{ confidence, summary }} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <PartsFinderJsonPanel title="Raw search results" value={rawHits} />
        <PartsFinderJsonPanel title="Ranked final results" value={rankedResults} />
      </div>

      <section className="mt-6 rounded-xl border border-border bg-muted/20 p-4 text-sm dark:bg-white/[0.02]">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Review & correction history</p>
        {row.reviewOverrides.length === 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">No admin review actions recorded yet.</p>
        ) : (
          <div className="mt-3 space-y-3">
            {row.reviewOverrides.map((rev) => {
              const codes = Array.isArray(rev.correctedOemCodes)
                ? (rev.correctedOemCodes as unknown[]).map(String)
                : rev.correctedOemCodes != null
                  ? [JSON.stringify(rev.correctedOemCodes)]
                  : [];
              return (
                <div key={rev.id} className="rounded-lg border border-border bg-background/50 p-3 text-xs">
                  <p className="font-semibold">
                    {rev.status}
                    {rev.confidence ? ` · ${rev.confidence}` : ""}
                    <span className="ml-1 font-normal text-muted-foreground">
                      · {rev.reviewer?.email ?? rev.reviewer?.name ?? "Admin"} ·{" "}
                      {rev.createdAt.toISOString().replace("T", " ").slice(0, 19)} UTC
                    </span>
                  </p>
                  {rev.note ? <p className="mt-1 text-muted-foreground">Note: {rev.note}</p> : null}
                  {rev.summaryOverride ? (
                    <p className="mt-1 text-muted-foreground">Summary override: {rev.summaryOverride}</p>
                  ) : null}
                  {rev.correctedPartName || codes.length > 0 ? (
                    <div className="mt-2 rounded-md border border-dashed border-border/80 p-2">
                      <p className="text-[10px] uppercase text-muted-foreground">Corrections (audited)</p>
                      {rev.correctedPartName ? (
                        <p className="mt-1">
                          Part name: <span className="font-medium text-foreground">{rev.correctedPartName}</span>
                        </p>
                      ) : null}
                      {codes.length > 0 ? (
                        <p className="mt-1 font-mono text-[11px] text-muted-foreground">OEM: {codes.join(", ")}</p>
                      ) : null}
                    </div>
                  ) : null}
                  {rev.candidateBefore || rev.candidateAfter ? (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-[10px] uppercase text-muted-foreground">
                        Candidate snapshot (before / after)
                      </summary>
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        <pre className="max-h-40 overflow-auto rounded border border-border bg-background/70 p-2 text-[10px]">
                          {JSON.stringify(rev.candidateBefore ?? {}, null, 2)}
                        </pre>
                        <pre className="max-h-40 overflow-auto rounded border border-border bg-background/70 p-2 text-[10px]">
                          {JSON.stringify(rev.candidateAfter ?? {}, null, 2)}
                        </pre>
                      </div>
                    </details>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="mt-6 rounded-xl border border-border bg-muted/20 p-4 text-sm dark:bg-white/[0.02]">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Verified outcome history</p>
        {row.outcomes.length === 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">No verified outcome history yet.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {row.outcomes.map((outcome) => (
              <div key={`${outcome.outcomeStatus}-${outcome.createdAt.toISOString()}`} className="rounded-lg border border-border bg-background/50 p-2">
                <p className="text-xs">
                  <span className="font-semibold">{outcome.outcomeStatus}</span>{" "}
                  · {outcome.reviewer?.email ?? outcome.reviewer?.name ?? "Admin"} · {outcome.createdAt.toISOString().replace("T", " ").slice(0, 19)} UTC
                </p>
                {outcome.note ? <p className="mt-1 text-xs text-muted-foreground">{outcome.note}</p> : null}
                {outcome.candidateSignature ? (
                  <p className="mt-1 font-mono text-[10px] text-muted-foreground">{outcome.candidateSignature}</p>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mt-6 rounded-xl border border-border bg-muted/20 p-4 text-sm dark:bg-white/[0.02]">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Review override actions</p>
        <form className="mt-3 grid gap-2 sm:grid-cols-4" action={reviewOverrideAction}>
          <input type="hidden" name="sessionId" value={id} />
          <input type="hidden" name="resultId" value={firstResultId} />
          <select name="decision" className="h-9 rounded-lg border border-border bg-background px-2 text-xs">
            <option value="VERIFIED">Mark verified</option>
            <option value="LIKELY">Mark likely</option>
            <option value="APPROVED">Approve</option>
            <option value="REJECTED">Reject</option>
            <option value="LOW_CONFIDENCE">Mark low confidence</option>
            <option value="FLAGGED_SOURCING">Flag for sourcing</option>
          </select>
          <input name="adminNote" placeholder="Admin note" className="h-9 rounded-lg border border-border bg-background px-2 text-xs sm:col-span-2" />
          <button className="rounded-lg bg-[var(--brand)] px-3 py-2 text-xs font-semibold text-black sm:col-span-1" type="submit">
            Apply review
          </button>
          <input
            name="correctedPartName"
            placeholder="Corrected part name (optional)"
            className="h-9 rounded-lg border border-border bg-background px-2 text-xs sm:col-span-2"
          />
          <input
            name="correctedOemCodes"
            placeholder="Corrected OEM codes, comma-separated"
            className="h-9 rounded-lg border border-border bg-background px-2 text-xs sm:col-span-2"
          />
        </form>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Corrections are persisted server-side and logged for audit trail before verified outcomes are reused.
        </p>
      </section>

      <p className="mt-12 text-xs text-muted-foreground">
        {PARTS_FINDER_PRODUCT_NAME} — admin review view
      </p>
    </div>
  );
}
