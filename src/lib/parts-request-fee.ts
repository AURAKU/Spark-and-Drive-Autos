import { MessageSenderType, Prisma } from "@prisma/client";
import { randomUUID } from "crypto";

import { ensureLead } from "@/lib/leads";
import { prisma } from "@/lib/prisma";
import { sanitizePlainText } from "@/lib/sanitize";

export const PARTS_REQUEST_FEE_KIND = "PARTS_REQUEST_FEE";

export async function getPartsRequestFeeSettings() {
  const existing = await prisma.partsRequestFeeSettings.findUnique({ where: { id: "default" } });
  if (existing) return existing;
  return prisma.partsRequestFeeSettings.create({
    data: { id: "default", enabled: true, feeAmount: new Prisma.Decimal(30), currency: "GHS" },
  });
}

export function partsRequestMessage(input: {
  summaryTitle: string | null;
  description: string;
  vehicleMake: string | null;
  vehicleModel: string | null;
  vehicleYear: number | null;
  partNumber: string | null;
  quantity: number;
  urgency: string | null;
  deliveryCity: string | null;
  feeGhs: number;
}) {
  const lines = [
    input.summaryTitle ? `Title: ${input.summaryTitle}` : "Parts request",
    input.description,
    [input.vehicleMake, input.vehicleModel, input.vehicleYear].filter(Boolean).join(" "),
    input.partNumber ? `OEM / part number: ${input.partNumber}` : null,
    `Quantity: ${input.quantity}`,
    input.urgency ? `Timing: ${input.urgency}` : null,
    input.deliveryCity ? `City: ${input.deliveryCity}` : null,
    `Request fee paid: GHS ${input.feeGhs.toFixed(2)}`,
  ].filter((line): line is string => Boolean(line && line.trim()));
  return lines.join("\n");
}

/** Opens the account message and marks the request received. Safe to call more than once. */
export async function fulfillPaidPartsRequest(paymentId: string) {
  const request = await prisma.partSourcingRequest.findUnique({ where: { paymentId } });
  if (!request || request.paymentState === "PAID") return request;

  const lead = request.userId
    ? await ensureLead({
        customerId: request.userId,
        sourceChannel: "PARTS_SOURCING_REQUEST",
        title: "Parts / accessories sourcing",
      })
    : null;

  const body = partsRequestMessage({
    summaryTitle: request.summaryTitle,
    description: request.description,
    vehicleMake: request.vehicleMake,
    vehicleModel: request.vehicleModel,
    vehicleYear: request.vehicleYear,
    partNumber: request.partNumber,
    quantity: request.quantity,
    urgency: request.urgency,
    deliveryCity: request.deliveryCity,
    feeGhs: Number(request.feeGhs),
  });

  return prisma.$transaction(async (tx) => {
    const current = await tx.partSourcingRequest.findUnique({ where: { id: request.id } });
    if (!current || current.paymentState === "PAID") return current;

    const existingGuestThread = current.userId
      ? null
      : current.guestToken
        ? await tx.chatThread.findUnique({ where: { guestToken: current.guestToken } })
        : null;
    const thread =
      existingGuestThread ??
      (await tx.chatThread.create({
        data: {
          customerId: current.userId,
          guestToken: current.userId ? null : current.guestToken ?? `gst_${randomUUID().replaceAll("-", "")}`,
          guestName: current.guestName,
          guestEmail: current.guestEmail,
          leadId: lead?.id ?? current.leadId,
          subject: current.summaryTitle?.trim() || "Parts request",
          lastMessageAt: new Date(),
          unreadForAdmin: 1,
        },
      }));
    if (existingGuestThread) {
      await tx.chatThread.update({
        where: { id: existingGuestThread.id },
        data: { lastMessageAt: new Date(), unreadForAdmin: { increment: 1 }, status: "OPEN" },
      });
    }
    await tx.message.create({
      data: {
        chatId: thread.id,
        senderType: MessageSenderType.USER,
        senderUserId: current.userId,
        body: sanitizePlainText(body, 8000),
      },
    });
    return tx.partSourcingRequest.update({
      where: { id: current.id },
      data: {
        paymentState: "PAID",
        paidAt: new Date(),
        status: "NEW",
        chatThreadId: thread.id,
        leadId: lead?.id ?? current.leadId,
      },
    });
  });
}
