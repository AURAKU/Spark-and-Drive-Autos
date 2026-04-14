import { NextResponse } from "next/server";
import { z } from "zod";

import { canUploadPaymentProof } from "@/lib/payment-status-utils";
import { createUploadSignature } from "@/lib/cloudinary";
import { prisma } from "@/lib/prisma";
import { safeAuth } from "@/lib/safe-auth";

const schema = z.object({
  paymentId: z.string().cuid(),
});

/**
 * Signed Cloudinary upload for payment receipts (account owner only).
 */
export async function POST(req: Request) {
  const session = await safeAuth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const payment = await prisma.payment.findFirst({
    where: { id: parsed.data.paymentId, userId: session.user.id },
  });
  if (!payment) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!canUploadPaymentProof(payment.status)) {
    return NextResponse.json({ error: "Proof upload is closed for this payment" }, { status: 409 });
  }

  const folder = `sda/payments/${parsed.data.paymentId}/proofs`;

  try {
    const sig = await createUploadSignature({ folder });
    const cloud = sig.cloudName as string;
    const uploadUrl = `https://api.cloudinary.com/v1_1/${cloud}/image/upload`;
    return NextResponse.json({ ...sig, uploadUrl, folder });
  } catch {
    return NextResponse.json({ error: "Cloudinary not configured" }, { status: 501 });
  }
}
