import { NextResponse } from "next/server";
import { z } from "zod";

import { CLOUDINARY_USER_MESSAGE, createPaymentProofUploadSignature, isCloudinaryMissingConfigError } from "@/lib/cloudinary";
import { canUploadPaymentProof } from "@/lib/payment-status-utils";
import { prisma } from "@/lib/prisma";
import { safeAuth } from "@/lib/safe-auth";

const schema = z.object({
  paymentId: z.string().cuid(),
  kind: z.enum(["image", "pdf"]).optional(),
});

/**
 * Signed Cloudinary upload for payment receipts (account owner only).
 */
export const runtime = "nodejs";

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
  const kind = parsed.data.kind ?? "image";

  try {
    const sig = await createPaymentProofUploadSignature({ folder, kind });
    return NextResponse.json({
      timestamp: sig.timestamp,
      signature: sig.signature,
      apiKey: sig.apiKey,
      cloudName: sig.cloudName,
      folder: sig.folder,
      uploadUrl: sig.uploadUrl,
      kind: sig.kind,
      eager: sig.eager,
    });
  } catch (e) {
    if (isCloudinaryMissingConfigError(e)) {
      console.warn("[api/upload/payment-proof-signature] Cloudinary credentials missing");
      return NextResponse.json({ error: CLOUDINARY_USER_MESSAGE }, { status: 501 });
    }
    const msg = e instanceof Error ? e.message : "Upload sign failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
