"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth-helpers";
import { auditLog } from "@/lib/leads";
import { prisma } from "@/lib/prisma";
import {
  VEHICLE_IMPORT_ESTIMATE_NOTICE,
  buildVehicleImportEstimateInput,
  buildEstimateNumber,
  deriveDutyEstimate,
  parseOptionalString,
  vehicleImportEstimateSchema,
  vehicleImportEstimateTransitionSchema,
} from "@/lib/vehicle-import-estimate";
import {
  appendEstimateEvent,
  cloneEstimate,
  createEstimate,
  getEstimateStatusById,
  markEstimateSent,
  updateEstimate,
} from "@/lib/vehicle-import-estimate/persistence";

const idSchema = z.string().cuid();
type EstimateStatus = "DRAFT" | "SENT" | "ACCEPTED" | "EXPIRED" | "SUPERSEDED";

function statusFromIntent(intent: string | undefined): EstimateStatus {
  if (intent === "sent") return "SENT";
  if (intent === "accepted") return "ACCEPTED";
  if (intent === "expired") return "EXPIRED";
  if (intent === "superseded") return "SUPERSEDED";
  return "DRAFT";
}

async function assertLinkIntegrity(payload: {
  customerId?: string;
  orderId?: string;
  inquiryId?: string;
  carId?: string;
}) {
  const [customerOk, orderOk, inquiryOk, carOk] = await Promise.all([
    payload.customerId ? prisma.user.count({ where: { id: payload.customerId } }) : Promise.resolve(1),
    payload.orderId ? prisma.order.count({ where: { id: payload.orderId } }) : Promise.resolve(1),
    payload.inquiryId ? prisma.inquiry.count({ where: { id: payload.inquiryId } }) : Promise.resolve(1),
    payload.carId ? prisma.car.count({ where: { id: payload.carId } }) : Promise.resolve(1),
  ]);

  if (customerOk < 1) throw new Error("Linked customer not found.");
  if (orderOk < 1) throw new Error("Linked order not found.");
  if (inquiryOk < 1) throw new Error("Linked inquiry not found.");
  if (carOk < 1) throw new Error("Linked vehicle not found.");
}

