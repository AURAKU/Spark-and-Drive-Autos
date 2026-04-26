import type { Prisma } from "@prisma/client";

/** Shared URL params for Payment intelligence, All orders, Shipping, Duty. */
export type OpsDateMode = "off" | "day" | "month" | "year";

export type OpsDateParsed = {
  mode: OpsDateMode;
  /** Human label for PDF headers / UI */
  label: string;
  /** Inclusive gte, exclusive lt — matches Prisma `createdAt` / `updatedAt` patterns */
  range: { gte: Date; lt: Date } | null;
};

export function parseOpsDateFromSearchParams(
  sp: Record<string, string | string[] | undefined>,
): OpsDateParsed {
  const modeRaw = typeof sp.opsDateMode === "string" ? sp.opsDateMode : "";
  const mode: OpsDateMode =
    modeRaw === "day" || modeRaw === "month" || modeRaw === "year" || modeRaw === "off" ? modeRaw : "off";

  if (mode === "off") {
    return { mode: "off", label: "All dates", range: null };
  }

  const day = typeof sp.opsDateDay === "string" ? sp.opsDateDay.trim() : "";
  const month = typeof sp.opsDateMonth === "string" ? sp.opsDateMonth.trim() : "";
  const year = typeof sp.opsDateYear === "string" ? sp.opsDateYear.trim() : "";

  if (mode === "day") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
      return { mode: "off", label: "All dates", range: null };
    }
    const gte = new Date(`${day}T00:00:00.000Z`);
    const lt = new Date(gte.getTime() + 24 * 60 * 60 * 1000);
    return { mode: "day", label: `Day ${day}`, range: { gte, lt } };
  }

  if (mode === "month") {
    if (!/^\d{4}-\d{2}$/.test(month)) {
      return { mode: "off", label: "All dates", range: null };
    }
    const [y, m] = month.split("-").map(Number);
    const gte = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0));
    const lt = new Date(Date.UTC(y, m, 1, 0, 0, 0, 0));
    return { mode: "month", label: `Month ${month}`, range: { gte, lt } };
  }

  if (mode === "year") {
    if (!/^\d{4}$/.test(year)) {
      return { mode: "off", label: "All dates", range: null };
    }
    const y = Number(year);
    const gte = new Date(Date.UTC(y, 0, 1, 0, 0, 0, 0));
    const lt = new Date(Date.UTC(y + 1, 0, 1, 0, 0, 0, 0));
    return { mode: "year", label: `Year ${year}`, range: { gte, lt } };
  }

  return { mode: "off", label: "All dates", range: null };
}

export function prismaCreatedAtInRange(
  range: OpsDateParsed["range"],
): Prisma.DateTimeFilter | undefined {
  if (!range) return undefined;
  return { gte: range.gte, lt: range.lt };
}

export function prismaUpdatedAtInRange(
  range: OpsDateParsed["range"],
): Prisma.DateTimeFilter | undefined {
  if (!range) return undefined;
  return { gte: range.gte, lt: range.lt };
}

/** Preserve calendar filter when building admin links or forms. */
export function appendOpsDateParams(
  params: URLSearchParams,
  raw: Record<string, string | string[] | undefined>,
) {
  const mode = typeof raw.opsDateMode === "string" ? raw.opsDateMode : "";
  if (mode === "day" || mode === "month" || mode === "year") {
    params.set("opsDateMode", mode);
    if (mode === "day" && typeof raw.opsDateDay === "string") params.set("opsDateDay", raw.opsDateDay);
    if (mode === "month" && typeof raw.opsDateMonth === "string") params.set("opsDateMonth", raw.opsDateMonth);
    if (mode === "year" && typeof raw.opsDateYear === "string") params.set("opsDateYear", raw.opsDateYear);
  }
  const pl = typeof raw.partsLineage === "string" ? raw.partsLineage : "";
  if (pl === "ghana" || pl === "china_preorder") {
    params.set("partsLineage", pl);
  }
}
