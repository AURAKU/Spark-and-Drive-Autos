/**
 * Shared paste-summary parsing for admin car/part autofill.
 * Keeps label detection and money parsing in one place for cars + parts.
 */

export type AdminPriceCurrency = "GHS" | "USD" | "CNY";

export type PasteLineConfidence = "explicit" | "heuristic";

/** Normalize a human label to a comparison key (no spaces/punctuation). */
export function normalizePasteLabel(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[\s_\-]+/g, "")
    .replace(/[^a-z0-9%]/g, "");
}

/**
 * Strip thousands separators and parse a non-negative number.
 * Stops at a second decimal point or obvious junk.
 */
export function parsePlainAmount(raw: string): number | null {
  const t = raw.trim().replace(/,/g, "");
  const m = /^(\d+(?:\.\d+)?)/.exec(t);
  if (!m) return null;
  const n = parseFloat(m[1]);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/**
 * Detect currency + amount from a segment (explicit codes or symbols).
 */
export function parseMoneyWithCurrency(segment: string): { amount: number; currency: AdminPriceCurrency } | null {
  const s = segment.trim();
  const ghs =
    /(?:GHS|₵|CEDIS?)\s*:?\s*([\d,]+(?:\.\d+)?)/i.exec(s) ||
    /([\d,]+(?:\.\d+)?)\s*(?:GHS|CEDIS?)/i.exec(s);
  if (ghs) {
    const n = parseFloat(ghs[1].replace(/,/g, ""));
    if (Number.isFinite(n) && n > 0) return { amount: n, currency: "GHS" };
  }
  const rmb =
    /(?:RMB|CNY|¥)\s*:?\s*([\d,]+(?:\.\d+)?)/i.exec(s) || /([\d,]+(?:\.\d+)?)\s*(?:RMB|CNY)\b/i.exec(s);
  if (rmb) {
    const n = parseFloat(rmb[1].replace(/,/g, ""));
    if (Number.isFinite(n) && n > 0) return { amount: n, currency: "CNY" };
  }
  const usd =
    /USD\s*:?\s*([\d,]+(?:\.\d+)?)/i.exec(s) ||
    /\$\s*:?\s*([\d,]+(?:\.\d+)?)/i.exec(s) ||
    /([\d,]+(?:\.\d+)?)\s*USD\b/i.exec(s);
  if (usd) {
    const n = parseFloat(usd[1].replace(/,/g, ""));
    if (Number.isFinite(n) && n > 0) return { amount: n, currency: "USD" };
  }
  return null;
}

/**
 * Try `label: value`, `label = value`, `label:value`, or `Label - value`.
 * Returns trimmed value without the label prefix.
 */
export function tryParseLabelValueLine(line: string): { labelRaw: string; valueRaw: string; confidence: PasteLineConfidence } | null {
  const t = line.trim();
  if (!t) return null;

  const colonEq = /^([^:=\-]{1,72}?)\s*[:=]\s*([\s\S]+)$/.exec(t);
  if (colonEq) {
    return {
      labelRaw: colonEq[1].trim(),
      valueRaw: clipTrailingClause(colonEq[2].trim()),
      confidence: "explicit",
    };
  }

  const dash = /^([^\-]{1,72}?)\s+-\s+([\s\S]+)$/.exec(t);
  if (dash) {
    const left = dash[1].trim();
    const right = dash[2].trim();
    if (/^[a-zA-Z]/.test(left) && left.length <= 48 && !/^\d+$/.test(left)) {
      return { labelRaw: left, valueRaw: clipTrailingClause(right), confidence: "explicit" };
    }
  }

  return null;
}

/**
 * `title: foo, year: 2012` pasted on one line — keep only the segment before an inline `word:` label.
 */
export function clipTrailingClause(valueRaw: string): string {
  const m = /^(.+?),\s*(?:[a-z][a-z0-9\s]{0,40}?\s*[:=]\s*.+)/i.exec(valueRaw);
  if (m && m[1].trim().length > 0) return m[1].trim();
  return valueRaw.trim();
}

/**
 * Trim trailing sentence punctuation mistaken for part of the value (not internal commas in numbers).
 */
export function stripWeakTrailingPunctuation(valueRaw: string): string {
  let t = valueRaw.trim();
  t = t.replace(/[.,;:]+$/u, "");
  return t.trim();
}

type SpaceLabelOpts = {
  /** Longest label first: e.g. "base selling price" (default 4). */
  maxLabelTokens?: number;
};

/**
 * `title Toyota Corolla`, `year 2012`, `supplier cost CNY 65000` — label tokens then value.
 * Only matches when the normalized prefix is in `allowedNormKeys`.
 */
export function tryParseSpaceSeparatedLabelLine(
  line: string,
  allowedNormKeys: Set<string>,
  opts?: SpaceLabelOpts,
): { normKey: string; valueRest: string } | null {
  const maxN = opts?.maxLabelTokens ?? 4;
  const t = line.trim();
  if (!t) return null;
  const tokens = t.split(/\s+/).filter(Boolean);
  if (tokens.length < 2) return null;
  const upperBound = Math.min(maxN, tokens.length - 1);
  for (let n = upperBound; n >= 1; n--) {
    const labelPart = tokens.slice(0, n).join(" ");
    const norm = normalizePasteLabel(labelPart);
    if (!norm || norm.length < 2) continue;
    if (!allowedNormKeys.has(norm)) continue;
    const valueRest = tokens.slice(n).join(" ").trim();
    if (!valueRest) continue;
    return { normKey: norm, valueRest };
  }
  return null;
}

/**
 * `price GHS 95000` / `supplier cost CNY 65000` (label then money, no colon).
 */
export function tryParseLabelThenMoney(line: string): {
  labelKey: string;
  amount: number;
  currency: AdminPriceCurrency;
  confidence: PasteLineConfidence;
} | null {
  const t = line.trim();
  const re =
    /^([a-zA-Z][a-zA-Z0-9\s/]{0,60}?)\s+((?:(?:GHS|USD|CNY|RMB|¥|₵|CEDIS?|\$)\s*)?[\d,]+(?:\.\d+)?(?:\s*(?:GHS|USD|CNY|RMB|CEDIS?))?)\s*$/i;
  const m = re.exec(t);
  if (!m) return null;
  const labelKey = m[1].trim();
  const money = parseMoneyWithCurrency(m[2]);
  if (!money) return null;
  if (normalizePasteLabel(labelKey).length < 3) return null;
  return { labelKey, amount: money.amount, currency: money.currency, confidence: "explicit" };
}

/**
 * Scan lines and loose text for the strongest money mention (for heuristics).
 */
export function findBestMoneyInText(text: string): { amount: number; currency: AdminPriceCurrency } | null {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  let best: { amount: number; currency: AdminPriceCurrency; score: number } | null = null;
  for (const line of lines) {
    const lv = tryParseLabelValueLine(line);
    const seg = lv?.valueRaw ?? line;
    const p = parseMoneyWithCurrency(seg);
    if (!p) continue;
    const score = /price|cost|asking|sell|cedis|ghs|usd|rmb|cny/i.test(line) ? 3 : 1;
    if (!best || score > best.score || (score === best.score && p.amount > best.amount)) {
      best = { ...p, score };
    }
  }
  if (best) return { amount: best.amount, currency: best.currency };
  const blob = text.replace(/\r?\n/g, " ");
  return parseMoneyWithCurrency(blob);
}
