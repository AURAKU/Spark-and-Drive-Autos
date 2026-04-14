import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { z } from "zod";

import { getActivePaymentProviderConfig, getPaystackCallbackOrigin, getPaystackSecrets } from "@/lib/payment-provider-registry";
import { paystackInitialize } from "@/lib/paystack";
import { getRequestIp } from "@/lib/client-ip";
import { prisma } from "@/lib/prisma";
import { recordSecurityObservation } from "@/lib/security-observation";
import { safeAuth } from "@/lib/safe-auth";

const schema = z.object({
  amount: z.coerce.number().min(50).max(50000),
});

export async function POST(req: Request) {
  const session = await safeAuth();
  if (!session?.user?.id || !session.user.email) {
    const ip = getRequestIp(req);
    await recordSecurityObservation({
      severity: "MEDIUM",
      channel: "PAYMENT",
      title: "Wallet top-up initialize without valid session",
      ipAddress: ip,
      userAgent: req.headers.get("user-agent"),
      path: "/api/wallet/topup/initialize",
    });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
  }
  const amount = Number(parsed.data.amount.toFixed(2));
  const activeProvider = await getActivePaymentProviderConfig();
  const selectedProvider = activeProvider?.provider ?? "PAYSTACK";
  if (selectedProvider !== "PAYSTACK") {
    return NextResponse.json(
      {
        error:
          "Wallet top-up currently supports Paystack only. Set Paystack as the default channel under Admin → API providers.",
      },
      { status: 409 },
    );
  }
  const { secretKey } = await getPaystackSecrets();
  if (!secretKey) {
    return NextResponse.json(
      { error: "Paystack secret key missing. Configure it under Admin → API providers." },
      { status: 500 },
    );
  }
  const reference = `SDA-WAL-${nanoid(12).toUpperCase()}`;
  await prisma.walletTransaction.create({
    data: {
      userId: session.user.id,
      reference,
      amount,
      currency: "GHS",
      provider: "PAYSTACK",
      method: "MOBILE_MONEY",
      status: "PENDING",
    },
  });
  const callbackOrigin = await getPaystackCallbackOrigin();
  const callbackUrl = `${callbackOrigin}/dashboard/profile?walletRef=${encodeURIComponent(reference)}`;
  const init = await paystackInitialize({
    email: session.user.email,
    amountMinorUnits: Math.round(amount * 100),
    reference,
    currency: "GHS",
    callbackUrl,
    metadata: { kind: "wallet_topup", userId: session.user.id },
    secretKey,
  });
  return NextResponse.json({ authorizationUrl: init.authorization_url, reference: init.reference });
}
