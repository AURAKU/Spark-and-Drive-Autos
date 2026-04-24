import { EngineType, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import type { VehicleImportEstimateStatusValue } from "@/lib/vehicle-import-estimate";

type EstimatePayload = {
  clientName: string;
  clientContact: string;
  vehicleName: string;
  engineType?: EngineType | null;
  modelYear?: number;
  vin?: string;
  fob?: number;
  freight?: number;
  insurance?: number;
  cif?: number;
  estimatedDutyRangeMin?: number;
  estimatedDutyRangeMax?: number;
  estimatedLandedCost?: number;
  importantNotice: string;
  preparedByName: string;
  customerId?: string;
  orderId?: string;
  inquiryId?: string;
  carId?: string;
};

export async function getEstimateStatusById(id: string): Promise<VehicleImportEstimateStatusValue | null> {
  const rows = await prisma.$queryRaw<Array<{ status: VehicleImportEstimateStatusValue }>>(
    Prisma.sql`SELECT "status"::text AS "status" FROM "VehicleImportEstimate" WHERE "id" = ${id} LIMIT 1`,
  );
  return rows[0]?.status ?? null;
}

export async function appendEstimateEvent(params: {
  estimateId: string;
  status: VehicleImportEstimateStatusValue;
  actorUserId: string;
  note?: string;
}) {
  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO "VehicleImportEstimateEvent" ("id","estimateId","status","note","actorUserId","createdAt")
    VALUES (gen_random_uuid()::text, ${params.estimateId}, ${params.status}::"VehicleImportEstimateStatus", ${params.note ?? null}, ${params.actorUserId}, NOW())
  `);
}

function sqlEngineType(value: EngineType | null | undefined) {
  if (value == null) return Prisma.sql`NULL`;
  return Prisma.sql`${value}::"EngineType"`;
}

export async function createEstimate(params: {
  estimateNumber: string;
  payload: EstimatePayload;
  createdByUserId: string;
}): Promise<string> {
  const eng = sqlEngineType(params.payload.engineType);
  const rows = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    INSERT INTO "VehicleImportEstimate" (
      "id","estimateNumber","status","clientName","clientContact","vehicleName","engineType","modelYear","vin",
      "fob","freight","insurance","cif","estimatedDutyRangeMin","estimatedDutyRangeMax","estimatedLandedCost",
      "importantNotice","preparedByName","preparedByUserId","customerId","orderId","inquiryId","carId","createdAt","updatedAt"
    ) VALUES (
      gen_random_uuid()::text, ${params.estimateNumber}, 'DRAFT',
      ${params.payload.clientName}, ${params.payload.clientContact}, ${params.payload.vehicleName}, ${eng}, ${params.payload.modelYear},
      ${params.payload.vin}, ${params.payload.fob}, ${params.payload.freight}, ${params.payload.insurance}, ${params.payload.cif},
      ${params.payload.estimatedDutyRangeMin}, ${params.payload.estimatedDutyRangeMax}, ${params.payload.estimatedLandedCost},
      ${params.payload.importantNotice}, ${params.payload.preparedByName}, ${params.createdByUserId}, ${params.payload.customerId},
      ${params.payload.orderId}, ${params.payload.inquiryId}, ${params.payload.carId}, NOW(), NOW()
    )
    RETURNING "id"
  `);
  const id = rows[0]?.id;
  if (!id) throw new Error("Failed to create estimate.");
  return id;
}

export async function updateEstimate(params: {
  estimateId: string;
  status: VehicleImportEstimateStatusValue;
  payload: EstimatePayload;
  actorUserId: string;
}) {
  const acceptedAt = params.status === "ACCEPTED" ? new Date() : null;
  const expiresAt = params.status === "EXPIRED" ? new Date() : null;
  const eng = sqlEngineType(params.payload.engineType);
  await prisma.$executeRaw(Prisma.sql`
    UPDATE "VehicleImportEstimate"
    SET
      "status" = ${params.status}::"VehicleImportEstimateStatus",
      "finalizedAt" = ${acceptedAt},
      "acceptedAt" = ${acceptedAt},
      "expiresAt" = ${expiresAt},
      "clientName" = ${params.payload.clientName},
      "clientContact" = ${params.payload.clientContact},
      "vehicleName" = ${params.payload.vehicleName},
      "engineType" = ${eng},
      "modelYear" = ${params.payload.modelYear},
      "vin" = ${params.payload.vin},
      "fob" = ${params.payload.fob},
      "freight" = ${params.payload.freight},
      "insurance" = ${params.payload.insurance},
      "cif" = ${params.payload.cif},
      "estimatedDutyRangeMin" = ${params.payload.estimatedDutyRangeMin},
      "estimatedDutyRangeMax" = ${params.payload.estimatedDutyRangeMax},
      "estimatedLandedCost" = ${params.payload.estimatedLandedCost},
      "importantNotice" = ${params.payload.importantNotice},
      "preparedByName" = ${params.payload.preparedByName},
      "preparedByUserId" = ${params.actorUserId},
      "customerId" = ${params.payload.customerId},
      "orderId" = ${params.payload.orderId},
      "inquiryId" = ${params.payload.inquiryId},
      "carId" = ${params.payload.carId},
      "updatedAt" = NOW()
    WHERE "id" = ${params.estimateId}
  `);
}

export async function cloneEstimate(params: {
  sourceId: string;
  estimateNumber: string;
  actorUserId: string;
}): Promise<string> {
  const rows = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    INSERT INTO "VehicleImportEstimate" (
      "id","estimateNumber","status","clientName","clientContact","vehicleName","engineType","modelYear","vin",
      "fob","freight","insurance","cif","estimatedDutyRangeMin","estimatedDutyRangeMax","estimatedLandedCost",
      "importantNotice","preparedByName","preparedByUserId","customerId","orderId","inquiryId","carId","createdAt","updatedAt"
    )
    SELECT
      gen_random_uuid()::text, ${params.estimateNumber}, 'DRAFT',
      "clientName","clientContact","vehicleName","engineType","modelYear","vin",
      "fob","freight","insurance","cif","estimatedDutyRangeMin","estimatedDutyRangeMax","estimatedLandedCost",
      "importantNotice","preparedByName",${params.actorUserId},"customerId","orderId","inquiryId","carId",NOW(),NOW()
    FROM "VehicleImportEstimate"
    WHERE "id" = ${params.sourceId}
    RETURNING "id"
  `);
  const id = rows[0]?.id;
  if (!id) throw new Error("Clone failed.");
  return id;
}

export async function markEstimateSent(params: { estimateId: string; actorUserId: string }) {
  await prisma.$executeRaw(Prisma.sql`
    UPDATE "VehicleImportEstimate"
    SET "sentAt" = NOW(), "sentByUserId" = ${params.actorUserId}, "status" = 'SENT', "updatedAt" = NOW()
    WHERE "id" = ${params.estimateId}
  `);
}
