import { NextResponse } from "next/server";
import { z } from "zod";

import { recordPaymentProofSubmission } from "@/lib/payment-lifecycle";
import { isTrustedPaymentProofUrl } from "@/lib/payment-proof-url";
import { prisma } from "@/lib/prisma";
import { safeAuth } from "@/lib/safe-auth";

const MAX_PROOFS = 10;

const bodySchema = z.object({
  imageUrl: z.string().url(),
  publicId: z.string().optional(),
  note: z.string().max(2000).optional(),
});

type RouteContext = { params: Promise<{ paymentId: string }> };

export async function POST(req: Request, ctx: RouteContext) {
  const session = await safeAuth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { paymentId } = await ctx.params;
  if (!z.string().cuid().safeParse(paymentId).success) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed" }, { status: 400 });
  }
  if (!isTrustedPaymentProofUrl(parsed.data.imageUrl)) {
    return NextResponse.json({ error: "Proof URL must be from our secure upload host" }, { status: 400 });
  }

  const payment = await prisma.payment.findFirst({
    where: { id: paymentId, userId: session.user.id },
  });
  if (!payment) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const existing = await prisma.paymentProof.count({ where: { paymentId } });
  if (existing >= MAX_PROOFS) {
    return NextResponse.json({ error: "Maximum number of proofs reached" }, { status: 409 });
  }

  await prisma.paymentProof.create({
    data: {
      paymentId,
      uploadedById: session.user.id,
      imageUrl: parsed.data.imageUrl,
      publicId: parsed.data.publicId,
      note: parsed.data.note,
    },
  });
  await prisma.paymentVerification.upsert({
    where: { paymentId },
    create: {
      paymentId,
      verified: false,
      verificationSource: "USER_PROOF",
      proofAttachedAt: new Date(),
    },
    update: {
      proofAttachedAt: new Date(),
      verificationSource: "USER_PROOF",
    },
  });

  try {
    await recordPaymentProofSubmission(paymentId, session.user.id);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (msg === "INVALID_STATUS") return NextResponse.json({ error: "Invalid payment status" }, { status: 409 });
    throw e;
  }

  return NextResponse.json({ ok: true });
}
