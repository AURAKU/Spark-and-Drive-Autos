/** Infer engine capacity in cc from listing or model text such as `1.5T`, `2.0L`, `1498cc`. */
export function inferEngineCcFromText(...parts: Array<string | null | undefined>): number | undefined {
  const text = parts.filter(Boolean).join(" ");
  if (!text.trim()) return undefined;

  const cc = text.match(/(\d{3,4})\s*(?:cc|cm3)\b/i);
  if (cc) {
    const n = Number(cc[1]);
    if (n >= 600 && n <= 8000) return n;
  }

  const liters = text.match(/(\d(?:\.\d)?)\s*(?:l|t)\b/i);
  if (liters) {
    const n = Math.round(Number(liters[1]) * 1000);
    if (n >= 600 && n <= 8000) return n;
  }

  return undefined;
}
