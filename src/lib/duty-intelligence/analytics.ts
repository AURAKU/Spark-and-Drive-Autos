import { prisma } from "@/lib/prisma";

export type DutyAnalyticsSnapshot = {
  totalCalculations: number;
  totalVerifiedImports: number;
  avgLandedCostGhs: number;
  avgPredictionErrorPct: number | null;
  avgClearanceDays: number | null;
  monthlyImports: { month: string; count: number; avgLandedCost: number }[];
  topVehicles: { label: string; count: number }[];
  topShippingLines: { name: string; count: number }[];
  fuelTypeBreakdown: { fuelType: string; count: number }[];
  exchangeRateTrend: { date: string; rate: number; source: string }[];
  predictionAccuracy: { month: string; avgError: number; sampleCount: number }[];
};

export async function getDutyAnalytics(countryConfigId: string): Promise<DutyAnalyticsSnapshot> {
  const [calcCount, verifiedCount, verified, calculations, rates] = await Promise.all([
    prisma.dutyCalculation.count({ where: { countryConfigId, status: "SAVED" } }),
    prisma.dutyVerifiedImport.count({ where: { countryConfigId, status: "VERIFIED" } }),
    prisma.dutyVerifiedImport.findMany({
      where: { countryConfigId, status: "VERIFIED" },
      select: {
        manufacturer: true,
        model: true,
        year: true,
        fuelType: true,
        shippingLine: true,
        totalLandedCostGhs: true,
        predictionErrorPct: true,
        clearanceDays: true,
        verifiedAt: true,
        createdAt: true,
      },
      orderBy: { verifiedAt: "desc" },
      take: 500,
    }),
    prisma.dutyCalculation.findMany({
      where: { countryConfigId },
      select: { totalLandedCostGhs: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.dutyExchangeRate.findMany({
      where: { countryConfigId, fromCurrency: "USD", toCurrency: "GHS" },
      orderBy: { effectiveDate: "desc" },
      take: 30,
      select: { effectiveDate: true, rate: true, source: true },
    }),
  ]);

  const landedCosts = verified
    .map((v) => (v.totalLandedCostGhs != null ? Number(v.totalLandedCostGhs) : 0))
    .filter((n) => n > 0);
  const avgLandedCostGhs =
    landedCosts.length > 0 ? Math.round(landedCosts.reduce((s, n) => s + n, 0) / landedCosts.length) : 0;

  const errors = verified
    .map((v) => (v.predictionErrorPct != null ? Number(v.predictionErrorPct) : null))
    .filter((n): n is number => n != null);
  const avgPredictionErrorPct =
    errors.length > 0 ? Math.round((errors.reduce((s, n) => s + Math.abs(n), 0) / errors.length) * 100) / 100 : null;

  const clearanceDays = verified
    .map((v) => v.clearanceDays)
    .filter((n): n is number => n != null);
  const avgClearanceDays =
    clearanceDays.length > 0
      ? Math.round(clearanceDays.reduce((s, n) => s + n, 0) / clearanceDays.length)
      : null;

  const monthMap = new Map<string, { count: number; total: number }>();
  for (const v of verified) {
    const d = v.verifiedAt ?? v.createdAt;
    const month = d.toISOString().slice(0, 7);
    const cur = monthMap.get(month) ?? { count: 0, total: 0 };
    cur.count += 1;
    cur.total += v.totalLandedCostGhs != null ? Number(v.totalLandedCostGhs) : 0;
    monthMap.set(month, cur);
  }
  const monthlyImports = [...monthMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12)
    .map(([month, data]) => ({
      month,
      count: data.count,
      avgLandedCost: data.count > 0 ? Math.round(data.total / data.count) : 0,
    }));

  const vehicleMap = new Map<string, number>();
  for (const v of verified) {
    const label = [v.manufacturer, v.model, v.year].filter(Boolean).join(" ");
    if (!label) continue;
    vehicleMap.set(label, (vehicleMap.get(label) ?? 0) + 1);
  }
  const topVehicles = [...vehicleMap.entries()]
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([label, count]) => ({ label, count }));

  const lineMap = new Map<string, number>();
  for (const v of verified) {
    if (!v.shippingLine) continue;
    lineMap.set(v.shippingLine, (lineMap.get(v.shippingLine) ?? 0) + 1);
  }
  const topShippingLines = [...lineMap.entries()]
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8)
    .map(([name, count]) => ({ name, count }));

  const fuelMap = new Map<string, number>();
  for (const v of verified) {
    const ft = v.fuelType ?? "UNKNOWN";
    fuelMap.set(ft, (fuelMap.get(ft) ?? 0) + 1);
  }
  const fuelTypeBreakdown = [...fuelMap.entries()].map(([fuelType, count]) => ({ fuelType, count }));

  const exchangeRateTrend = rates
    .reverse()
    .map((r) => ({
      date: r.effectiveDate.toISOString().slice(0, 10),
      rate: Number(r.rate),
      source: r.source,
    }));

  const errorMonthMap = new Map<string, { total: number; count: number }>();
  for (const v of verified) {
    if (v.predictionErrorPct == null) continue;
    const d = v.verifiedAt ?? v.createdAt;
    const month = d.toISOString().slice(0, 7);
    const cur = errorMonthMap.get(month) ?? { total: 0, count: 0 };
    cur.total += Math.abs(Number(v.predictionErrorPct));
    cur.count += 1;
    errorMonthMap.set(month, cur);
  }
  const predictionAccuracy = [...errorMonthMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, data]) => ({
      month,
      avgError: Math.round((data.total / data.count) * 100) / 100,
      sampleCount: data.count,
    }));

  return {
    totalCalculations: calcCount,
    totalVerifiedImports: verifiedCount,
    avgLandedCostGhs,
    avgPredictionErrorPct,
    avgClearanceDays,
    monthlyImports,
    topVehicles,
    topShippingLines,
    fuelTypeBreakdown,
    exchangeRateTrend,
    predictionAccuracy,
  };
}
