import { normalizeIntelListPage } from "@/lib/ops";

export type SearchParamsRecord = Record<string, string | string[] | undefined>;

/** Read a 1-based page number from search params. */
export function readListPage(sp: SearchParamsRecord, key = "page"): number {
  const v = sp[key];
  const s = typeof v === "string" ? v : Array.isArray(v) ? v[0] : undefined;
  if (s == null || s === "") return 1;
  const n = parseInt(s, 10);
  return normalizeIntelListPage(Number.isFinite(n) ? n : undefined);
}

export function readSearchParam(sp: SearchParamsRecord, key: string): string {
  const v = sp[key];
  const s = typeof v === "string" ? v : Array.isArray(v) ? v[0] : undefined;
  return (s ?? "").trim();
}

export type ListPageMeta = {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  skip: number;
};

export function buildListPageMeta(total: number, pageSize: number, pageReq: number): ListPageMeta {
  const safeTotal = Math.max(0, total);
  const totalPages = Math.max(1, Math.ceil(safeTotal / pageSize));
  const page = Math.min(Math.max(1, pageReq), totalPages);
  return {
    page,
    totalPages,
    total: safeTotal,
    pageSize,
    skip: (page - 1) * pageSize,
  };
}

/** Build a URL for the same path + filters, swapping only the page key. */
export function listPageHref(
  pathname: string,
  sp: SearchParamsRecord,
  page: number,
  pageKey = "page",
): string {
  const q = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    if (key === pageKey) continue;
    if (typeof value === "string" && value.length > 0) q.set(key, value);
    else if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === "string" && item.length > 0) q.append(key, item);
      }
    }
  }
  if (page > 1) q.set(pageKey, String(page));
  const qs = q.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

export function listPageNav(pathname: string, sp: SearchParamsRecord, meta: ListPageMeta, pageKey = "page") {
  const href = (p: number) => listPageHref(pathname, sp, p, pageKey);
  return {
    prevHref: meta.page > 1 ? href(meta.page - 1) : null,
    nextHref: meta.page < meta.totalPages ? href(meta.page + 1) : null,
    pageHrefs:
      meta.totalPages > 1 ? Array.from({ length: meta.totalPages }, (_, i) => href(i + 1)) : undefined,
  };
}
