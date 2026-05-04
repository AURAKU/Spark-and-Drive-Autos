import {
  NotificationType,
  OrderBalanceStatus,
  OrderStatus,
  PaymentProvider,
  PaymentStatus,
  PaymentType,
  ReceiptType,
  type Prisma,
} from "@prisma/client";
import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { hasPaymentSuccessEvidence } from "@/lib/legal-payment-evidence";
import { invalidateOpsRouteCacheTags } from "@/lib/ops-route-cache-tags";
import { createReceiptReference, generateAndPersistOrderReceiptPdf, makeCarReceiptLines } from "@/lib/receipt-engine";
import { issueReceiptForSuccessfulPayment } from "@/lib/receipt-service";
import { writeAuditLog } from "@/lib/audit";
import { canUploadPaymentProof } from "@/lib/payment-status-utils";
import { syncDutyWorkflowAfterDutyPaymentSuccessInTx } from "@/lib/duty/sync-from-payment";
import { ensureCarSeaShipmentInTx } from "@/lib/shipping/shipment-service";
import { syncCarInventoryAfterSuccessfulVehiclePayment } from "@/lib/sold-vehicle";
import {
  addDays,
  BALANCE_DUE_WINDOW_DAYS,
  deriveBalanceStatus,
  shouldFlagFollowUpForOverdue,
} from "@/lib/deposit-balance-logic";

export { canUploadPaymentProof, PAYMENT_FINAL_STATUSES } from "@/lib/payment-status-utils";

type TransitionOpts = {
  toStatus: PaymentStatus;
  source: string;
  actorUserId?: string | null;
  note?: string | null;
  paidAt?: Date | null;
  receiptData?: Prisma.InputJsonValue;
  /** When admin confirms — stored on Payment */
  review?: { reviewedById: string; reviewedAt: Date };
};

/**
 * Single entry point for payment status changes (webhook, checkout return, admin, proof flow).
 * Idempotent when already at `toStatus` for SUCCESS path (skips duplicate side effects).
 */
