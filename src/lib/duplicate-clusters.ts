/**
 * Offline duplicate clustering for admin inventory review.
 * Uses SKU, normalized title, token-bag equality, and same-category title similarity (Dice bigrams).
 */

export type PartDuplicateSignal =
  | "SAME_SKU"
  | "SAME_NORMALIZED_TITLE"
  | "SAME_TOKEN_BAG"
  | "HIGH_TITLE_SIMILARITY";

export type CarDuplicateSignal = "SAME_VIN" | "EXACT_SAME_TITLE" | "HIGH_TITLE_SIMILARITY";

export type PartClusterMember = {
  id: string;
  title: string;
  sku: string | null;
  slug: string;
  category: string;
  listingState: string;
  basePriceRmb: string;
  updatedAt: string;
};

export type CarClusterMember = {
  id: string;
  title: string;
  slug: string;
  brand: string;
  model: string;
  year: number;
  vin: string | null;
  listingState: string;
  basePriceRmb: string;
  updatedAt: string;
};

export type PartDuplicateCluster = {
  id: string;
  signals: PartDuplicateSignal[];
  members: PartClusterMember[];
};

export type CarDuplicateCluster = {
  id: string;
  signals: CarDuplicateSignal[];
  members: CarClusterMember[];
};

const STOP = new Set([
  "the",
  "and",
  "for",
  "with",
  "from",
  "set",
  "kit",
  "new",
  "oem",
  "auto",
  "car",
  "pcs",
  "pc",
  "x",
]);

export function normCollapse(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeTitleKey(title: string): string {
  return normCollapse(title);
}

export function sortedTokenKey(title: string): string {
  const raw = title.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  const tokens = raw.filter((t) => t.length > 1 && !STOP.has(t));
  return [...new Set(tokens)].sort().join(" ");
}

export function significantTokens(title: string, minLen = 3, max = 6): string[] {
  const raw = title.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const t of raw) {
    if (t.length < minLen || STOP.has(t) || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
    if (out.length >= max) break;
  }
  return out;
}

/** Sørensen–Dice on character bigrams — robust for minor punctuation / spacing differences. */
export function diceBigramSimilarity(a: string, b: string): number {
  const x = normCollapse(a).replace(/\s/g, "");
  const y = normCollapse(b).replace(/\s/g, "");
  if (!x.length || !y.length) return x === y ? 1 : 0;
  if (x === y) return 1;
  if (x.length < 2 || y.length < 2) return 0;

  const bigrams = (s: string) => {
    const m = new Map<string, number>();
    for (let i = 0; i < s.length - 1; i++) {
      const bg = s.slice(i, i + 2);
      m.set(bg, (m.get(bg) ?? 0) + 1);
    }
    return m;
  };
  const A = bigrams(x);
  const B = bigrams(y);
  let inter = 0;
  for (const [k, v] of A) {
    inter += Math.min(v, B.get(k) ?? 0);
  }
  return (2 * inter) / (x.length - 1 + y.length - 1);
}

class DisjointSet {
  private readonly parent = new Map<string, string>();

  add(id: string) {
    if (!this.parent.has(id)) this.parent.set(id, id);
  }

  find(id: string): string {
    let p = this.parent.get(id);
    if (p === undefined) {
      this.parent.set(id, id);
      return id;
    }
    if (p !== id) {
      p = this.find(p);
      this.parent.set(id, p);
    }
    return p;
  }

  union(a: string, b: string) {
    this.add(a);
    this.add(b);
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent.set(ra, rb);
  }

  /** Groups of size ≥ 2 */
  clusters(): string[][] {
    const byRoot = new Map<string, string[]>();
    for (const id of this.parent.keys()) {
      const r = this.find(id);
      if (!byRoot.has(r)) byRoot.set(r, []);
      byRoot.get(r)!.push(id);
    }
    return [...byRoot.values()].filter((g) => g.length > 1);
  }
}

function partClusterSignals(rows: PartClusterMember[]): PartDuplicateSignal[] {
  const signals = new Set<PartDuplicateSignal>();
  const skuCounts = new Map<string, number>();
  for (const r of rows) {
    const s = r.sku?.trim().toLowerCase();
    if (!s) continue;
    skuCounts.set(s, (skuCounts.get(s) ?? 0) + 1);
  }
  if ([...skuCounts.values()].some((c) => c >= 2)) signals.add("SAME_SKU");

  const titleKeyCounts = new Map<string, number>();
  for (const r of rows) {
    const k = normalizeTitleKey(r.title);
    if (!k) continue;
    titleKeyCounts.set(k, (titleKeyCounts.get(k) ?? 0) + 1);
  }
  if ([...titleKeyCounts.values()].some((c) => c >= 2)) signals.add("SAME_NORMALIZED_TITLE");

  const tokenKeyCounts = new Map<string, number>();
  for (const r of rows) {
    const k = sortedTokenKey(r.title);
    if (k.length < 4) continue;
    tokenKeyCounts.set(k, (tokenKeyCounts.get(k) ?? 0) + 1);
  }
  if ([...tokenKeyCounts.values()].some((c) => c >= 2)) signals.add("SAME_TOKEN_BAG");

  if (signals.size === 0) signals.add("HIGH_TITLE_SIMILARITY");
  return [...signals];
}

function carClusterSignals(rows: CarClusterMember[]): CarDuplicateSignal[] {
  const signals = new Set<CarDuplicateSignal>();
  const vinCounts = new Map<string, number>();
  for (const r of rows) {
    const v = r.vin?.trim().toUpperCase();
    if (!v || v.length < 8) continue;
    vinCounts.set(v, (vinCounts.get(v) ?? 0) + 1);
  }
  if ([...vinCounts.values()].some((c) => c >= 2)) signals.add("SAME_VIN");

  const titleKeyCounts = new Map<string, number>();
  for (const r of rows) {
    const k = normalizeTitleKey(r.title);
    if (k.length < 4) continue;
    titleKeyCounts.set(k, (titleKeyCounts.get(k) ?? 0) + 1);
  }
  if ([...titleKeyCounts.values()].some((c) => c >= 2)) signals.add("EXACT_SAME_TITLE");

  if (signals.size === 0) signals.add("HIGH_TITLE_SIMILARITY");
  return [...signals];
}

function clusterBucketKey(category: string, title: string): string {
  const cat = normCollapse(category) || "—";
  const first = (significantTokens(title, 4, 1)[0] ?? normCollapse(title).slice(0, 4)) || "x";
  return `${cat}::${first}`;
}

/**
 * @param parts — load full inventory slice (same columns as Prisma select); cap in caller if needed.
 */
export function scanPartDuplicateClusters(parts: PartClusterMember[]): PartDuplicateCluster[] {
  if (parts.length < 2) return [];

  const byId = new Map(parts.map((p) => [p.id, p]));
  const uf = new DisjointSet();
  for (const p of parts) uf.add(p.id);

  const mergeGroup = (ids: string[]) => {
    if (ids.length < 2) return;
    const head = ids[0];
    for (let i = 1; i < ids.length; i++) uf.union(head, ids[i]!);
  };

  const bySku = new Map<string, string[]>();
  for (const p of parts) {
    const s = p.sku?.trim().toLowerCase();
    if (!s) continue;
    if (!bySku.has(s)) bySku.set(s, []);
    bySku.get(s)!.push(p.id);
  }
  for (const g of bySku.values()) mergeGroup(g);

  const byNormTitle = new Map<string, string[]>();
  for (const p of parts) {
    const k = normalizeTitleKey(p.title);
    if (!k) continue;
    if (!byNormTitle.has(k)) byNormTitle.set(k, []);
    byNormTitle.get(k)!.push(p.id);
  }
  for (const g of byNormTitle.values()) mergeGroup(g);

  const byTokenBag = new Map<string, string[]>();
  for (const p of parts) {
    const k = sortedTokenKey(p.title);
    if (k.length < 4) continue;
    if (!byTokenBag.has(k)) byTokenBag.set(k, []);
    byTokenBag.get(k)!.push(p.id);
  }
  for (const g of byTokenBag.values()) mergeGroup(g);

  const buckets = new Map<string, PartClusterMember[]>();
  for (const p of parts) {
    const k = clusterBucketKey(p.category, p.title);
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k)!.push(p);
  }

  const SIM_THRESHOLD = 0.86;
  for (const group of buckets.values()) {
    if (group.length < 2) continue;
    if (group.length > 72) continue;
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const a = group[i]!;
        const b = group[j]!;
        if (diceBigramSimilarity(a.title, b.title) >= SIM_THRESHOLD) {
          uf.union(a.id, b.id);
        }
      }
    }
  }

  const rawClusters = uf.clusters();
  const out: PartDuplicateCluster[] = [];
  let idx = 0;
  for (const ids of rawClusters) {
    const members = ids
      .map((id) => byId.get(id))
      .filter((m): m is PartClusterMember => Boolean(m))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    if (members.length < 2) continue;
    out.push({
      id: `part-${idx++}`,
      signals: partClusterSignals(members),
      members,
    });
  }

  out.sort((a, b) => b.members.length - a.members.length);
  return out;
}

