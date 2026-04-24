import { prisma } from "@/lib/prisma";

export async function listRecentPartsFinderIntelligence(limit = 20) {
  return prisma.auditLog.findMany({
    where: { action: { startsWith: "parts_finder." } },
    orderBy: { createdAt: "desc" },
    take: Math.min(Math.max(1, limit), 100),
  });
}
