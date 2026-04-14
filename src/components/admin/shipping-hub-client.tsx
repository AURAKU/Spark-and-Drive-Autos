"use client";

import type { OrderKind, ShipmentLogisticsStage } from "@prisma/client";
import { ChevronDown, CreditCard, Link2, Package, Ship, Truck } from "lucide-react";
import Link from "next/link";
import { useActionState, useMemo, useState } from "react";

import {
  appendShipmentStatusEvent,
  bulkTransitionShipmentStage,
  updateShipmentDetailsAction,
  type ShippingAdminState,
} from "@/actions/shipping-admin";
import { ShipmentFlowVisual } from "@/components/shipping/shipment-flow-visual";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SHIPMENT_KIND_LABEL, SHIPMENT_STAGE_LABEL } from "@/lib/shipping/constants";
import { cn } from "@/lib/utils";

export type AdminShipmentRow = {
  id: string;
  orderId: string;
  reference: string;
  orderKind: OrderKind;
  kind: string;
  currentStage: ShipmentLogisticsStage;
  deliveryMode: string | null;
  feeAmount: number | null;
  estimatedDuration: string | null;
  trackingNumber: string | null;
  carrier: string | null;
  internalNotes: string | null;
  userEmail: string | null;
  carTitle: string | null;
  partSummary: string;
  events: Array<{
    id: string;
    stage: ShipmentLogisticsStage;
    title: string;
    description: string | null;
    createdAt: string;
    visibleToCustomer: boolean;
  }>;
};

const STAGES = Object.keys(SHIPMENT_STAGE_LABEL) as ShipmentLogisticsStage[];

function kindIcon(kind: string) {
  if (kind === "CAR_SEA") return Ship;
  if (kind === "PARTS_CHINA") return Package;
  return Truck;
}

