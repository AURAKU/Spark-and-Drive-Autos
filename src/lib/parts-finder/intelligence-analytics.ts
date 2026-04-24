import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export const PARTS_FINDER_ANALYTICS_TREND_DAYS = 14;

export type PartsFinderAnalytics = Awaited<ReturnType<typeof getPartsFinderAnalytics>>;

export async function getPartsFinderAnalytics() {
  const now = new Date();
  const trendSince = new Date(now.getTime() - PARTS_FINDER_ANALYTICS_TREND_DAYS * 24 * 60 * 60 * 1000);

  const [
    totalSearches,
    successfulSearches,
    pendingSearchReviews,
    activeMemberships,
    expiredMemberships,
    suspendedMemberships,
    pendingPaymentUsers,
    pendingApprovalUsers,
    userCount,
    conversionGroups,
    topVehicleRows,
    topMakeModelRows,
    topPartRows,
    avgConfidence,
    sessionsWithAnyConversion,
    membershipRevenue,
    renewalUsersFromPayments,
    reviewTurnaroundRow,
    sessionTrendRows,
    conversionTrendRows,
    activatedMemberUsers,
    reviewStatusGroups,
  ] = await Promise.all([
    prisma.partsFinderSearchSession.count(),
    prisma.partsFinderSearchSession.count({ where: { hasRankedResults: true } }),
    prisma.partsFinderSearchSession.count({ where: { status: "PENDING_REVIEW" } }),
    prisma.partsFinderMembership.count({
      where: { status: "ACTIVE", endsAt: { gt: now } },
    }),
    prisma.partsFinderMembership.count({
      where: {
        OR: [{ status: "EXPIRED" }, { status: "ACTIVE", endsAt: { lte: now } }],
      },
    }),
    prisma.partsFinderMembership.count({ where: { status: "SUSPENDED" } }),
    prisma.payment
      .groupBy({
        by: ["userId"],
        where: {
          paymentType: "PARTS_FINDER_MEMBERSHIP",
          status: { in: ["PENDING", "AWAITING_PROOF", "PROCESSING"] },
          userId: { not: null },
        },
      })
      .then((rows) => rows.length),
    prisma.$queryRaw<[{ count: bigint }]>(Prisma.sql`
      SELECT COUNT(DISTINCT p."userId")::bigint AS count
      FROM "Payment" p
      CROSS JOIN LATERAL (
        SELECT s."approvalMode"
        FROM "PartsFinderSettings" s
        ORDER BY s."updatedAt" DESC
        LIMIT 1
      ) cfg
      WHERE p."paymentType" = 'PARTS_FINDER_MEMBERSHIP'
        AND p."status" = 'SUCCESS'
        AND p."userId" IS NOT NULL
        AND cfg."approvalMode" = 'MANUAL'
        AND NOT EXISTS (
          SELECT 1
          FROM "PartsFinderMembership" m
          WHERE m."userId" = p."userId"
            AND m."status" = 'ACTIVE'
            AND m."endsAt" > NOW()
        )
    `),
    prisma.user.count(),
    prisma.partsFinderConversion.groupBy({
      by: ["conversionType"],
      _count: { _all: true },
    }),
    prisma.$queryRaw<{ key: string; count: bigint }[]>(Prisma.sql`
      SELECT "analyticsVehicleLabel" AS key, COUNT(*)::bigint AS count
      FROM "PartsFinderSearchSession"
      WHERE "analyticsVehicleLabel" IS NOT NULL
      GROUP BY "analyticsVehicleLabel"
      ORDER BY count DESC
      LIMIT 10
    `),
    prisma.$queryRaw<{ key: string; count: bigint }[]>(Prisma.sql`
      SELECT "analyticsMakeModelLabel" AS key, COUNT(*)::bigint AS count
      FROM "PartsFinderSearchSession"
      WHERE "analyticsMakeModelLabel" IS NOT NULL
      GROUP BY "analyticsMakeModelLabel"
      ORDER BY count DESC
      LIMIT 10
    `),
    prisma.$queryRaw<{ key: string; count: bigint }[]>(Prisma.sql`
      SELECT "analyticsPartIntentLabel" AS key, COUNT(*)::bigint AS count
      FROM "PartsFinderSearchSession"
      WHERE "analyticsPartIntentLabel" IS NOT NULL AND "analyticsPartIntentLabel" <> ''
      GROUP BY "analyticsPartIntentLabel"
      ORDER BY count DESC
      LIMIT 10
    `),
    prisma.partsFinderSearchSession.aggregate({
      _avg: { confidenceScore: true },
      where: { confidenceScore: { not: null } },
    }),
    prisma.partsFinderSearchSession.count({
      where: { conversions: { some: {} } },
    }),
    prisma.payment.aggregate({
      where: { paymentType: "PARTS_FINDER_MEMBERSHIP", status: "SUCCESS" },
      _sum: { amount: true },
    }),
    prisma.$queryRaw<[{ count: bigint }]>(Prisma.sql`
      SELECT COUNT(*)::bigint AS count
      FROM (
        SELECT "userId"
        FROM "Payment"
        WHERE "paymentType" = 'PARTS_FINDER_MEMBERSHIP'
          AND "status" = 'SUCCESS'
          AND "userId" IS NOT NULL
        GROUP BY "userId"
        HAVING COUNT(*) > 1
      ) t
    `),
    prisma.$queryRaw<[{ avg_minutes: number | null }]>(Prisma.sql`
      SELECT AVG(EXTRACT(EPOCH FROM ("reviewedAt" - "createdAt")) / 60.0)::float AS avg_minutes
      FROM "PartsFinderSearchSession"
      WHERE "reviewedAt" IS NOT NULL
    `),
    prisma.$queryRaw<{ day: Date; count: bigint }[]>(Prisma.sql`
      SELECT date_trunc('day', "createdAt")::date AS day, COUNT(*)::bigint AS count
      FROM "PartsFinderSearchSession"
      WHERE "createdAt" >= ${trendSince}
      GROUP BY 1
      ORDER BY 1 ASC
    `),
    prisma.$queryRaw<{ day: Date; conversionType: string; count: bigint }[]>(Prisma.sql`
      SELECT date_trunc('day', "createdAt")::date AS day, "conversionType", COUNT(*)::bigint AS count
      FROM "PartsFinderConversion"
      WHERE "createdAt" >= ${trendSince}
      GROUP BY 1, 2
      ORDER BY 1 ASC, 2 ASC
    `),
    prisma.partsFinderMembership.groupBy({
      by: ["userId"],
      _count: { _all: true },
    }),
    prisma.partsFinderSearchSession.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
  ]);

  const conversionMap = new Map(
    conversionGroups.map((row) => [row.conversionType, row._count._all]),
  );
  const savedResults = conversionMap.get("SAVE_RESULT") ?? 0;
  const sourcingRequests = conversionMap.get("REQUEST_SOURCING") ?? 0;
  const chatStarts = conversionMap.get("OPEN_CHAT") ?? 0;
  const quoteRequests = conversionMap.get("REQUEST_QUOTE") ?? 0;
  const totalConversions = conversionGroups.reduce((sum, row) => sum + row._count._all, 0);

  const averageConfidenceScore = avgConfidence._avg.confidenceScore
    ? Math.round(avgConfidence._avg.confidenceScore)
    : 0;

  const reviewTurnaroundMinutes = Math.round(reviewTurnaroundRow[0]?.avg_minutes ?? 0);

  const membershipRevenueGhs = membershipRevenue._sum.amount
    ? Number(membershipRevenue._sum.amount)
    : 0;

  const renewalRaw = renewalUsersFromPayments[0]?.count;
  const renewalConversions = renewalRaw == null ? 0 : Number(renewalRaw);

  const pendingApprovals = Number(pendingApprovalUsers[0]?.count ?? 0);

  const searchToSourcingConversionRate =
    totalSearches > 0 ? Number(((sourcingRequests / totalSearches) * 100).toFixed(2)) : 0;

  const sessionConversionRate =
    totalSearches > 0 ? Number(((sessionsWithAnyConversion / totalSearches) * 100).toFixed(2)) : 0;

  const searchToAnyConversionRate =
    totalSearches > 0 ? Number(((totalConversions / totalSearches) * 100).toFixed(2)) : 0;

  const activationConversionRateFromUpsell =
    userCount > 0 ? Math.round((activatedMemberUsers.length / userCount) * 100) : 0;

  const sessionTrend = sessionTrendRows.map((row) => ({
    day: row.day.toISOString().slice(0, 10),
    count: Number(row.count),
  }));

  const conversionTrend = conversionTrendRows.map((row) => ({
    day: row.day.toISOString().slice(0, 10),
    conversionType: row.conversionType,
    count: Number(row.count),
  }));

  const conversionEventsByDay = new Map<string, number>();
  for (const row of conversionTrend) {
    conversionEventsByDay.set(row.day, (conversionEventsByDay.get(row.day) ?? 0) + row.count);
  }
  const trendDayKeys = new Set<string>();
  for (const s of sessionTrend) trendDayKeys.add(s.day);
  for (const d of conversionEventsByDay.keys()) trendDayKeys.add(d);
  const dailySearchVsConversions = [...trendDayKeys]
    .sort()
    .map((day) => ({
      day,
      searches: sessionTrend.find((s) => s.day === day)?.count ?? 0,
      conversionEvents: conversionEventsByDay.get(day) ?? 0,
    }));

  const reviewStatusMap = new Map(reviewStatusGroups.map((row) => [row.status, row._count._all]));

  return {
    totalSearches,
    successfulResults: successfulSearches,
    savedResults,
    sourcingRequests,
    chatStarts,
    quoteRequests,
    totalConversions,
    membership: {
      active: activeMemberships,
      expired: expiredMemberships,
      suspended: suspendedMemberships,
      pendingPayments: pendingPaymentUsers,
      pendingSearchReviews,
      pendingApprovals,
    },
    averageConfidenceScore,
    reviewTurnaroundMinutes,
    topSearchedVehicles: topVehicleRows.map((row) => [row.key, Number(row.count)] as const),
    topMakeModels: topMakeModelRows.map((row) => [row.key, Number(row.count)] as const),
    topSearchedParts: topPartRows.map((row) => [row.key, Number(row.count)] as const),
    searchToSourcingConversionRate,
    sessionConversionRate,
    searchToAnyConversionRate,
    activationConversionRateFromUpsell,
    renewalConversions,
    membershipRevenueGhs,
    sessionTrend,
    conversionTrend,
    /** Per-day searches vs total conversion events (all types), same window as trends. */
    dailySearchVsConversions,
    dashboardUsagePatterns: {
      searchesPerUser: userCount > 0 ? Number((totalSearches / userCount).toFixed(2)) : 0,
      conversionsPerSearch:
        totalSearches > 0 ? Number((totalConversions / totalSearches).toFixed(2)) : 0,
    },
    reviewOps: {
      pendingReview: reviewStatusMap.get("PENDING_REVIEW") ?? 0,
      lowConfidence: reviewStatusMap.get("LOW_CONFIDENCE") ?? 0,
      verified: reviewStatusMap.get("VERIFIED") ?? 0,
      likely: reviewStatusMap.get("LIKELY") ?? 0,
      rejected: reviewStatusMap.get("REJECTED") ?? 0,
      approved: reviewStatusMap.get("APPROVED") ?? 0,
      flaggedSourcing: reviewStatusMap.get("FLAGGED_SOURCING") ?? 0,
    },
  };
}
