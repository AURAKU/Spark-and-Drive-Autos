import type { OrderKind } from "@prisma/client";

import { appendOpsDateParams, parseOpsDateFromSearchParams } from "@/lib/admin-operations-date-filter";
import type { AdminPartsLineage } from "@/lib/admin-orders-parts-filter";
import {
  ADMIN_ORDERS_EXPORT_MAX,
  ADMIN_ORDERS_PAGE_SIZE,
  type AdminOrderRich,
  buildAdminOrdersBaseWhere,
  fetchAdminOrdersRich,
  localTodayRange,
  type OrdersExportKindFilter,
} from "@/lib/admin-orders-export-query";
import { buildOrderListSearchWhere, normalizeOrderListSearchQuery } from "@/lib/admin-orders-search";
export type ExportScope = "filtered" | "today" | "page" | "all" | "selected";

function filterDescription(
  kind: OrdersExportKindFilter,
  dateLabel: string,
  pl: AdminPartsLineage,
  searchQ: string,
) {
  const k =
    kind === "CAR" ? "Cars Inventory only" : kind === "PARTS" ? "Parts & Accessories only" : "All kinds";
  const plL =
    pl === "ghana" ? "Ghana stock parts" : pl === "china_preorder" ? "China pre-order parts" : null;
  return [k, plL, dateLabel !== "All dates" ? dateLabel : null, searchQ ? `Search: ${searchQ}` : null]
    .filter(Boolean)
    .join(" · ");
}

function parseExportQuery(url: URL, raw: Record<string, string | string[] | undefined>) {
  const kindRaw = url.searchParams.get("kind") ?? "";
  const kindFilter: OrdersExportKindFilter =
    kindRaw === "CAR" || kindRaw === "PARTS" ? (kindRaw as OrderKind) : null;
  const plRaw = url.searchParams.get("partsLineage") ?? "";
  const partsLineage: AdminPartsLineage =
    plRaw === "ghana" || plRaw === "china_preorder" ? (plRaw as AdminPartsLineage) : null;
  const ops = parseOpsDateFromSearchParams(raw);
  const searchQ = normalizeOrderListSearchQuery(url.searchParams.get("q"));
  const searchWhere = buildOrderListSearchWhere(searchQ);
  const baseLabel = filterDescription(kindFilter, ops.label, partsLineage, searchQ);
  return { kindFilter, partsLineage, ops, searchQ, searchWhere, baseLabel };
}

export async function loadAdminOrdersForExport(opts: {
  scope: ExportScope;
  url: URL;
  rawParams: Record<string, string | string[] | undefined>;
  /** Required when scope is `selected` */
  selectedIds?: string[];
}): Promise<{ orders: AdminOrderRich[]; label: string }> {
  const { kindFilter, partsLineage, ops, searchWhere, baseLabel } = parseExportQuery(opts.url, opts.rawParams);

  if (opts.scope === "all") {
    const orders = await fetchAdminOrdersRich({}, { take: ADMIN_ORDERS_EXPORT_MAX });
    return { orders, label: `All orders (no filters) · ${orders.length} row(s)` };
  }

  if (opts.scope === "selected") {
    const ids = opts.selectedIds ?? [];
    if (ids.length === 0) {
      return { orders: [], label: "Selected (0)" };
    }
    const orders = await fetchAdminOrdersRich({ id: { in: ids } }, { take: ADMIN_ORDERS_EXPORT_MAX });
    return { orders, label: `Selected orders (${orders.length}) · ${baseLabel}` };
  }

  if (opts.scope === "today") {
    const tr = localTodayRange();
    const where = buildAdminOrdersBaseWhere(kindFilter, tr, partsLineage, searchWhere);
    const orders = await fetchAdminOrdersRich(where, { take: ADMIN_ORDERS_EXPORT_MAX });
    return { orders, label: `Today's orders · ${baseLabel} · ${orders.length} row(s)` };
  }

  if (opts.scope === "page") {
    const pageRaw = opts.url.searchParams.get("page");
    const page = Math.max(1, parseInt(pageRaw || "1", 10) || 1);
    const where = buildAdminOrdersBaseWhere(kindFilter, ops.range, partsLineage, searchWhere);
    const orders = await fetchAdminOrdersRich(where, {
      skip: (page - 1) * ADMIN_ORDERS_PAGE_SIZE,
      take: ADMIN_ORDERS_PAGE_SIZE,
    });
    return { orders, label: `Current page ${page} · ${baseLabel} · ${orders.length} row(s)` };
  }

  const where = buildAdminOrdersBaseWhere(kindFilter, ops.range, partsLineage, searchWhere);
  const orders = await fetchAdminOrdersRich(where, { take: ADMIN_ORDERS_EXPORT_MAX });
  return { orders, label: `All matching filters · ${baseLabel} · ${orders.length} row(s)` };
}

/** Build URLSearchParams for linking exports (client). */
export function buildOrdersExportSearchParams(
  searchParams: URLSearchParams,
  scope: ExportScope,
): URLSearchParams {
  const p = new URLSearchParams();
  p.set("scope", scope);
  const raw = Object.fromEntries(searchParams.entries());
  appendOpsDateParams(p, raw);
  const kind = searchParams.get("kind");
  if (kind === "CAR" || kind === "PARTS") p.set("kind", kind);
  const pl = searchParams.get("partsLineage");
  if (pl === "ghana" || pl === "china_preorder") p.set("partsLineage", pl);
  const q = searchParams.get("q");
  if (q && q.trim()) p.set("q", q.trim());
  const page = searchParams.get("page");
  if (scope === "page" && page) p.set("page", page);
  return p;
}
