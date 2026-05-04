export function formatMoney(amount: number, currency = "GHS") {
  try {
    return new Intl.NumberFormat("en-GH", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString("en-GH")}`;
  }
}

export function formatDate(d: Date | string | null | undefined) {
  if (d == null) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "—";
  try {
    return new Intl.DateTimeFormat("en-GH", { dateStyle: "medium", timeStyle: "short" }).format(date);
  } catch {
    return "—";
  }
}

/** Safe ISO string for server logs (never throws). */
export function safeDateToIso(d: Date | string | null | undefined): string | null {
  if (d == null) return null;
  const date = typeof d === "string" ? new Date(d) : d;
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
  try {
    return date.toISOString();
  } catch {
    return null;
  }
}