export async function transitionPaymentStatus(paymentId: string, opts: TransitionOpts): Promise<void> {
  if (opts.toStatus === "SUCCESS" && opts.source !== "WEBHOOK") {
    const hasEvidence = await hasPaymentSuccessEvidence(paymentId);
    if (!hasEvidence && !opts.review?.reviewedById) {
      throw new Error("PAYMENT_SUCCESS_REQUIRES_VERIFIED_EVIDENCE");
    }
  }
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      order: {
        select: {
          id: true,
          kind: true,
          reference: true,
          receiptReference: true,
          amount: true,
          remainingBalance: true,
          car: { select: { seaShippingFeeGhs: true, estimatedDelivery: true, title: true, slug: true } },
        },
      },
    },
  });
  if (!payment) return;

  const fromStatus = payment.status;
  if (fromStatus === opts.toStatus && opts.toStatus === "SUCCESS") {
    if (payment.orderId) {
      await syncCarOrderReceiptPdf(payment.orderId);
    }
    await syncCarInventoryAfterSuccessfulVehiclePayment(paymentId);
    revalidatePaymentPaths(paymentId, payment.userId);
    if (payment.orderId) void revalidatePathsForOrder(payment.orderId);
    return;
  }
  if (fromStatus === opts.toStatus && opts.toStatus !== "SUCCESS") {
    return;
  }

  const paidAtResolved =
    opts.toStatus === "SUCCESS"
      ? (opts.paidAt ?? new Date())
      : opts.paidAt !== undefined
        ? opts.paidAt
        : undefined;

  const data: Prisma.PaymentUpdateInput = {
    status: opts.toStatus,
    ...(paidAtResolved !== undefined ? { paidAt: paidAtResolved } : {}),
    ...(opts.receiptData !== undefined ? { receiptData: opts.receiptData } : {}),
    ...(opts.review
      ? { reviewedById: opts.review.reviewedById, reviewedAt: opts.review.reviewedAt }
      : {}),
  };

  await prisma.$transaction(async (tx) => {
    await tx.payment.update({
      where: { id: paymentId },
      data,
    });
    await tx.paymentStatusHistory.create({
      data: {
        paymentId,
        fromStatus,
        toStatus: opts.toStatus,
        note: opts.note ?? null,
        source: opts.source,
        actorUserId: opts.actorUserId ?? null,
      },
    });
    if (opts.toStatus === "SUCCESS" && payment.orderId) {
      const ord = payment.order;
      const isCarDeposit =
        payment.paymentType === PaymentType.RESERVATION_DEPOSIT && ord?.kind === "CAR";
      const isCarFull = payment.paymentType === PaymentType.FULL && ord?.kind === "CAR";

      if (isCarDeposit) {
        const paidAt = paidAtResolved ?? new Date();
        const balanceDueAt = addDays(paidAt, BALANCE_DUE_WINDOW_DAYS);
        const rem = ord?.remainingBalance != null ? Number(ord.remainingBalance) : 0;
        const bs = deriveBalanceStatus(rem, balanceDueAt, paidAt);
        await tx.order.update({
          where: { id: payment.orderId },
          data: {
            orderStatus: OrderStatus.RESERVED_WITH_DEPOSIT,
            receiptReference: payment.order?.receiptReference ?? createReceiptReference("SDA-CAR-RCP"),
            depositAmount: Number(payment.amount),
            balanceDueAt,
            balanceStatus: bs,
            followUpRequired: shouldFlagFollowUpForOverdue(bs, rem),
          },
        });
      } else {
        const carFullBalancePatch =
          ord?.kind === "CAR" && payment.paymentType === PaymentType.FULL
            ? {
                remainingBalance: 0,
                balanceStatus: OrderBalanceStatus.PAID,
                balanceDueAt: null,
                followUpRequired: false,
                vehicleListPriceGhs: ord.amount != null ? Number(ord.amount) : undefined,
              }
            : {};
        await tx.order.update({
          where: { id: payment.orderId },
          data: {
            orderStatus: OrderStatus.PAID,
            receiptReference: payment.order?.receiptReference ?? createReceiptReference("SDA-CAR-RCP"),
            ...carFullBalancePatch,
          },
        });
        if (isCarFull && payment.userId && ord) {
          await ensureCarSeaShipmentInTx(tx, {
            orderId: ord.id,
            userId: payment.userId,
            orderReference: ord.reference,
            feeGhs: ord.car?.seaShippingFeeGhs != null ? Number(ord.car.seaShippingFeeGhs) : null,
            estimatedDuration: ord.car?.estimatedDelivery ?? null,
          });
        }
      }
      if (payment.paymentType === "DUTY" && payment.orderId && payment.order?.kind === "CAR") {
        await syncDutyWorkflowAfterDutyPaymentSuccessInTx(tx, payment.orderId);
      }
    }
    if (opts.toStatus === "SUCCESS") {
      await issueReceiptForSuccessfulPayment(paymentId, tx);
    }
    await tx.paymentVerification.upsert({
      where: { paymentId },
      create: {
        paymentId,
        verified: opts.toStatus === "SUCCESS",
        verificationSource: opts.source,
        verifiedById: opts.review?.reviewedById ?? opts.actorUserId ?? null,
        verifiedAt: opts.toStatus === "SUCCESS" ? (opts.paidAt ?? new Date()) : null,
      },
      update: {
        verified: opts.toStatus === "SUCCESS",
        verificationSource: opts.source,
        verifiedById: opts.review?.reviewedById ?? opts.actorUserId ?? null,
        verifiedAt: opts.toStatus === "SUCCESS" ? (opts.paidAt ?? new Date()) : null,
      },
    });
    await writeAuditLog(
      {
        actorId: opts.actorUserId ?? null,
        action: "PAYMENT_STATUS_TRANSITION",
        entityType: "Payment",
        entityId: paymentId,
        metadataJson: {
          fromStatus,
          toStatus: opts.toStatus,
          source: opts.source,
          orderId: payment.orderId,
          note: opts.note ?? null,
        },
      },
      tx,
    );
    if (payment.orderId && fromStatus !== opts.toStatus) {
      await writeAuditLog(
        {
          actorId: opts.actorUserId ?? null,
          action: "ORDER_STATUS_REVIEW",
          entityType: "Order",
          entityId: payment.orderId,
          metadataJson: {
            paymentId,
            paymentFrom: fromStatus,
            paymentTo: opts.toStatus,
          },
        },
        tx,
      );
    }
  });

  if (opts.toStatus === "SUCCESS") {
    try {
      if (payment.orderId) {
        await syncCarOrderReceiptPdf(payment.orderId);
      }
      await syncCarInventoryAfterSuccessfulVehiclePayment(paymentId);
    } catch (e) {
      console.error("[transitionPaymentStatus] syncCarInventory", e);
    }
  }

  if (payment.userId) {
    let title = paymentStatusNotificationTitle(opts.toStatus);
    let body = opts.note ?? `Your payment ${payment.providerReference ?? paymentId.slice(0, 8)} was updated.`;
    let notificationHref = `/dashboard/payments/${paymentId}`;
    if (
      opts.toStatus === "SUCCESS" &&
      payment.order?.kind === "CAR" &&
      (payment.paymentType === PaymentType.FULL || payment.paymentType === PaymentType.RESERVATION_DEPOSIT)
    ) {
      const vehicleLabel = payment.order.car?.title ?? "your vehicle";
      if (payment.paymentType === PaymentType.RESERVATION_DEPOSIT) {
        title = "Reservation confirmed";
        body = `Your deposit for ${vehicleLabel} is confirmed. This vehicle is now reserved for you while you complete your purchase—follow the next steps on your order. Need help or a similar model? Contact our support team for details.`;
      } else if (payment.paymentType === PaymentType.FULL) {
        title = "Vehicle fully paid";
        body = `Your payment for ${vehicleLabel} is confirmed; the vehicle is recorded as fully paid. Thank you. Interested in another unit? Contact support to arrange similar options.`;
      }
      if (payment.provider === PaymentProvider.MANUAL && payment.orderId) {
        body += ` Your official purchase receipt is ready—open your order to confirm the details and download your PDF receipt.`;
        notificationHref = `/dashboard/orders/${payment.orderId}`;
      }
    }
    await prisma.notification.create({
      data: {
        userId: payment.userId,
        type: NotificationType.PAYMENT,
        title,
        body,
        href: notificationHref,
      },
    });
  }

  revalidatePaymentPaths(paymentId, payment.userId);
  if (payment.orderId) {
    void revalidatePathsForOrder(payment.orderId);
  }
}

