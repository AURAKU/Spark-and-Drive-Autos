import type {
  PaymentProvider,
  PaymentSettlementMethod,
  Prisma,
  WalletTransactionDirection,
  WalletTransactionPurpose,
  WalletTransactionStatus,
} from "@prisma/client";

import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

type WalletLedgerEntryInput = {
  userId: string;
  reference: string;
  amount: number;
  currency?: string;
  provider?: PaymentProvider;
  method?: PaymentSettlementMethod;
  status?: WalletTransactionStatus;
  direction: WalletTransactionDirection;
  purpose: WalletTransactionPurpose;
  orderId?: string | null;
  providerPayload?: Prisma.InputJsonValue;
  paidAt?: Date | null;
  actorUserId?: string | null;
};

type WalletDb = Prisma.TransactionClient;

function deltaFromDirection(direction: WalletTransactionDirection, amount: number) {
  return direction === "CREDIT" ? amount : -amount;
}

export async function applyWalletLedgerEntry(input: WalletLedgerEntryInput, tx?: WalletDb) {
  const db = tx ?? prisma;
  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Invalid wallet amount.");
  }
  const delta = deltaFromDirection(input.direction, amount);
  const targetStatus = input.status ?? "SUCCESS";
  if (targetStatus !== "SUCCESS") {
    throw new Error("Wallet balance mutation requires SUCCESS ledger status.");
  }

  const before = await db.user.findUnique({
    where: { id: input.userId },
    select: { walletBalance: true },
  });
  if (!before) throw new Error("User not found.");

  const beforeBalance = Number(before.walletBalance);
  const afterBalance = Number((beforeBalance + delta).toFixed(2));
  if (afterBalance < 0) {
    throw new Error("Insufficient wallet balance.");
  }

  const existing = await db.walletTransaction.findUnique({
    where: { reference: input.reference },
    select: { id: true, userId: true, amount: true, direction: true, status: true },
  });
  if (existing) {
    if (existing.userId !== input.userId || existing.status !== "SUCCESS") {
      throw new Error("Wallet reference conflict.");
    }
    return existing;
  }

  const txn = await db.walletTransaction.create({
    data: {
      userId: input.userId,
      reference: input.reference,
      amount,
      currency: input.currency ?? "GHS",
      provider: input.provider ?? "PAYSTACK",
      method: input.method ?? "MOBILE_MONEY",
      status: targetStatus,
      direction: input.direction,
      purpose: input.purpose,
      orderId: input.orderId ?? null,
      providerPayload: input.providerPayload,
      paidAt: input.paidAt ?? new Date(),
    },
  });

  await db.user.update({
    where: { id: input.userId },
    data: { walletBalance: afterBalance },
  });

  await writeAuditLog(
    {
      actorId: input.actorUserId ?? input.userId,
      action: input.direction === "CREDIT" ? "WALLET_CREDIT" : "WALLET_DEBIT",
      entityType: "WalletTransaction",
      entityId: txn.id,
      metadataJson: {
        reference: input.reference,
        amount,
        direction: input.direction,
        purpose: input.purpose,
        beforeBalance,
        afterBalance,
      },
    },
    db,
  );

  return txn;
}
