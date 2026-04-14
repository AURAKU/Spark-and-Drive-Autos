import { NextResponse } from "next/server";

import { transitionPaymentStatus } from "@/lib/payment-lifecycle";
import { getPaystackSecrets } from "@/lib/payment-provider-registry";
import { verifyPaystackSignatureWithSecret } from "@/lib/paystack";
import { prisma } from "@/lib/prisma";
import { recordSecurityObservation } from "@/lib/security-observation";
import { applyWalletLedgerEntry } from "@/lib/wallet-ledger";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const raw = await req.text();
  const sig = req.headers.get("x-paystack-signature");
  const { webhookSecret } = await getPaystackSecrets();

  const ok = verifyPaystackSignatureWithSecret(raw, sig, webhookSecret || undefined);
  if (!ok) {
    await recordSecurityObservation({
      severity: "CRITICAL",
      channel: "WEBHOOK",
      title: "Paystack webhook rejected (invalid HMAC signature)",
      detail: "Possible spoofed or misconfigured webhook; verify Paystack secret and proxy headers.",
      path: "/api/webhooks/paystack",
      metadataJson: { hasSig: Boolean(sig) },
    });
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: {
    event?: string;
    data?: { reference?: string; status?: string; amount?: number; currency?: string };
  };
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
    payload = parsedJson as typeof payload;
  } catch {
    await recordSecurityObservation({
      severity: "HIGH",
      channel: "WEBHOOK",
      title: "Paystack webhook rejected (invalid JSON)",
      path: "/api/webhooks/paystack",
    });
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const reference = payload.data?.reference;
  if (!reference) {
    return NextResponse.json({ ignored: true });
  }

  const walletTxn = await prisma.walletTransaction.findUnique({
    where: { reference },
  });
  if (walletTxn) {
    if (walletTxn.status === "SUCCESS") {
      return NextResponse.json({ received: true, duplicate: true });
    }
    const status = payload.data?.status;
    if (status === "success") {
      const chargedMinor = payload.data?.amount;
      const expectedMinor = Math.round(Number(walletTxn.amount) * 100);
      if (typeof chargedMinor === "number" && chargedMinor !== expectedMinor) {
        await recordSecurityObservation({
          severity: "CRITICAL",
          channel: "FRAUD",
          title: "Wallet webhook amount mismatch (ignored)",
          userId: walletTxn.userId,
          detail: `reference=${reference} expectedMinor=${expectedMinor} chargedMinor=${chargedMinor}`,
          path: "/api/webhooks/paystack",
        });
        return NextResponse.json({ received: true, ignored: "amount_mismatch" });
      }
      await prisma.$transaction(async (db) => {
        await db.walletTransaction.delete({
          where: { id: walletTxn.id },
        });
        await applyWalletLedgerEntry(
          {
            userId: walletTxn.userId,
            reference,
            amount: Number(walletTxn.amount),
            currency: walletTxn.currency,
            provider: walletTxn.provider,
            method: walletTxn.method,
            direction: "CREDIT",
            purpose: walletTxn.purpose,
            paidAt: new Date(),
            providerPayload: parsedJson as object,
            actorUserId: walletTxn.userId,
          },
          db,
        );
        await db.notification.create({
          data: {
            userId: walletTxn.userId,
            type: "PAYMENT",
            title: "Wallet top-up successful",
            body: `GHS ${Number(walletTxn.amount).toLocaleString()} added to your storefront wallet.`,
            href: "/dashboard/profile",
          },
        });
      });
    }
    return NextResponse.json({ received: true });
  }

  const payment = await prisma.payment.findFirst({
    where: { providerReference: reference },
  });

  const webhook = await prisma.paymentWebhookEvent.create({
    data: {
      paymentId: payment?.id,
      event: payload.event ?? "unknown",
      signatureOk: true,
      payload: parsedJson as object,
      processed: false,
    },
  });

  if (!payment) {
    return NextResponse.json({ received: true });
  }

  if (payment.status === "SUCCESS") {
    await prisma.paymentWebhookEvent.update({ where: { id: webhook.id }, data: { processed: true } });
    return NextResponse.json({ received: true, duplicate: true });
  }

  const status = payload.data?.status;
  if (status === "success") {
    const chargedMinor = payload.data?.amount;
    const expectedMinor = Math.round(Number(payment.amount) * 100);
    if (typeof chargedMinor === "number") {
      if (chargedMinor !== expectedMinor) {
        console.error("[paystack webhook] amount mismatch", {
          paymentId: payment.id,
          expectedMinor,
          chargedMinor,
          reference,
        });
        await recordSecurityObservation({
          severity: "CRITICAL",
          channel: "FRAUD",
          title: "Payment webhook amount mismatch (ignored)",
          userId: payment.userId,
          detail: `paymentId=${payment.id} reference=${reference} expectedMinor=${expectedMinor} chargedMinor=${chargedMinor}`,
          path: "/api/webhooks/paystack",
        });
        await prisma.paymentWebhookEvent.update({ where: { id: webhook.id }, data: { processed: true } });
        return NextResponse.json({ received: true, ignored: "amount_mismatch" });
      }
    } else {
      console.warn("[paystack webhook] success event without amount; proceeding", { reference, paymentId: payment.id });
    }
    await transitionPaymentStatus(payment.id, {
      toStatus: "SUCCESS",
      source: "WEBHOOK",
      note: "Paystack charge.success",
      receiptData: { reference, providerStatus: status, amount: chargedMinor },
    });
  }

  await prisma.paymentWebhookEvent.update({
    where: { id: webhook.id },
    data: { processed: true },
  });

  return NextResponse.json({ received: true });
}