async function syncCarOrderReceiptPdf(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      user: { select: { name: true } },
      car: { select: { title: true } },
      payments: {
        where: { status: "SUCCESS" },
        orderBy: { paidAt: "desc" },
        select: { amount: true, paymentType: true },
      },
    },
  });
  if (!order || order.kind !== "CAR" || !order.car) return;
  const last = order.payments[0];
  if (!last) return;

  const totalPaid = order.payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const totalCost = Number(order.amount);
  const outstanding = Math.max(0, totalCost - totalPaid);
  const lines = makeCarReceiptLines({
    carTitle: order.car.title,
    totalCarCostGhs: totalCost,
    depositPaidGhs: totalPaid,
    outstandingBalanceGhs: outstanding,
    paymentStatusLabel: outstanding <= 0 ? "Fully Paid" : "Deposit / Part Payment",
  });
  const { receiptPdfUrl, templateData, receiptReference } = await generateAndPersistOrderReceiptPdf({
    scope: ReceiptType.CAR_PAYMENT,
    order,
    customerName: order.user?.name,
    lines,
  });

  await prisma.order.update({
    where: { id: order.id },
    data: {
      receiptReference: receiptReference,
      receiptPdfUrl,
      receiptData: {
        ...(templateData as object),
        receiptType: "CAR",
        reference: order.reference,
        totalCarCostGhs: totalCost,
        totalPaidGhs: totalPaid,
        outstandingBalanceGhs: outstanding,
        paymentType: last.paymentType,
      } as Prisma.InputJsonValue,
    },
  });
}

