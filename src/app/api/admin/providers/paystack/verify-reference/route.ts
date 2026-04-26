import { NextResponse } from "next/server";
import { z } from "zod";

import { requireSuperAdmin } from "@/lib/auth-helpers";
import { paystackVerify } from "@/lib/paystack";
import { getPaystackSecrets } from "@/lib/payment-provider-registry";

const schema = z.object({
  reference: z.string().min(6).max(120),
});

export async function POST(req: Request) {
  try {
    await requireSuperAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid reference" }, { status: 400 });
  }
  const { secretKey } = await getPaystackSecrets();
  if (!secretKey) {
    return NextResponse.json({ error: "Paystack secret is not configured" }, { status: 409 });
  }
  try {
    const verified = await paystackVerify(parsed.data.reference, secretKey);
    return NextResponse.json({
      ok: true,
      providerStatus: verified.status,
      amount: verified.amount,
      currency: verified.currency,
      reference: verified.reference,
      paidAt: verified.paid_at,
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Verification failed" }, { status: 400 });
  }
}
