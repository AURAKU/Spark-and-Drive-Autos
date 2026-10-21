export type BogFxPair = {
  pair: string;
  fromCurrency: string;
  toCurrency: "GHS";
  buying: number;
  selling: number;
  mid: number;
};

export type BogFxSnapshot = {
  rateDate: string;
  source: "BANK_OF_GHANA";
  sourceUrl: string;
  pairs: BogFxPair[];
};

const BOG_PAGE = "https://www.bog.gov.gh/treasury-and-the-markets/daily-interbank-fx-rates/";
const STATSGH_JSON = "https://www.statsgh.com/api/data/bog-fx-rates?format=json";

const TRACKED_PAIRS: Record<string, string> = {
  USDGHS: "USD",
  CNYGHS: "CNY",
  EURGHS: "EUR",
  GBPGHS: "GBP",
};

export function parseBogRateDate(raw: string): string | null {
  const text = raw.trim();
  const iso = text.match(/^(\d{4}-\d{2}-\d{2})/);
  if (iso) return iso[1];
  const parsed = Date.parse(text);
  if (!Number.isFinite(parsed)) return null;
  return new Date(parsed).toISOString().slice(0, 10);
}

export function parseBogOfficialHtml(html: string): BogFxSnapshot | null {
  const rows = [...html.matchAll(/<tr[\s\S]*?<\/tr>/gi)].map((m) => m[0]);
  let rateDate: string | null = null;
  const pairs: BogFxPair[] = [];

  for (const row of rows) {
    const cells = [...row.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((m) =>
      m[1].replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim(),
    );
    if (cells.length < 5) continue;
    const pairCell = cells.find((c) => /GHS$/i.test(c) && c.length <= 8);
    if (!pairCell) continue;
    const pair = pairCell.toUpperCase();
    const fromCurrency = TRACKED_PAIRS[pair];
    if (!fromCurrency) continue;
    const nums = cells
      .map((c) => Number(c.replace(/,/g, "")))
      .filter((n) => Number.isFinite(n) && n > 0);
    if (nums.length < 3) continue;
    const buying = nums[nums.length - 3]!;
    const selling = nums[nums.length - 2]!;
    const mid = nums[nums.length - 1]!;
    const dateCell = cells.find((c) => parseBogRateDate(c));
    if (dateCell) rateDate = parseBogRateDate(dateCell);
    pairs.push({ pair, fromCurrency, toCurrency: "GHS", buying, selling, mid });
  }

  if (!rateDate || pairs.length === 0) return null;
  return { rateDate, source: "BANK_OF_GHANA", sourceUrl: BOG_PAGE, pairs };
}

type StatsGhRow = {
  rate_date?: string;
  pair?: string;
  buying?: number | string;
  selling?: number | string;
  mid?: number | string;
  source_url?: string;
};

export function parseStatsGhRows(rows: StatsGhRow[]): BogFxSnapshot | null {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const latestDate = rows
    .map((r) => String(r.rate_date ?? "").slice(0, 10))
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
    .sort()
    .at(-1);
  if (!latestDate) return null;
  const pairs: BogFxPair[] = [];
  for (const row of rows) {
    if (String(row.rate_date ?? "").slice(0, 10) !== latestDate) continue;
    const pair = String(row.pair ?? "").toUpperCase();
    const fromCurrency = TRACKED_PAIRS[pair];
    if (!fromCurrency) continue;
    const mid = Number(row.mid);
    const buying = Number(row.buying);
    const selling = Number(row.selling);
    if (!Number.isFinite(mid) || mid <= 0) continue;
    pairs.push({
      pair,
      fromCurrency,
      toCurrency: "GHS",
      buying: Number.isFinite(buying) ? buying : mid,
      selling: Number.isFinite(selling) ? selling : mid,
      mid,
    });
  }
  if (pairs.length === 0) return null;
  return {
    rateDate: latestDate,
    source: "BANK_OF_GHANA",
    sourceUrl: rows.find((r) => r.source_url)?.source_url || STATSGH_JSON,
    pairs,
  };
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "user-agent": "SparkAndDriveDutyIntelligence/1.0" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`${url} returned ${res.status}`);
  return res.text();
}

export async function fetchBankOfGhanaFx(): Promise<BogFxSnapshot> {
  try {
    const html = await fetchText(BOG_PAGE);
    const parsed = parseBogOfficialHtml(html);
    if (parsed && parsed.pairs.some((p) => p.fromCurrency === "USD")) return parsed;
  } catch {
    /* official page can change markup — fall through */
  }

  const raw = await fetchText(STATSGH_JSON);
  const json = JSON.parse(raw) as StatsGhRow[] | { data?: StatsGhRow[] };
  const rows = Array.isArray(json) ? json : Array.isArray(json.data) ? json.data : [];
  const parsed = parseStatsGhRows(rows);
  if (!parsed || !parsed.pairs.some((p) => p.fromCurrency === "USD")) {
    throw new Error("Bank of Ghana USD/GHS rate is not available from official sources today.");
  }
  return parsed;
}
