import { z } from "zod";

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(5).max(100).default(20),
});

export type PaginationInput = z.infer<typeof paginationSchema>;

export type PaginatedResult<T> = {
  items: T[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

export function parsePagination(
  searchParams: Record<string, string | string[] | undefined>,
  defaultPageSize = 20,
): PaginationInput {
  const pageRaw = typeof searchParams.page === "string" ? searchParams.page : "1";
  const sizeRaw = typeof searchParams.pageSize === "string" ? searchParams.pageSize : String(defaultPageSize);
  return paginationSchema.parse({ page: pageRaw, pageSize: sizeRaw });
}

export function paginate<T>(items: T[], page: number, pageSize: number): PaginatedResult<T> {
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    page: safePage,
    pageSize,
    totalItems,
    totalPages,
  };
}

export function buildPageHref(basePath: string, page: number, extra?: Record<string, string>): string {
  const params = new URLSearchParams(extra);
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}
