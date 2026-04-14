"use server";

import {
  DutyWorkflowStage,
  NotificationType,
  PaymentType,
  type PaymentSettlementMethod,
} from "@prisma/client";
import { nanoid } from "nanoid";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth-helpers";
import { computeDutyEstimate, dutyEstimateInputSchema } from "@/lib/duty/calculator";
import { DUTY_FORMULA_VERSION } from "@/lib/duty/formula-version";
import { dutyWorkflowLabel } from "@/lib/duty/workflow";
import { auditLog } from "@/lib/leads";
import { prisma } from "@/lib/prisma";

export type DutyAdminState = { ok?: boolean; error?: string };

const settlementEnum = z.enum([
  "MOBILE_MONEY",
  "BANK_GHS_COMPANY",
  "ALIPAY_RMB",
  "CASH_OFFICE_GHS",
  "CASH_OFFICE_USD",
]);

async function latestDutyForOrder(orderId: string) {
  return prisma.dutyRecord.findFirst({
    where: { orderId },
    orderBy: { updatedAt: "desc" },
  });
}

export async function ensureDutyCaseForOrderAction(
  _prev: DutyAdminState | null,
  formData: FormData,
): Promise<DutyAdminState> {
  try {
    const session = await requireAdmin();
    const orderId = z.string().cuid().safeParse(formData.get("orderId"));
    if (!orderId.success) return { error: "Invalid order." };

    const order = await prisma.order.findFirst({
      where: { id: orderId.data, kind: "CAR" },
      include: { shipments: { where: { kind: "CAR_SEA" }, take: 1, orderBy: { createdAt: "desc" } } },
    });
    if (!order) return { error: "Vehicle order not found." };

    const existing = await latestDutyForOrder(order.id);
    if (existing) {
      return { ok: true };
    }

    const shipmentId = order.shipments[0]?.id ?? null;
    await prisma.dutyRecord.create({
      data: {
        orderId: order.id,
        shipmentId,
        currency: "GHS",
        workflowStage: "NOT_STARTED",
      },
    });

    await auditLog(session.user.id, "duty.case.create", "DutyRecord", order.id, { orderId: order.id });
    revalidatePath("/admin/duty");
    revalidatePath(`/admin/orders/${order.id}`);
    revalidatePath(`/dashboard/orders/${order.id}`);
    return { ok: true };
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") return { error: "Admin only." };
    console.error("[ensureDutyCaseForOrderAction]", e);
    return { error: "Could not create duty case." };
  }
}

export async function saveDutyEstimateAction(_prev: DutyAdminState | null, formData: FormData): Promise<DutyAdminState> {
  try {
    const session = await requireAdmin();
    const dutyId = z.string().cuid().safeParse(formData.get("dutyId"));
    if (!dutyId.success) return { error: "Invalid duty record." };

    const parsed = dutyEstimateInputSchema.safeParse({
      cifGhs: Number(formData.get("cifGhs")),
      vehicleYear: Number(formData.get("vehicleYear")),
      engineCc: formData.get("engineCc") ? Number(formData.get("engineCc")) : undefined,
    });
    if (!parsed.success) return { error: "Invalid calculator inputs." };

    const estimate = computeDutyEstimate(parsed.data);
    const duty = await prisma.dutyRecord.findUnique({
      where: { id: dutyId.data },
      select: { id: true, orderId: true, workflowStage: true },
    });
    if (!duty) return { error: "Duty record not found." };

    const terminal: DutyWorkflowStage[] = [
      "DUTY_PAID",
      "CLEARANCE_IN_PROGRESS",
      "CLEARED",
      "DELIVERED_READY_FOR_PICKUP",
    ];
    const locked = terminal.includes(duty.workflowStage);

    await prisma.dutyRecord.update({
      where: { id: duty.id },
      data: {
        estimateJson: JSON.parse(JSON.stringify(estimate)) as object,
        estimateTotalGhs: estimate.totalGhs,
        formulaVersion: DUTY_FORMULA_VERSION,
        ...(locked
          ? {}
          : {
              workflowStage: "DUTY_ESTIMATE_GENERATED" as const,
              status: "DUTY_ESTIMATE_GENERATED",
              dutyAmount: estimate.totalGhs,
            }),
        updatedById: session.user.id,
      },
    });

    await auditLog(session.user.id, "duty.estimate.save", "DutyRecord", duty.id, { totalGhs: estimate.totalGhs });
    revalidatePath("/admin/duty");
    revalidatePath(`/dashboard/orders/${duty.orderId}`);
    return { ok: true };
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") return { error: "Admin only." };
    console.error("[saveDutyEstimateAction]", e);
    return { error: "Could not save estimate." };
  }
}

