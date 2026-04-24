import { EngineType, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export type VehicleImportEstimateRecord = {
  id: string;
  estimateNumber: string;
  status: "DRAFT" | "SENT" | "ACCEPTED" | "EXPIRED" | "SUPERSEDED";
  clientName: string;
  clientContact: string;
  vehicleName: string;
  engineType: EngineType | null;
  modelYear: number | null;
  vin: string | null;
  fob: number | null;
  freight: number | null;
  insurance: number | null;
  cif: number | null;
  estimatedDutyRangeMin: number | null;
  estimatedDutyRangeMax: number | null;
  estimatedLandedCost: number | null;
  importantNotice: string | null;
  preparedByName: string;
  customerId?: string | null;
  orderId?: string | null;
  inquiryId?: string | null;
  carId?: string | null;
  createdAt: Date;
  finalizedAt: Date | null;
  sentAt: Date | null;
};

export type VehicleImportEstimateEventRecord = {
  id: string;
  estimateId: string;
  status: VehicleImportEstimateRecord["status"];
  note: string | null;
  actorUserId: string | null;
  createdAt: Date;
  actorName: string | null;
  actorEmail: string | null;
};

export async function getVehicleImportEstimateById(id: string): Promise<VehicleImportEstimateRecord | null> {
  const rows = await prisma.$queryRaw<Array<VehicleImportEstimateRecord>>(
    Prisma.sql`SELECT * FROM "VehicleImportEstimate" WHERE "id" = ${id} LIMIT 1`,
  );
  return rows[0] ?? null;
}

export async function getVehicleImportEstimateEvents(estimateId: string): Promise<VehicleImportEstimateEventRecord[]> {
  return prisma.$queryRaw<Array<VehicleImportEstimateEventRecord>>`
    SELECT
      e."id",
      e."estimateId",
      e."status"::text AS "status",
      e."note",
      e."actorUserId",
      e."createdAt",
      u."name" AS "actorName",
      u."email" AS "actorEmail"
    FROM "VehicleImportEstimateEvent" e
    LEFT JOIN "User" u ON u."id" = e."actorUserId"
    WHERE e."estimateId" = ${estimateId}
    ORDER BY e."createdAt" DESC
  `;
}

export async function canUserAccessEstimate(estimateId: string, userId: string): Promise<boolean> {
  const rows = await prisma.$queryRaw<Array<{ allowed: number }>>(Prisma.sql`
    SELECT COUNT(*)::int AS "allowed"
    FROM "VehicleImportEstimate" e
    LEFT JOIN "Order" o ON o."id" = e."orderId"
    WHERE e."id" = ${estimateId} AND (e."customerId" = ${userId} OR o."userId" = ${userId})
  `);
  return (rows[0]?.allowed ?? 0) > 0;
}

export function formatEstimateMoney(amount: number | null | undefined): string {
  if (amount == null || !Number.isFinite(amount)) return "-";
  return new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency: "GHS",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}
