"use client";

import type { PaymentStatus } from "@prisma/client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import { AdminOrdersPreviewDialog } from "@/components/admin/admin-orders-preview-dialog";
import { PaymentStatusBadge } from "@/components/payments/payment-status-badge";
import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { buildOrdersExportSearchParams, type ExportScope } from "@/lib/admin-orders-export-http";
import type { AdminOrderListRowSerialized } from "@/lib/admin-orders-list-serialize";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

type Props = {
  rows: AdminOrderListRowSerialized[];
  /** Shown when the table has no rows (e.g. zero total or no search matches). */
  emptyHint?: string;
};

function formatOrderActivityLine(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

async function downloadExport(path: string, searchParams: URLSearchParams, filenameFallback: string) {
  const url = `${path}?${searchParams.toString()}`;
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(typeof err?.error === "string" ? err.error : `Export failed (${res.status})`);
  }
  const cd = res.headers.get("content-disposition");
  let filename = filenameFallback;
  const m = cd?.match(/filename="([^"]+)"/);
  if (m?.[1]) filename = m[1];
  const blob = await res.blob();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

async function postExport(path: string, ids: string[], filenameFallback: string) {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ ids }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(typeof err?.error === "string" ? err.error : `Export failed (${res.status})`);
  }
  const cd = res.headers.get("content-disposition");
  let filename = filenameFallback;
  const m = cd?.match(/filename="([^"]+)"/);
  if (m?.[1]) filename = m[1];
  const blob = await res.blob();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function AdminOrdersInteractive({ rows, emptyHint }: Props) {
  const searchParams = useSearchParams();
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [previewRow, setPreviewRow] = useState<AdminOrderListRowSerialized | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const allIds = useMemo(() => rows.map((r) => r.id), [rows]);
  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));

  const toggleAll = useCallback(() => {
    setSelected((prev) => {
      if (rows.length === 0) return new Set();
      if (rows.every((r) => prev.has(r.id))) return new Set();
      return new Set(allIds);
    });
  }, [allIds, rows]);

  const toggleOne = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const runExport = useCallback(
    async (format: "pdf" | "xlsx", scope: ExportScope) => {
      const path = format === "pdf" ? "/api/admin/orders/export/pdf" : "/api/admin/orders/export/xlsx";
      const ext = format === "pdf" ? "pdf" : "xlsx";
      const fallback = `orders-export.${ext}`;
      try {
        if (scope === "selected") {
          const ids = [...selected];
          if (ids.length === 0) {
            toast.error("Select at least one order.");
            return;
          }
          const p = buildOrdersExportSearchParams(searchParams, "selected");
          await postExport(`${path}?${p.toString()}`, ids, fallback);
        } else {
          const p = buildOrdersExportSearchParams(searchParams, scope);
          await downloadExport(path, p, fallback);
        }
        toast.success("Export downloaded");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Export failed");
      }
    },
    [searchParams, selected],
  );

  return (
    <>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger
            type="button"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "border-white/15")}
          >
            Export PDF…
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuLabel>PDF scope</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => void runExport("pdf", "today")}>Today&apos;s orders</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => void runExport("pdf", "page")}>Current page</DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => void runExport("pdf", "selected")}
              disabled={selected.size === 0}
            >
              Selected ({selected.size})
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => void runExport("pdf", "filtered")}>All matching filters</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => void runExport("pdf", "all")}>All orders (no filters)</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger
            type="button"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "border-white/15")}
          >
            Export Excel…
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuLabel>Excel scope</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => void runExport("xlsx", "today")}>Today&apos;s orders</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => void runExport("xlsx", "page")}>Current page</DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => void runExport("xlsx", "selected")}
              disabled={selected.size === 0}
            >
              Selected ({selected.size})
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => void runExport("xlsx", "filtered")}>All matching filters</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => void runExport("xlsx", "all")}>All orders (no filters)</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mt-8 sda-table-scroll rounded-2xl border border-border bg-card/50 shadow-sm ring-1 ring-border/40">
        <table className="w-full min-w-[960px] text-left text-sm">
          <thead className="border-b border-border bg-muted/50 text-xs font-medium tracking-wide text-muted-foreground">
            <tr>
              <th className="w-10 px-2 py-3">
                <input
                  type="checkbox"
                  className="rounded border-border"
                  checked={allSelected}
                  onChange={toggleAll}
                  aria-label="Select all on this page"
                />
              </th>
              <th className="px-4 py-3">Reference</th>
              <th className="px-4 py-3">Item</th>
              <th className="w-[1%] px-4 py-3">Parts</th>
              <th className="w-[1%] px-4 py-3">Status</th>
              <th className="min-w-[11rem] px-4 py-3">Customer</th>
              <th className="w-[1%] whitespace-nowrap px-4 py-3">Amount</th>
              <th className="min-w-[8.5rem] px-4 py-3">Placed &amp; updated</th>
              <th className="w-[1%] px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">
                  {emptyHint ?? "No orders on this page."}
                </td>
              </tr>
            ) : (
              rows.map((o) => {
                const updatedDiffers = o.updatedAt !== o.createdAt;
                return (
                  <tr
                    key={o.id}
                    className="border-b border-border/60 last:border-0 hover:bg-muted/40 dark:hover:bg-white/[0.04]"
                  >
                    <td className="px-2 py-3.5 align-top">
                      <input
                        type="checkbox"
                        className="rounded border-border"
                        checked={selected.has(o.id)}
                        onChange={() => toggleOne(o.id)}
                        aria-label={`Select ${o.reference}`}
                      />
                    </td>
                    <td className="px-4 py-3.5 align-top font-mono text-xs text-foreground/90">{o.reference}</td>
                    <td className="max-w-[min(20rem,32vw)] px-4 py-3.5 align-top text-foreground/90">
                      <button
                        type="button"
                        className="line-clamp-2 w-full text-left text-[var(--brand)] hover:underline"
                        onClick={() => {
                          setPreviewRow(o);
                          setPreviewOpen(true);
                        }}
                      >
                        {o.itemTitle}
                      </button>
                      {o.itemHref ? (
                        <p className="mt-1">
                          <Link
                            href={o.itemHref}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[0.7rem] text-muted-foreground hover:text-[var(--brand)]"
                          >
                            Open listing ↗
                          </Link>
                        </p>
                      ) : null}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5 align-top text-xs text-muted-foreground">
                      {o.kind === "PARTS" ? o.partsLineageLabel : "—"}
                    </td>
                    <td className="px-4 py-3.5 align-top">
                      {o.paymentStatus ? (
                        <PaymentStatusBadge status={o.paymentStatus as PaymentStatus} />
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="break-all px-4 py-3.5 align-top text-sm text-muted-foreground" title={o.preview.customerEmail}>
                      {o.preview.customerEmail}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5 align-top font-medium tabular-nums text-[var(--brand)]">
                      {formatMoney(o.amount, o.currency)}
                    </td>
                    <td className="px-4 py-3.5 align-top">
                      <div className="flex flex-col gap-1.5 text-xs leading-snug">
                        <div>
                          <p className="text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground">Placed</p>
                          <p className="tabular-nums text-foreground">{formatOrderActivityLine(o.createdAt)}</p>
                        </div>
                        {updatedDiffers ? (
                          <div>
                            <p className="text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground">Updated</p>
                            <p className="tabular-nums text-foreground/85">{formatOrderActivityLine(o.updatedAt)}</p>
                          </div>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-right align-top">
                      <Link
                        className="inline-flex text-sm font-medium text-[var(--brand)] hover:underline"
                        href={`/admin/orders/${o.id}`}
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <AdminOrdersPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        preview={previewRow?.preview ?? null}
        itemHref={previewRow?.itemHref ?? null}
        orderAdminHref={previewRow ? `/admin/orders/${previewRow.id}` : "/admin/orders"}
      />
    </>
  );
}
