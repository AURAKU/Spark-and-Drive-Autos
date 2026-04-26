import { PaymentSettlementMethod, ReceiptStatus, ReceiptType, type Prisma } from "@prisma/client";

import { writeAuditLog } from "@/lib/audit";
import { buildReceiptPdf, makeCarReceiptLines, makePartsReceiptLines, persistReceiptPdf } from "@/lib/receipt-engine";
import { getActiveReceiptTemplate } from "@/lib/receipt-template";

function receiptTypePrefix(type: ReceiptType): string {
  switch (type) {
    case "CAR_PAYMENT":
      return "SDA-CAR";
    case "PARTS_PAYMENT":
      return "SDA-PRT";
    case "PARTS_FINDER_ACTIVATION":
      return "SDA-PF";
    case "SOURCING_DEPOSIT":
      return "SDA-SRC";
    case "WALLET_TOPUP":
      return "SDA-WAL";
    case "MANUAL_PAYMENT":
      return "SDA-MAN";
    case "VERIFIED_PART_REQUEST":
      return "SDA-VPR";
    default:
      return "SDA-RCP";
  }
}

async function nextReceiptNumber(type: ReceiptType, tx: Prisma.TransactionClient): Promise<string> {
  const now = new Date();
  const ymd = now.toISOString().slice(0, 10).replaceAll("-", "");
  const prefix = `${receiptTypePrefix(type)}-${ymd}`;
  const count = await tx.generatedReceipt.count({
    where: {
      type,
      issuedAt: {
        gte: new Date(`${now.toISOString().slice(0, 10)}T00:00:00.000Z`),
        lte: new Date(`${now.toISOString().slice(0, 10)}T23:59:59.999Z`),
      },
    },
  });
  return `${prefix}-${String(count + 1).padStart(4, "0")}`;
}

function inferReceiptType(payment: {
  paymentType: string;
  order: { kind: string } | null;
  settlementMethod: PaymentSettlementMethod;
}): ReceiptType {
  if (payment.settlementMethod !== "PAYSTACK") return "MANUAL_PAYMENT";
  if (payment.order?.kind === "CAR") {
    if (payment.paymentType === "RESERVATION_DEPOSIT") return "SOURCING_DEPOSIT";
    return "CAR_PAYMENT";
  }
  if (payment.order?.kind === "PARTS") return "PARTS_PAYMENT";
  if (payment.paymentType === "VERIFIED_PART_REQUEST") return "VERIFIED_PART_REQUEST";
  return "WALLET_TOPUP";
}

export async function issueReceiptForSuccessfulPayment(
  paymentId: string,
  tx: Prisma.TransactionClient,
): Promise<void> {
  const payment = await tx.payment.findUnique({
    where: { id: paymentId },
    include: {
      user: { select: { id: true, name: true, email: true } },
      order: {
        include: {
          car: { select: { title: true } },
          partItems: { select: { titleSnapshot: true, quantity: true, lineTotal: true } },
        },
      },
      generatedReceipts: {
        where: { status: { in: [ReceiptStatus.ISSUED, ReceiptStatus.REGENERATED] } },
        select: { id: true },
        take: 1,
      },
    },
  });
  if (!payment || payment.status !== "SUCCESS") return;
  if (payment.generatedReceipts.length > 0) return;
  if (!payment.userId) return;

  const type = inferReceiptType(payment);
  const template = await getActiveReceiptTemplate(type);
  const receiptNumber = await nextReceiptNumber(type, tx);
  const lines =
    payment.order?.kind === "CAR" && payment.order.car
      ? makeCarReceiptLines({
          carTitle: payment.order.car.title,
          totalCarCostGhs: Number(payment.order.amount),
          depositPaidGhs: Number(payment.amount),
          outstandingBalanceGhs: Math.max(0, Number(payment.order.amount) - Number(payment.amount)),
          paymentStatusLabel: "Confirmed",
        })
      : payment.order?.kind === "PARTS"
        ? makePartsReceiptLines({
            orderReference: payment.order.reference,
            items: payment.order.partItems.map((x) => ({
              title: x.titleSnapshot,
              quantity: x.quantity,
              total: Number(x.lineTotal),
            })),
            totalPaidGhs: Number(payment.amount),
            paymentStatusLabel: "Confirmed",
          })
        : [
            { label: "Payment Reference", value: payment.providerReference ?? payment.id },
            { label: "Payment Type", value: payment.paymentType.replaceAll("_", " ") },
            { label: "Amount", value: `${Number(payment.amount).toLocaleString("en-GH")} ${payment.currency}` },
            { label: "Status", value: "Confirmed" },
          ];

  const { pdfBytes, templateData } = await buildReceiptPdf({
    scope: type,
    receiptReference: receiptNumber,
    customerName: payment.user?.name ?? payment.user?.email ?? "Customer",
    lines,
    generatedAt: payment.paidAt ?? new Date(),
  });
  const pdfUrl = await persistReceiptPdf(receiptNumber, pdfBytes);

  const created = await tx.generatedReceipt.create({
    data: {
      receiptNumber,
      type,
      paymentId: payment.id,
      orderId: payment.orderId,
      userId: payment.userId,
      amount: payment.amount,
      currency: payment.currency,
      paymentMethod: payment.settlementMethod,
      paymentReference: payment.providerReference,
      templateId: template.id,
      templateSnapshot: templateData,
      pdfUrl,
      status: "ISSUED",
      issuedAt: payment.paidAt ?? new Date(),
      generatedById: null,
    },
  });
  await tx.payment.update({
    where: { id: payment.id },
    data: {
      receiptData: templateData,
    },
  });
  if (payment.orderId) {
    await tx.order.update({
      where: { id: payment.orderId },
      data: {
        receiptData: templateData,
        receiptReference: receiptNumber,
        receiptPdfUrl: pdfUrl,
      },
    });
  }
  await tx.receiptAuditLog.create({
    data: {
      receiptId: created.id,
      templateId: template.id,
      actorId: null,
      action: "RECEIPT_GENERATED",
      metadata: { paymentId: payment.id, orderId: payment.orderId, receiptNumber, type },
    },
  });
  await writeAuditLog(
    {
      actorId: null,
      action: "RECEIPT_GENERATED",
      entityType: "GeneratedReceipt",
      entityId: created.id,
      metadataJson: { paymentId: payment.id, orderId: payment.orderId, receiptNumber, type },
    },
    tx,
  );
}
