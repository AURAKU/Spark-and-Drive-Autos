import { prisma } from "@/lib/prisma";

export type PartsFinderUserDashboardStats = {
  userSuccessfulActivations: number;
  userSearchSessions: number;
  latestPayment: {
    id: string;
    status: string;
    createdAt: string;
    providerReference: string;
    amount: number;
    currency: string;
  } | null;
};

export async function getPartsFinderUserDashboardStats(userId: string): Promise<PartsFinderUserDashboardStats> {
  const [userSuccessfulActivations, userSearchSessions, latest] = await Promise.all([
    prisma.payment.count({
      where: { userId, paymentType: "PARTS_FINDER_MEMBERSHIP", status: "SUCCESS" },
    }),
    prisma.partsFinderSearchSession.count({ where: { userId } }),
    prisma.payment.findFirst({
      where: { userId, paymentType: "PARTS_FINDER_MEMBERSHIP" },
      orderBy: { createdAt: "desc" },
      select: { id: true, status: true, createdAt: true, providerReference: true, amount: true, currency: true },
    }),
  ]);

  return {
    userSuccessfulActivations,
    userSearchSessions,
    latestPayment: latest
      ? {
          id: latest.id,
          status: latest.status,
          createdAt: latest.createdAt.toISOString(),
          providerReference: latest.providerReference ?? "",
          amount: Number(latest.amount),
          currency: latest.currency,
        }
      : null,
  };
}