const stageSchema = z.nativeEnum(DutyWorkflowStage);

export async function updateDutyWorkflowStageAction(
  _prev: DutyAdminState | null,
  formData: FormData,
): Promise<DutyAdminState> {
  try {
    const session = await requireAdmin();
    const dutyId = z.string().cuid().safeParse(formData.get("dutyId"));
    if (!dutyId.success) return { error: "Invalid duty record." };
    const stageParsed = stageSchema.safeParse(formData.get("workflowStage"));
    if (!stageParsed.success) return { error: "Invalid stage." };

    const customerVisibleNote = z.string().max(8000).optional().safeParse(formData.get("customerVisibleNote") || undefined);
    if (!customerVisibleNote.success) return { error: "Customer note too long." };

    const duty = await prisma.dutyRecord.findUnique({
      where: { id: dutyId.data },
      include: { order: { select: { id: true, userId: true, reference: true } } },
    });
    if (!duty) return { error: "Duty record not found." };

    await prisma.dutyRecord.update({
      where: { id: duty.id },
      data: {
        workflowStage: stageParsed.data,
        status: stageParsed.data,
        customerVisibleNote: customerVisibleNote.data?.trim() || duty.customerVisibleNote,
        updatedById: session.user.id,
      },
    });

    if (duty.order.userId) {
      await prisma.notification.create({
        data: {
          userId: duty.order.userId,
          type: NotificationType.ORDER,
          title: "Import duty update",
          body:
            customerVisibleNote.data?.trim() ||
            `Duty status: ${dutyWorkflowLabel(stageParsed.data)} — order ${duty.order.reference}`,
          href: `/dashboard/orders/${duty.order.id}`,
        },
      });
    }

    await auditLog(session.user.id, "duty.workflow.update", "DutyRecord", duty.id, { stage: stageParsed.data });
    revalidatePath("/admin/duty");
    revalidatePath(`/dashboard/orders/${duty.orderId}`);
    return { ok: true };
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") return { error: "Admin only." };
    console.error("[updateDutyWorkflowStageAction]", e);
    return { error: "Could not update workflow." };
  }
}

export async function updateDutyNotesAction(_prev: DutyAdminState | null, formData: FormData): Promise<DutyAdminState> {
  try {
    const session = await requireAdmin();
    const dutyId = z.string().cuid().safeParse(formData.get("dutyId"));
    if (!dutyId.success) return { error: "Invalid duty record." };
    const customerVisibleNote = z.string().max(8000).optional().safeParse(formData.get("customerVisibleNote") || undefined);
    const internalNote = z.string().max(8000).optional().safeParse(formData.get("internalNote") || undefined);
    if (!customerVisibleNote.success || !internalNote.success) return { error: "Notes too long." };

    const duty = await prisma.dutyRecord.findUnique({ where: { id: dutyId.data }, include: { order: { select: { userId: true, id: true, reference: true } } } });
    if (!duty) return { error: "Duty record not found." };

    await prisma.dutyRecord.update({
      where: { id: duty.id },
      data: {
        customerVisibleNote: customerVisibleNote.data?.trim() ?? null,
        internalNote: internalNote.data?.trim() ?? null,
        updatedById: session.user.id,
      },
    });

    if (duty.order.userId && customerVisibleNote.data?.trim()) {
      await prisma.notification.create({
        data: {
          userId: duty.order.userId,
          type: NotificationType.ORDER,
          title: "Message about your import duty",
          body: customerVisibleNote.data.trim().slice(0, 500),
          href: `/dashboard/orders/${duty.order.id}`,
        },
      });
    }

    await auditLog(session.user.id, "duty.notes.update", "DutyRecord", duty.id, {});
    revalidatePath("/admin/duty");
    revalidatePath(`/dashboard/orders/${duty.orderId}`);
    return { ok: true };
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") return { error: "Admin only." };
    console.error("[updateDutyNotesAction]", e);
    return { error: "Could not save notes." };
  }
}

