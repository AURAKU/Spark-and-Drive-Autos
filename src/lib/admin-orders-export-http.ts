import type { DeliveryMode, OrderKind } from "@prisma/client";

import { appendOpsDateParams, parseOpsDateFromSearchParams } from "@/lib/admin-operations-date-filter";
import type { AdminPartsLineage } from "@/lib/admin-orders-parts-filter";
import {
  ADMIN_ORDERS_EXPORT_MAX,
  ADMIN_ORDERS_PAGE_SIZE,
  type AdminCarOrderLaneFilter,
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
  partsDeliveryMode: DeliveryMode | null,
  carOrderLane: AdminCarOrderLaneFilter,
) {
  const k =
    kind === "CAR" ? "Cars Inventory only" : kind === "PARTS" ? "Parts & Accessories only" : "All kinds";
  const plL =
    pl === "ghana" ? "Ghana stock parts" : pl === "china_preorder" ? "China pre-order parts" : null;
  const dm =
    partsDeliveryMode === "AIR_EXPRESS"
      ? "Parts delivery: air express"
      : partsDeliveryMode === "AIR_STANDARD"
        ? "Parts delivery: air standard"
        : partsDeliveryMode === "SEA"
          ? "Parts delivery: sea"
          : null;
  const carLane =
    carOrderLane === "reserved_deposit"
      ? "Car: reserved (deposit)"
      : carOrderLane === "awaiting_balance"
        ? "Car: awaiting balance"
        : carOrderLane === "followup_required"
          ? "Car: follow-up required"
          : null;
  return [k, plL, dateLabel !== "All dates" ? dateLabel : null, searchQ ? `Search: ${searchQ}` : null, dm, carLane]
    .filter(Boolean)
    .join(" · ");
}

function parsePartsDeliveryMode(raw: string | null): DeliveryMode | null {
  if (raw === "AIR_EXPRESS" || raw === "AIR_STANDARD" || raw === "SEA") return raw;
  return null;
}

function parseCarOrderLane(raw: string | null): AdminCarOrderLaneFilter {
  if (raw === "reserved_deposit" || raw === "awaiting_balance" || raw === "followup_required") return raw;
  return null;
}

function parseExportQuery(url: URL, raw: Record<string, string | string[] | undefined>) {
  const kindRaw = url.searchParams.get("kind") ?? "";
  const kindFilter: OrdersExportKindFilter =
    kindRaw === "CAR" || kindRaw === "PARTS" ? (kindRaw as OrderKind) : null;
  const plRaw = url.searchParams.get("partsLineage") ?? "";
  const partsLineage: AdminPartsLineage =
    plRaw === "ghana" || plRaw === "china_preorder" ? (plRaw as AdminPartsLineage) : null;
  const partsDeliveryMode = parsePartsDeliveryMode(url.searchParams.get("partsDeliveryMode"));
  const carOrderLane = parseCarOrderLane(url.searchParams.get("carOrderLane"));
  const ops = parseOpsDateFromSearchParams(raw);
  const searchQ = normalizeOrderListSearchQuery(url.searchParams.get("q"));
  const searchWhere = buildOrderListSearchWhere(searchQ);
  const baseLabel = filterDescription(kindFilter, ops.label, partsLineage, searchQ, partsDeliveryMode, carOrderLane);
  return { kindFilter, partsLineage, ops, searchQ, searchWhere, baseLabel, partsDeliveryMode, carOrderLane };
}

export async function loadAdminOrdersForExport(opts: {
  scope: ExportScope;
  url: URL;
  rawParams: Record<string, string | string[] | undefined>;
  /** Required when scope is `selected` */
  selectedIds?: string[];
}): Promise<{ orders: AdminOrderRich[]; label: string }> {
  const { kindFilter, partsLineage, ops, searchWhere, baseLabel, partsDeliveryMode, carOrderLane } = parseExportQuery(
    opts.url,
    opts.rawParams,
  );

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
    const where = buildAdminOrdersBaseWhere(kindFilter, tr, partsLineage, searchWhere, partsDeliveryMode, carOrderLane);
    const orders = await fetchAdminOrdersRich(where, { take: ADMIN_ORDERS_EXPORT_MAX });
    return { orders, label: `Today's orders · ${baseLabel} · ${orders.length} row(s)` };
  }

  if (opts.scope === "page") {
    const pageRaw = opts.url.searchParams.get("page");
    const page = Math.max(1, parseInt(pageRaw || "1", 10) || 1);
    const where = buildAdminOrdersBaseWhere(
      kindFilter,
      ops.range,
      partsLineage,
      searchWhere,
      partsDeliveryMode,
      carOrderLane,
    );
    const orders = await fetchAdminOrdersRich(where, {
      skip: (page - 1) * ADMIN_ORDERS_PAGE_SIZE,
      take: ADMIN_ORDERS_PAGE_SIZE,
    });
    return { orders, label: `Current page ${page} · ${baseLabel} · ${orders.length} row(s)` };
  }

  const where = buildAdminOrdersBaseWhere(
    kindFilter,
    ops.range,
    partsLineage,
    searchWhere,
    partsDeliveryMode,
    carOrderLane,
  );
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
  const pdm = searchParams.get("partsDeliveryMode");
  if (pdm === "AIR_EXPRESS" || pdm === "AIR_STANDARD" || pdm === "SEA") p.set("partsDeliveryMode", pdm);
  const carLane = searchParams.get("carOrderLane");
  if (carLane === "reserved_deposit" || carLane === "awaiting_balance" || carLane === "followup_required") {
    p.set("carOrderLane", carLane);
  }
  const q = searchParams.get("q");
  if (q && q.trim()) p.set("q", q.trim());
  const page = searchParams.get("page");
  if (scope === "page" && page) p.set("page", page);
  return p;
}