export function ShippingHubClient({
  rows: initialRows,
  paymentsIntelHref,
}: {
  rows: AdminShipmentRow[];
  paymentsIntelHref: string;
}) {
  const [tab, setTab] = useState<"ALL" | "CAR" | "PARTS">("ALL");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [eventState, eventAction] = useActionState(appendShipmentStatusEvent, null as ShippingAdminState);
  const [detailState, detailAction] = useActionState(updateShipmentDetailsAction, null as ShippingAdminState);
  const [bulkState, bulkAction] = useActionState(bulkTransitionShipmentStage, null as ShippingAdminState);

  const rows = useMemo(() => {
    if (tab === "ALL") return initialRows;
    return initialRows.filter((r) => r.orderKind === tab);
  }, [initialRows, tab]);

  const selectedIds = useMemo(() => Object.entries(selected).filter(([, v]) => v).map(([k]) => k), [selected]);

  const tabCounts = useMemo(() => {
    return {
      ALL: initialRows.length,
      CAR: initialRows.filter((r) => r.orderKind === "CAR").length,
      PARTS: initialRows.filter((r) => r.orderKind === "PARTS").length,
    };
  }, [initialRows]);

  const actionMessage = useMemo(() => {
    if (eventState?.error) return { tone: "err" as const, text: eventState.error };
    if (detailState?.error) return { tone: "err" as const, text: detailState.error };
    if (bulkState?.error) return { tone: "err" as const, text: bulkState.error };
    if (eventState?.ok) return { tone: "ok" as const, text: "Status event saved and customer notified." };
    if (detailState?.ok) return { tone: "ok" as const, text: "Shipment details updated." };
    if (bulkState?.ok) return { tone: "ok" as const, text: "Bulk stage applied." };
    return null;
  }, [eventState, detailState, bulkState]);

  return (
    <div className="space-y-8">
      <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-[#0a1628]/90 via-[#05070b] to-black/80 p-5 shadow-[0_0_80px_-40px_rgba(49,182,199,0.35)] sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-[0.25em] text-[var(--brand)] uppercase">Live pipeline</p>
            <h2 className="mt-1 text-xl font-semibold text-white sm:text-2xl">Shipment control center</h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-zinc-400">
              Expand a row for the fulfilment flow, milestones, and fee/ETA edits. Customer-visible updates sync to dashboards
              instantly.
            </p>
            <a
              href={paymentsIntelHref}
              className="mt-4 inline-flex items-center gap-2 text-xs font-medium text-[var(--brand)] hover:underline"
            >
              <CreditCard className="size-3.5 shrink-0" aria-hidden />
              Open payment intelligence (same date window)
            </a>
          </div>
          <div className="flex flex-col gap-3 sm:items-end">
            <div className="flex flex-wrap gap-2" role="tablist" aria-label="Shipment category">
              {(["ALL", "CAR", "PARTS"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  role="tab"
                  aria-selected={tab === t}
                  onClick={() => setTab(t)}
                  className={cn(
                    "rounded-full border px-4 py-2 text-xs font-semibold transition min-h-[44px]",
                    tab === t
                      ? "border-[var(--brand)]/60 bg-[var(--brand)]/15 text-[var(--brand)]"
                      : "border-white/10 text-zinc-400 hover:border-white/20 hover:text-white",
                  )}
                >
                  {t === "ALL" ? "All" : t === "CAR" ? "Cars" : "Parts"}{" "}
                  <span className="ml-1 tabular-nums text-zinc-500">({tabCounts[t]})</span>
                </button>
              ))}
            </div>
            <div className="grid w-full max-w-md grid-cols-3 gap-2 rounded-2xl border border-white/10 bg-black/30 p-3 text-center sm:max-w-xs">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-600">In view</p>
                <p className="mt-1 text-lg font-semibold tabular-nums text-white">{rows.length}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-600">Selected</p>
                <p className="mt-1 text-lg font-semibold tabular-nums text-[var(--brand)]">{selectedIds.length}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-600">Total load</p>
                <p className="mt-1 text-lg font-semibold tabular-nums text-zinc-400">{initialRows.length}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="min-h-[1.5rem] text-sm empty:hidden"
      >
        {actionMessage ? (
          <p className={actionMessage.tone === "err" ? "text-red-400" : "text-emerald-400/90"}>{actionMessage.text}</p>
        ) : null}
      </div>

      <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-black/20 p-4 sm:p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-white">Bulk stage transition</h3>
            <p className="mt-1 text-xs text-zinc-500">Select shipments, choose a logistics stage, publish one customer-visible title.</p>
          </div>
        </div>
        <form action={bulkAction} className="mt-4 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
          <input type="hidden" name="shipmentIds" value={selectedIds.join(",")} />
          <div className="w-full sm:w-48">
            <Label htmlFor="bulk-ship-stage" className="text-[10px] uppercase tracking-wide text-zinc-500">
              Stage
            </Label>
            <select
              id="bulk-ship-stage"
              name="stage"
              className="mt-1 h-11 w-full rounded-xl border border-white/12 bg-black/50 px-3 text-sm text-white focus:border-[var(--brand)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/20"
            >
              {STAGES.map((s) => (
                <option key={s} value={s}>
                  {SHIPMENT_STAGE_LABEL[s]}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-0 flex-1 sm:min-w-[14rem]">
            <Label htmlFor="bulk-ship-title" className="text-[10px] uppercase tracking-wide text-zinc-500">
              Title (customer-visible)
            </Label>
            <Input
              id="bulk-ship-title"
              name="title"
              required
              placeholder="e.g. Cleared customs"
              className="mt-1 h-11 rounded-xl border-white/12 bg-black/40"
            />
          </div>
          <Button type="submit" size="default" disabled={selectedIds.length === 0} className="h-11 w-full sm:w-auto">
            Apply to {selectedIds.length || "0"} selected
          </Button>
        </form>
      </div>

      <div className="space-y-4">
        {rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] px-6 py-14 text-center">
            <Package className="mx-auto size-10 text-zinc-600" aria-hidden />
            <p className="mt-3 text-sm font-medium text-zinc-400">No shipments in this view</p>
            <p className="mt-1 text-xs text-zinc-600">Adjust the date filter or switch tabs — or open Payment intelligence to confirm orders in range.</p>
          </div>
        ) : (
          rows.map((row) => {
            const KindIcon = kindIcon(row.kind);
            const sortedEvents = [...row.events].sort(
              (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
            );
            return (
              <details
                key={row.id}
                className="group overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] open:border-[var(--brand)]/30 open:shadow-[0_0_40px_-20px_rgba(49,182,199,0.25)]"
              >
                <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 p-4 outline-none transition hover:bg-white/[0.04] sm:p-5 [&::-webkit-details-marker]:hidden">
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <input
                      type="checkbox"
                      checked={!!selected[row.id]}
                      onChange={(e) => setSelected((s) => ({ ...s, [row.id]: e.target.checked }))}
                      onClick={(e) => e.stopPropagation()}
                      className="mt-1 size-4 shrink-0 rounded border-white/20 accent-[var(--brand)]"
                      aria-label={`Select shipment for order ${row.reference}`}
                    />
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-black/40 text-[var(--brand)]">
                      <KindIcon className="size-5" aria-hidden />
                    </div>
                    <div className="min-w-0">
                      <p className="font-mono text-[11px] text-zinc-500">{row.reference}</p>
                      <p className="truncate text-sm font-semibold text-white sm:text-base">
                        {SHIPMENT_KIND_LABEL[row.kind] ?? row.kind}
                        {row.deliveryMode ? (
                          <span className="ml-2 text-xs font-normal text-zinc-400">
                            · {row.deliveryMode.replaceAll("_", " ")}
                          </span>
                        ) : null}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-zinc-500">
                        {row.userEmail ?? "—"} · {row.orderKind === "CAR" ? row.carTitle ?? "Vehicle" : row.partSummary}
                      </p>
                      {row.trackingNumber ? (
                        <p className="mt-1 font-mono text-[10px] text-zinc-500">Tracking: {row.trackingNumber}</p>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2 sm:gap-3">
                    <span className="rounded-full border border-white/10 bg-black/40 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-300 sm:px-3">
                      {SHIPMENT_STAGE_LABEL[row.currentStage]}
                    </span>
                    <Link
                      href={`/admin/orders/${row.orderId}`}
                      className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2 py-1.5 text-xs font-medium text-[var(--brand)] transition hover:border-[var(--brand)]/40 hover:bg-[var(--brand)]/10"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Link2 className="size-3.5" aria-hidden />
                      Order
                    </Link>
                    <ChevronDown
                      className="size-5 shrink-0 text-zinc-500 transition group-open:rotate-180 group-open:text-[var(--brand)]"
                      aria-hidden
                    />
                  </div>
                </summary>
                <div className="border-t border-white/5 px-4 pb-5 pt-4 sm:px-5">
                  <div className="rounded-2xl border border-white/[0.06] bg-black/25 p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Fulfilment flow</p>
                    <div className="mt-3 overflow-x-auto pb-1">
                      <ShipmentFlowVisual currentStage={row.currentStage} />
                    </div>
                  </div>

                  <div className="mt-6 grid gap-6 lg:grid-cols-2">
                    <div className="rounded-2xl border border-white/10 bg-black/25 p-4 sm:p-5">
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Add milestone</h4>
                      <form action={eventAction} className="mt-4 space-y-3">
                        <input type="hidden" name="shipmentId" value={row.id} />
                        <div>
                          <Label htmlFor={`ev-stage-${row.id}`} className="text-[10px] text-zinc-500">
                            Stage
                          </Label>
                          <select
                            id={`ev-stage-${row.id}`}
                            name="stage"
                            className="mt-1 h-11 w-full rounded-xl border border-white/12 bg-black/50 px-3 text-sm text-white focus:border-[var(--brand)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/20"
                          >
                            {STAGES.map((s) => (
                              <option key={s} value={s}>
                                {SHIPMENT_STAGE_LABEL[s]}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <Label htmlFor={`ev-title-${row.id}`} className="text-[10px] text-zinc-500">
                            Title
                          </Label>
                          <Input
                            id={`ev-title-${row.id}`}
                            name="title"
                            required
                            className="mt-1 h-11 rounded-xl border-white/12 bg-black/40"
                            placeholder="Short customer-facing title"
                          />
                        </div>
                        <div>
                          <Label htmlFor={`ev-desc-${row.id}`} className="text-[10px] text-zinc-500">
                            Note (optional)
                          </Label>
                          <Input
                            id={`ev-desc-${row.id}`}
                            name="description"
                            className="mt-1 h-11 rounded-xl border-white/12 bg-black/40"
                            placeholder="Context for staff or customer"
                          />
                        </div>
                        <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-400">
                          <input type="checkbox" name="visibleToCustomer" value="1" defaultChecked className="size-4 accent-[var(--brand)]" />
                          Visible to customer
                        </label>
                        <Button type="submit" size="sm" variant="secondary" className="w-full sm:w-auto">
                          Publish event
                        </Button>
                      </form>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-black/25 p-4 sm:p-5">
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Shipment details</h4>
                      <form action={detailAction} className="mt-4 space-y-3">
                        <input type="hidden" name="shipmentId" value={row.id} />
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div>
                            <Label htmlFor={`fee-${row.id}`} className="text-[10px] text-zinc-500">
                              Fee (GHS)
                            </Label>
                            <Input
                              id={`fee-${row.id}`}
                              name="feeAmount"
                              type="number"
                              step="0.01"
                              min="0"
                              className="mt-1 h-11 rounded-xl border-white/12 bg-black/40"
                              defaultValue={row.feeAmount ?? ""}
                              placeholder="—"
                            />
                          </div>
                          <div>
                            <Label htmlFor={`eta-${row.id}`} className="text-[10px] text-zinc-500">
                              ETA text
                            </Label>
                            <Input
                              id={`eta-${row.id}`}
                              name="estimatedDuration"
                              className="mt-1 h-11 rounded-xl border-white/12 bg-black/40"
                              defaultValue={row.estimatedDuration ?? ""}
                              placeholder="e.g. 14–21 days"
                            />
                          </div>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div>
                            <Label htmlFor={`track-${row.id}`} className="text-[10px] text-zinc-500">
                              Tracking #
                            </Label>
                            <Input
                              id={`track-${row.id}`}
                              name="trackingNumber"
                              className="mt-1 h-11 rounded-xl border-white/12 bg-black/40"
                              defaultValue={row.trackingNumber ?? ""}
                            />
                          </div>
                          <div>
                            <Label htmlFor={`carrier-${row.id}`} className="text-[10px] text-zinc-500">
                              Carrier
                            </Label>
                            <Input
                              id={`carrier-${row.id}`}
                              name="carrier"
                              className="mt-1 h-11 rounded-xl border-white/12 bg-black/40"
                              defaultValue={row.carrier ?? ""}
                            />
                          </div>
                        </div>
                        <div>
                          <Label htmlFor={`notes-${row.id}`} className="text-[10px] text-zinc-500">
                            Internal notes
                          </Label>
                          <Input
                            id={`notes-${row.id}`}
                            name="internalNotes"
                            className="mt-1 h-11 rounded-xl border-white/12 bg-black/40"
                            defaultValue={row.internalNotes ?? ""}
                          />
                        </div>
                        <Button type="submit" size="sm" variant="outline" className="w-full sm:w-auto">
                          Save details
                        </Button>
                      </form>
                    </div>
                  </div>

                  <div className="mt-6">
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Event timeline</h4>
                    <p className="mt-1 text-[11px] text-zinc-600">Newest first · staff-only events marked.</p>
                    <ul className="relative mt-4 max-h-64 space-y-0 overflow-y-auto overscroll-contain border-l border-white/10 pl-4 sm:max-h-80">
                      {sortedEvents.map((ev, idx) => (
                        <li key={ev.id} className="relative pb-6 last:pb-0">
                          <span
                            className="absolute -left-[21px] top-1.5 size-2.5 rounded-full border-2 border-[#0a0f15] bg-[var(--brand)]"
                            aria-hidden
                          />
                          {idx < sortedEvents.length - 1 ? (
                            <span className="absolute -left-[17px] top-4 h-[calc(100%-0.25rem)] w-px bg-white/10" aria-hidden />
                          ) : null}
                          <div className="rounded-xl border border-white/8 bg-black/30 px-3 py-2.5">
                            <div className="flex flex-wrap items-baseline justify-between gap-2">
                              <span className="font-medium text-zinc-100">{ev.title}</span>
                              <time className="text-[11px] text-zinc-500" dateTime={ev.createdAt}>
                                {new Date(ev.createdAt).toLocaleString()}
                              </time>
                            </div>
                            {ev.description ? <p className="mt-1 text-xs text-zinc-500">{ev.description}</p> : null}
                            <p className="mt-1.5 text-[11px] text-zinc-600">
                              {SHIPMENT_STAGE_LABEL[ev.stage]}
                              {!ev.visibleToCustomer ? (
                                <span className="text-amber-400/90"> · hidden from customer</span>
                              ) : null}
                            </p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </details>
            );
          })
        )}
      </div>
    </div>
  );
}