export function scanCarDuplicateClusters(cars: CarClusterMember[]): CarDuplicateCluster[] {
  if (cars.length < 2) return [];

  const byId = new Map(cars.map((c) => [c.id, c]));
  const uf = new DisjointSet();
  for (const c of cars) uf.add(c.id);

  const mergeGroup = (ids: string[]) => {
    if (ids.length < 2) return;
    const head = ids[0];
    for (let i = 1; i < ids.length; i++) uf.union(head!, ids[i]!);
  };

  const byVin = new Map<string, string[]>();
  for (const c of cars) {
    const v = c.vin?.trim().toUpperCase();
    if (!v || v.length < 8) continue;
    if (!byVin.has(v)) byVin.set(v, []);
    byVin.get(v)!.push(c.id);
  }
  for (const g of byVin.values()) mergeGroup(g);

  const buckets = new Map<string, CarClusterMember[]>();
  for (const c of cars) {
    const k = `${normCollapse(c.brand)}|${normCollapse(c.model)}|${c.year}`;
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k)!.push(c);
  }

  const SIM_THRESHOLD = 0.88;
  for (const group of buckets.values()) {
    if (group.length < 2) continue;
    if (group.length > 48) continue;

    const byNormTitle = new Map<string, string[]>();
    for (const c of group) {
      const t = normalizeTitleKey(c.title);
      if (t.length < 4) continue;
      if (!byNormTitle.has(t)) byNormTitle.set(t, []);
      byNormTitle.get(t)!.push(c.id);
    }
    for (const g of byNormTitle.values()) mergeGroup(g);

    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const a = group[i]!;
        const b = group[j]!;
        if (diceBigramSimilarity(a.title, b.title) >= SIM_THRESHOLD) {
          uf.union(a.id, b.id);
        }
      }
    }
  }

  const rawClusters = uf.clusters();
  const out: CarDuplicateCluster[] = [];
  let idx = 0;
  for (const ids of rawClusters) {
    const members = ids
      .map((id) => byId.get(id))
      .filter((m): m is CarClusterMember => Boolean(m))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    if (members.length < 2) continue;
    out.push({
      id: `car-${idx++}`,
      signals: carClusterSignals(members),
      members,
    });
  }

  out.sort((a, b) => b.members.length - a.members.length);
  return out;
}