function paymentStatusNotificationTitle(status: PaymentStatus): string {
  switch (status) {
    case "SUCCESS":
      return "Payment confirmed";
    case "FAILED":
      return "Payment update";
    case "PROCESSING":
      return "Payment under review";
    case "UNDER_REVIEW":
      return "Payment under legal review";
    case "DISPUTED":
      return "Payment disputed";
    case "REFUNDED":
      return "Payment refunded";
    case "REVERSED":
      return "Payment reversed";
    case "AWAITING_PROOF":
      return "Action needed: payment proof";
    default:
      return "Payment status updated";
  }
}

function revalidatePaymentPaths(paymentId: string, userId: string | null) {
  revalidatePath("/dashboard/payments");
  revalidatePath(`/dashboard/payments/${paymentId}`);
  revalidatePath("/dashboard/orders");
  revalidatePath("/admin/payments");
  revalidatePath("/admin/payments/intelligence");
  revalidatePath(`/admin/payments/${paymentId}`);
  revalidatePath("/admin/orders");
  if (userId) {
    revalidatePath("/dashboard/notifications");
  }
  invalidateOpsRouteCacheTags();
}

/** Call when order id is known (e.g. after loading payment). */
export async function revalidatePathsForOrder(orderId: string | null) {
  if (!orderId) return;
  revalidatePath(`/dashboard/orders/${orderId}`);
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin/duty");
  invalidateOpsRouteCacheTags();
}

/**
 * After a user attaches a proof image; moves PENDING / AWAITING_PROOF → PROCESSING when applicable.
 */
export async function recordPaymentProofSubmission(paymentId: string, userId: string): Promise<void> {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment || payment.userId !== userId) {
    throw new Error("FORBIDDEN");
  }
  if (!canUploadPaymentProof(payment.status)) {
    throw new Error("INVALID_STATUS");
  }

  const prev = payment.status;
  const next: PaymentStatus =
    prev === "PENDING" || prev === "AWAITING_PROOF" ? "PROCESSING" : prev;

  await prisma.$transaction(async (tx) => {
    if (next !== prev) {
      await tx.payment.update({ where: { id: paymentId }, data: { status: next } });
    }
    await tx.paymentStatusHistory.create({
      data: {
        paymentId,
        fromStatus: prev,
        toStatus: next,
        source: "USER_PROOF",
        actorUserId: userId,
        note:
          next !== prev
            ? "Payment screenshot submitted — under review"
            : "Additional payment screenshot uploaded",
      },
    });
  });

  if (payment.userId) {
    await prisma.notification.create({
      data: {
        userId: payment.userId,
        type: NotificationType.PAYMENT,
        title: "Payment proof received",
        body:
          next !== prev
            ? "We received your payment proof. Our team will review and confirm it—once approved, your purchase is finalized and your receipt will be available on your order."
            : "An additional screenshot was added to your payment record.",
        href: `/dashboard/payments/${paymentId}`,
      },
    });
  }

  revalidatePaymentPaths(paymentId, payment.userId);
  if (payment.orderId) {
    void revalidatePathsForOrder(payment.orderId);
  }
}

export async function appendPaymentHistoryOnly(
  paymentId: string,
  entry: {
    fromStatus: PaymentStatus | null;
    toStatus: PaymentStatus;
    source: string;
    actorUserId?: string | null;
    note?: string | null;
  },
): Promise<void> {
  await prisma.paymentStatusHistory.create({
    data: {
      paymentId,
      fromStatus: entry.fromStatus,
      toStatus: entry.toStatus,
      note: entry.note ?? null,
      source: entry.source,
      actorUserId: entry.actorUserId ?? null,
    },
  });
  revalidatePath("/dashboard/payments");
  revalidatePath(`/dashboard/payments/${paymentId}`);
  revalidatePath("/admin/payments");
  revalidatePath("/admin/payments/intelligence");
  revalidatePath(`/admin/payments/${paymentId}`);
  invalidateOpsRouteCacheTags();
}
