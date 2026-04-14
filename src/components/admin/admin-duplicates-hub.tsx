"use client";

import type { DuplicateDecision, DuplicateEntityType } from "@prisma/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { setDuplicateEventDecision, type DuplicateAdminState } from "@/actions/duplicate-admin";
import { deleteCar } from "@/actions/cars";
import { deletePart } from "@/actions/parts";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { CarDuplicateCluster, PartDuplicateCluster } from "@/lib/duplicate-clusters";

const PART_SIGNAL_LABEL: Record<string, string> = {
  SAME_SKU: "Same SKU",
  SAME_NORMALIZED_TITLE: "Same normalized title",
  SAME_TOKEN_BAG: "Same word set (order ignored)",
  HIGH_TITLE_SIMILARITY: "Very similar titles",
};

const CAR_SIGNAL_LABEL: Record<string, string> = {
  SAME_VIN: "Same VIN",
  EXACT_SAME_TITLE: "Identical listing title",
  HIGH_TITLE_SIMILARITY: "Very similar titles",
};

type LogRow = {
  id: string;
  entityType: DuplicateEntityType;
  entityId: string | null;
  candidateId: string | null;
  score: number;
  summary: string | null;
  decision: DuplicateDecision;
  createdAt: string;
};

type Tab = "parts" | "cars" | "log";

function ResolveEventForm({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [state, formAction] = useActionState(setDuplicateEventDecision, null as DuplicateAdminState);
  useEffect(() => {
    if (state?.ok) {
      toast.success("Marked as reviewed");
      router.refresh();
    }
    if (state?.error) toast.error(state.error);
  }, [state, router]);
  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="eventId" value={eventId} />
      <select
        name="decision"
        className="h-8 rounded-lg border border-white/15 bg-black/50 px-2 text-xs text-white"
        defaultValue="KEEP_BOTH"
      >
        <option value="KEEP_BOTH">Keep both (not duplicates)</option>
        <option value="MERGE_LATER">Merge / fix later</option>
        <option value="CANCEL_CREATE">Treat as mistaken create</option>
      </select>
      <Button type="submit" size="sm" variant="secondary">
        Save
      </Button>
    </form>
  );
}

function DeleteCarButton({ carId }: { carId: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <Button
      type="button"
      size="sm"
      variant="destructive"
      disabled={pending}
      onClick={() => {
        if (!confirm("Permanently delete this vehicle? This cannot be undone.")) return;
        start(async () => {
          const r = await deleteCar(carId);
          if (r && "error" in r && r.error) {
            toast.error(r.error);
            return;
          }
          toast.success("Vehicle deleted");
          router.refresh();
        });
      }}
    >
      Delete
    </Button>
  );
}