export async function setAssessedDutyGhsAction(_prev: DutyAdminState | null, formData: FormData): Promise<DutyAdminState> {
  try {
    const session = await requireAdmin();
    const dutyId = z.string().cuid().safeParse(formData.get("dutyId"));
    if (!dutyId.success) return { error: "Invalid duty record." };
    const amount = z.coerce.number().nonnegative().max(500_000_000).safeParse(formData.get("assessedDutyGhs"));
    if (!amount.success) return { error: "Invalid payable amount." };

    const duty = await prisma.dutyRecord.findUnique({ where: { id: dutyId.data } });
    if (!duty) return { error: "Duty record not found." };

    await prisma.dutyRecord.update({
      where: { id: duty.id },
      data: {
        assessedDutyGhs: amount.data,
        dutyAmount: amount.data,
        workflowStage: "DUTY_CONFIRMED",
        status: "DUTY_CONFIRMED",
        updatedById: session.user.id,
      },
    });

    await auditLog(session.user.id, "duty.assessed.set", "DutyRecord", duty.id, { assessedDutyGhs: amount.data });
    revalidatePath("/admin/duty");
    revalidatePath(`/dashboard/orders/${duty.orderId}`);
    return { ok: true };
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") return { error: "Admin only." };
    console.error("[setAssessedDutyGhsAction]", e);
    return { error: "Could not save payable duty." };
  }
}

export async function createDutyPaymentRequestAction(
  _prev: DutyAdminState | null,
  formData: FormData,
): Promise<DutyAdminState> {
  try {
    const session = await requireAdmin();
    const orderId = z.string().cuid().safeParse(formData.get("orderId"));
    if (!orderId.success) return { error: "Invalid order." };
    const settlementMethod = settlementEnum.safeParse(formData.get("settlementMethod"));
    if (!settlementMethod.success) return { error: "Invalid settlement method." };
    const amountParsed = z.coerce.number().positive().max(500_000_000).safeParse(formData.get("amountGhs"));
    if (!amountParsed.success) return { error: "Invalid amount." };

    const order = await prisma.order.findFirst({
      where: { id: orderId.data, kind: "CAR", userId: { not: null } },
      include: { user: { select: { id: true } } },
    });
    if (!order || !order.userId) return { error: "Order must be a vehicle order with a signed-in customer." };

    const ref = `SDA-DUTY-${nanoid(10).toUpperCase()}`;

    const newPaymentId = await prisma.$transaction(async (tx) => {
      const pay = await tx.payment.create({
        data: {
          orderId: order.id,
          userId: order.userId,
          provider: "MANUAL",
          settlementMethod: settlementMethod.data as PaymentSettlementMethod,
          providerReference: ref,
          amount: amountParsed.data,
          currency: order.currency,
          status: "AWAITING_PROOF",
          paymentType: PaymentType.DUTY,
          idempotencyKey: ref,
        },
      });
      await tx.paymentStatusHistory.create({
        data: {
          paymentId: pay.id,
          fromStatus: null,
          toStatus: "AWAITING_PROOF",
          source: "ADMIN_DUTY_PAYMENT",
          actorUserId: session.user.id,
          note: "Duty settlement — customer should upload proof from Payments.",
        },
      });

      const duty = await tx.dutyRecord.findFirst({
        where: { orderId: order.id },
        orderBy: { updatedAt: "desc" },
      });
      if (duty) {
        await tx.dutyRecord.update({
          where: { id: duty.id },
          data: {
            workflowStage: "DUTY_PAYMENT_IN_PROGRESS",
            status: "DUTY_PAYMENT_IN_PROGRESS",
            updatedById: session.user.id,
          },
        });
      }
      return pay.id;
    });

    await prisma.notification.create({
      data: {
        userId: order.userId,
        type: NotificationType.PAYMENT,
        title: "Import duty payment requested",
        body: `A duty payment of GHS ${amountParsed.data.toLocaleString()} was added. Open this payment to upload proof and complete settlement.`,
        href: `/dashboard/payments/${newPaymentId}`,
      },
    });

    await auditLog(session.user.id, "duty.payment.create", "Order", order.id, {
      amountGhs: amountParsed.data,
      paymentId: newPaymentId,
    });
    revalidatePath("/admin/duty");
    revalidatePath("/admin/payments/intelligence");
    revalidatePath(`/dashboard/orders/${order.id}`);
    revalidatePath("/dashboard/payments");
    revalidatePath(`/dashboard/payments/${newPaymentId}`);
    return { ok: true };
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") return { error: "Admin only." };
    console.error("[createDutyPaymentRequestAction]", e);
    return { error: "Could not create duty payment." };
  }
}