export async function createVehicleImportEstimateAction(formData: FormData) {
  const session = await requireAdmin();
  const intent = parseOptionalString(formData.get("intent"));

  const parsed = vehicleImportEstimateSchema.safeParse({
    ...buildVehicleImportEstimateInput(formData),
    clientName: parseOptionalString(formData.get("clientName")) ?? "Pending client",
    clientContact: parseOptionalString(formData.get("clientContact")) ?? "Pending contact",
    vehicleName: parseOptionalString(formData.get("vehicleName")) ?? "Pending vehicle",
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid estimate input.");
  const payload = parsed.data;
  await assertLinkIntegrity(payload);
  const dutyLogic = deriveDutyEstimate(payload);

  const estimateNumber = buildEstimateNumber();
  const createdId = await createEstimate({
    estimateNumber,
    createdByUserId: session.user.id,
    payload: {
      clientName: payload.clientName,
      clientContact: payload.clientContact,
      vehicleName: payload.vehicleName,
      engineType: payload.engineType ?? null,
      modelYear: payload.modelYear,
      vin: payload.vin,
      fob: payload.fob,
      freight: payload.freight,
      insurance: payload.insurance,
      cif: dutyLogic.cif,
      estimatedDutyRangeMin: dutyLogic.estimatedDutyRangeMin,
      estimatedDutyRangeMax: dutyLogic.estimatedDutyRangeMax,
      estimatedLandedCost: dutyLogic.estimatedLandedCost,
      importantNotice: VEHICLE_IMPORT_ESTIMATE_NOTICE,
      preparedByName: "Spark and Drive Autos",
      customerId: payload.customerId,
      orderId: payload.orderId,
      inquiryId: payload.inquiryId,
      carId: payload.carId,
    },
  });

  const createStatus: EstimateStatus = intent === "sent" ? "SENT" : "DRAFT";
  if (createStatus === "SENT") {
    await markEstimateSent({ estimateId: createdId, actorUserId: session.user.id });
  }

  await auditLog(session.user.id, "vehicle-import-estimate.create", "VehicleImportEstimate", createdId, {
    estimateNumber,
    intent: intent ?? "draft",
    status: createStatus,
  });
  await appendEstimateEvent({
    estimateId: createdId,
    status: createStatus,
    actorUserId: session.user.id,
    note: `Estimate created (${dutyLogic.mode} duty mode)`,
  });

  revalidatePath("/admin/duty-estimator");
  revalidatePath("/admin/estimates");
  if (intent === "preview") redirect(`/admin/estimates/${createdId}`);
  if (intent === "sent") redirect(`/admin/estimates/${createdId}/edit?sent=1`);
  redirect(`/admin/estimates/${createdId}/edit`);
}

export async function updateVehicleImportEstimateAction(formData: FormData) {
  const session = await requireAdmin();
  const idParsed = idSchema.safeParse(formData.get("id"));
  if (!idParsed.success) {
    throw new Error("Invalid estimate id.");
  }

  const intent = parseOptionalString(formData.get("intent"));
  const nextStatus = statusFromIntent(intent);
  const parsed = vehicleImportEstimateSchema.safeParse(buildVehicleImportEstimateInput(formData));
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid estimate input.");
  const payload = parsed.data;
  await assertLinkIntegrity(payload);
  const dutyLogic = deriveDutyEstimate(payload);
  const importantNotice = payload.importantNotice ?? VEHICLE_IMPORT_ESTIMATE_NOTICE;
  const preparedByName = payload.preparedByName ?? "Spark and Drive Autos";
  const currentStatus = await getEstimateStatusById(idParsed.data);
  if (!currentStatus) throw new Error("Estimate not found.");
  const transition = vehicleImportEstimateTransitionSchema.safeParse({ from: currentStatus, to: nextStatus });
  if (!transition.success) throw new Error(transition.error.issues[0]?.message ?? "Invalid status transition.");

  await updateEstimate({
    estimateId: idParsed.data,
    status: nextStatus,
    actorUserId: session.user.id,
    payload: {
      clientName: payload.clientName,
      clientContact: payload.clientContact,
      vehicleName: payload.vehicleName,
      engineType: payload.engineType ?? null,
      modelYear: payload.modelYear,
      vin: payload.vin,
      fob: payload.fob,
      freight: payload.freight,
      insurance: payload.insurance,
      cif: dutyLogic.cif,
      estimatedDutyRangeMin: dutyLogic.estimatedDutyRangeMin,
      estimatedDutyRangeMax: dutyLogic.estimatedDutyRangeMax,
      estimatedLandedCost: dutyLogic.estimatedLandedCost,
      importantNotice,
      preparedByName,
      customerId: payload.customerId,
      orderId: payload.orderId,
      inquiryId: payload.inquiryId,
      carId: payload.carId,
    },
  });

  await auditLog(session.user.id, "vehicle-import-estimate.update", "VehicleImportEstimate", idParsed.data, {
    intent: intent ?? "draft",
    status: nextStatus,
  });
  await appendEstimateEvent({
    estimateId: idParsed.data,
    status: nextStatus,
    actorUserId: session.user.id,
    note: `Status set via editor intent: ${intent ?? "draft"} · ${dutyLogic.mode} mode · ${dutyLogic.uncertaintyNote}`,
  });

  revalidatePath("/admin/duty-estimator");
  revalidatePath(`/admin/duty-estimator/${idParsed.data}`);
  revalidatePath("/admin/estimates");
  revalidatePath(`/admin/estimates/${idParsed.data}/edit`);
  redirect(`/admin/estimates/${idParsed.data}/edit?saved=1`);
}

export async function cloneVehicleImportEstimateAction(formData: FormData) {
  const session = await requireAdmin();
  const idParsed = idSchema.safeParse(formData.get("id"));
  if (!idParsed.success) throw new Error("Invalid estimate id.");

  const estimateNumber = buildEstimateNumber();
  const clonedId = await cloneEstimate({
    sourceId: idParsed.data,
    estimateNumber,
    actorUserId: session.user.id,
  });

  await auditLog(session.user.id, "vehicle-import-estimate.clone", "VehicleImportEstimate", clonedId, {
    sourceId: idParsed.data,
    estimateNumber,
  });
  await appendEstimateEvent({
    estimateId: clonedId,
    status: "DRAFT",
    actorUserId: session.user.id,
    note: `Cloned from estimate ${idParsed.data}`,
  });

  revalidatePath("/admin/duty-estimator");
  redirect(`/admin/duty-estimator/${clonedId}`);
}

export async function markVehicleImportEstimateSentAction(formData: FormData) {
  const session = await requireAdmin();
  const idParsed = idSchema.safeParse(formData.get("id"));
  if (!idParsed.success) throw new Error("Invalid estimate id.");

  const currentStatus = await getEstimateStatusById(idParsed.data);
  if (!currentStatus) throw new Error("Estimate not found.");
  const transition = vehicleImportEstimateTransitionSchema.safeParse({ from: currentStatus, to: "SENT" });
  if (!transition.success) throw new Error(transition.error.issues[0]?.message ?? "Invalid status transition.");

  await markEstimateSent({ estimateId: idParsed.data, actorUserId: session.user.id });
  await appendEstimateEvent({
    estimateId: idParsed.data,
    status: "SENT",
    actorUserId: session.user.id,
    note: "Marked as sent",
  });

  await auditLog(session.user.id, "vehicle-import-estimate.mark-sent", "VehicleImportEstimate", idParsed.data, {});
  revalidatePath(`/admin/duty-estimator/${idParsed.data}`);
  revalidatePath("/admin/duty-estimator");
  revalidatePath(`/admin/estimates/${idParsed.data}/edit`);
  redirect(`/admin/estimates/${idParsed.data}/edit?sent=1`);
}