export function AdminDuplicatesHub(props: {
  partClusters: PartDuplicateCluster[];
  carClusters: CarDuplicateCluster[];
  events: LogRow[];
  partsScanned: number;
  partsTotal: number;
  carsScanned: number;
  carsTotal: number;
  inventoryTruncated: boolean;
}) {
  const [tab, setTab] = useState<Tab>("parts");
  const pendingEvents = props.events.filter((e) => e.decision === "PENDING").length;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-1">
        {(
          [
            ["parts", `Parts & accessories (${props.partClusters.length})`],
            ["cars", `Vehicles (${props.carClusters.length})`],
            ["log", `Live warnings (${pendingEvents} open)`],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={cn(
              "rounded-lg px-4 py-2 text-sm font-medium transition",
              tab === k ? "bg-[var(--brand)]/20 text-white" : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {props.inventoryTruncated ? (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100/90">
          Inventory exceeds the scan cap (see counts under the page title). Only the first slice by stable ID is clustered;
          raise <code className="rounded bg-black/40 px-1">SCAN_CAP</code> in{" "}
          <code className="rounded bg-black/40 px-1">src/app/admin/duplicates/page.tsx</code> if you need full coverage.
        </p>
      ) : null}

      {tab === "parts" ? (
        <section className="space-y-6">
          <p className="text-sm text-zinc-400">
            Groups of <strong className="text-zinc-200">two or more</strong> parts that likely describe the same product
            (SKU match, identical cleaned title, same word-bag, or high fuzzy title similarity within the same category
            bucket). Open one listing to edit details or SKU, or remove extras.
          </p>
          {props.partClusters.length === 0 ? (
            <p className="text-sm text-zinc-500">No duplicate clusters detected in the scanned inventory.</p>
          ) : (
            props.partClusters.map((cluster) => (
              <article
                key={cluster.id}
                className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] shadow-sm"
              >
                <header className="flex flex-wrap items-center gap-2 border-b border-white/10 bg-black/20 px-4 py-3">
                  <span className="text-sm font-semibold text-white">
                    {cluster.members.length} listings in cluster
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {cluster.signals.map((s) => (
                      <Badge key={s} variant="outline" className="border-[var(--brand)]/40 text-[11px] text-zinc-300">
                        {PART_SIGNAL_LABEL[s] ?? s}
                      </Badge>
                    ))}
                  </div>
                </header>
                <ul className="divide-y divide-white/5">
                  {cluster.members.map((m) => (
                    <li key={m.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="font-medium text-zinc-100">{m.title}</p>
                        <p className="text-xs text-zinc-500">
                          SKU: {m.sku?.trim() ? <span className="font-mono text-zinc-400">{m.sku}</span> : "—"} ·{" "}
                          {m.category} · {m.listingState} · ¥{m.basePriceRmb} ·{" "}
                          <span className="font-mono">{m.slug}</span>
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-2">
                        <Link
                          href={`/admin/parts/${m.id}/edit`}
                          className={buttonVariants({ variant: "secondary", size: "sm" })}
                        >
                          Edit
                        </Link>
                        <Link href={`/parts/${m.slug}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                          View live
                        </Link>
                        <form
                          action={deletePart}
                          onSubmit={(e) => {
                            if (!confirm(`Delete “${m.title}”? Carts and favorites tied to this part will update.`)) {
                              e.preventDefault();
                            }
                          }}
                        >
                          <input type="hidden" name="id" value={m.id} />
                          <input type="hidden" name="next" value="/admin/duplicates" />
                          <Button type="submit" size="sm" variant="destructive">
                            Delete
                          </Button>
                        </form>
                      </div>
                    </li>
                  ))}
                </ul>
              </article>
            ))
          )}
        </section>
      ) : null}

      {tab === "cars" ? (
        <section className="space-y-6">
          <p className="text-sm text-zinc-400">
            Clusters from <strong className="text-zinc-200">matching VIN</strong>, identical normalized titles, or very
            similar titles for the same make, model, and year.
          </p>
          {props.carClusters.length === 0 ? (
            <p className="text-sm text-zinc-500">No duplicate clusters detected in the scanned inventory.</p>
          ) : (
            props.carClusters.map((cluster) => (
              <article
                key={cluster.id}
                className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] shadow-sm"
              >
                <header className="flex flex-wrap items-center gap-2 border-b border-white/10 bg-black/20 px-4 py-3">
                  <span className="text-sm font-semibold text-white">
                    {cluster.members.length} listings in cluster
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {cluster.signals.map((s) => (
                      <Badge key={s} variant="outline" className="border-[var(--brand)]/40 text-[11px] text-zinc-300">
                        {CAR_SIGNAL_LABEL[s] ?? s}
                      </Badge>
                    ))}
                  </div>
                </header>
                <ul className="divide-y divide-white/5">
                  {cluster.members.map((m) => (
                    <li key={m.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="font-medium text-zinc-100">{m.title}</p>
                        <p className="text-xs text-zinc-500">
                          {m.brand} {m.model} {m.year}
                          {m.vin?.trim() ? (
                            <>
                              {" "}
                              · VIN <span className="font-mono text-zinc-400">{m.vin}</span>
                            </>
                          ) : null}{" "}
                          · {m.listingState} · ¥{m.basePriceRmb} · <span className="font-mono">{m.slug}</span>
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-2">
                        <Link
                          href={`/admin/cars/${m.id}/edit`}
                          className={buttonVariants({ variant: "secondary", size: "sm" })}
                        >
                          Edit
                        </Link>
                        <Link href={`/cars/${m.slug}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                          View live
                        </Link>
                        <DeleteCarButton carId={m.id} />
                      </div>
                    </li>
                  ))}
                </ul>
              </article>
            ))
          )}
        </section>
      ) : null}

      {tab === "log" ? (
        <section>
          <p className="mb-4 text-sm text-zinc-400">
            Warnings raised when staff saved a listing that looked like an existing one. Resolve each row so the team knows
            it was reviewed.
          </p>
          <div className="overflow-x-auto rounded-2xl border border-white/10">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-white/10 bg-white/[0.03] text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-4 py-3">When</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">New / edited</th>
                  <th className="px-4 py-3">Similar to</th>
                  <th className="px-4 py-3">Score</th>
                  <th className="px-4 py-3">Summary</th>
                  <th className="px-4 py-3">Decision</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {props.events.map((e) => (
                  <tr key={e.id} className="border-b border-white/5 align-top">
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-zinc-500">{e.createdAt.slice(0, 16)}</td>
                    <td className="px-4 py-3 text-zinc-300">{e.entityType}</td>
                    <td className="px-4 py-3">
                      {e.entityId ? (
                        <Link
                          href={e.entityType === "PART" ? `/admin/parts/${e.entityId}/edit` : `/admin/cars/${e.entityId}/edit`}
                          className="font-mono text-xs text-[var(--brand)] hover:underline"
                        >
                          {e.entityId.slice(0, 8)}…
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {e.candidateId ? (
                        <Link
                          href={
                            e.entityType === "PART" ? `/admin/parts/${e.candidateId}/edit` : `/admin/cars/${e.candidateId}/edit`
                          }
                          className="font-mono text-xs text-[var(--brand)] hover:underline"
                        >
                          {e.candidateId.slice(0, 8)}…
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3 text-zinc-200">{e.score.toFixed(2)}</td>
                    <td className="max-w-[280px] px-4 py-3 text-xs text-zinc-500">{e.summary ?? "—"}</td>
                    <td className="px-4 py-3 text-zinc-400">{e.decision}</td>
                    <td className="px-4 py-3">
                      {e.decision === "PENDING" ? <ResolveEventForm eventId={e.id} /> : (
                        <span className="text-xs text-zinc-600">Resolved</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
