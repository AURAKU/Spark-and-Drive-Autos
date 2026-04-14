import { NextResponse } from "next/server";
import { z } from "zod";

import { getPaystackSecrets } from "@/lib/payment-provider-registry";
import { paystackVerify } from "@/lib/paystack";
import { prisma } from "@/lib/prisma";
import { safeAuth } from "@/lib/safe-auth";
import { applyWalletLedgerEntry } from "@/lib/wallet-ledger";

const schema = z.object({ reference: z.string().min(8).max(80) });

export async function POST(req: Request) {
  const session = await safeAuth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid reference" }, { status: 400 });

  const tx = await prisma.walletTransaction.findFirst({
    where: { reference: parsed.data.reference, userId: session.user.id },
  });
  if (!tx) return NextResponse.json({ error: "Wallet top-up not found" }, { status: 404 });
  if (tx.status === "SUCCESS") return NextResponse.json({ ok: true, status: "SUCCESS" });

  const { secretKey } = await getPaystackSecrets();
  const verified = await paystackVerify(parsed.data.reference, secretKey || undefined);
  if (verified.status !== "success") return NextResponse.json({ ok: true, status: "PENDING" });
  if (Math.round(Number(tx.amount) * 100) !== verified.amount || tx.currency !== verified.currency) {
    return NextResponse.json({ error: "Verification mismatch for amount or currency." }, { status: 409 });
  }

  await prisma.$transaction(async (db) => {
    await db.walletTransaction.delete({ where: { id: tx.id } });
    await applyWalletLedgerEntry(
      {
        userId: session.user.id,
        reference: parsed.data.reference,
        amount: Number(tx.amount),
        currency: tx.currency,
        provider: tx.provider,
        method: tx.method,
        direction: "CREDIT",
        purpose: tx.purpose,
        paidAt: new Date(),
        providerPayload: verified as unknown as object,
        actorUserId: session.user.id,
      },
      db,
    );
  });
  return NextResponse.json({ ok: true, status: "SUCCESS" });
}
