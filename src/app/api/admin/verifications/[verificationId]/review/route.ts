import { VerificationStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getRequestIp } from "@/lib/client-ip";
import {
  approveVerification,
  logVerificationAction,
  rejectVerification,
} from "@/lib/identity-verification";
import { requireAdmin } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { sanitizePlainText } from "@/lib/sanitize";

const schema = z.object({
  action: z.enum(["approve", "reject", "under_review", "expire"]),
  rejectionReason: z.string().max(400).optional(),
  internalNotes: z.string().max(2000).optional(),
  expiresAt: z.string().datetime().optional(),
});

type RouteContext = { params: Promise<{ verificationId: string }> };

export async function POST(req: Request, ctx: RouteContext) {
  const admin = await requireAdmin();
  const ip = getRequestIp(req);
  const userAgent = req.headers.get("user-agent");
  const { verificationId } = await ctx.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", issues: parsed.error.flatten() }, { status: 400 });
  }

  const row = await prisma.userVerification.findUnique({
    where: { id: verificationId },
    select: { id: true, userId: true },
  });
  if (!row) {
    return NextResponse.json({ error: "Verification record not found." }, { status: 404 });
  }

  if (parsed.data.action === "approve") {
    const updated = await approveVerification({
      verificationId,
      adminId: admin.user.id,
      internalNotes: parsed.data.internalNotes ? sanitizePlainText(parsed.data.internalNotes, 2000) : null,
      expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
    });
    return NextResponse.json({ ok: true, status: updated.status });
  }

  if (parsed.data.action === "reject") {
    const reason = parsed.data.rejectionReason?.trim();
    if (!reason || reason.length < 4) {
      return NextResponse.json({ error: "Provide a clear rejection reason (4+ chars)." }, { status: 400 });
    }
    const updated = await rejectVerification({
      verificationId,
      adminId: admin.user.id,
      rejectionReason: sanitizePlainText(reason, 400),
      internalNotes: parsed.data.internalNotes ? sanitizePlainText(parsed.data.internalNotes, 2000) : null,
    });
    return NextResponse.json({ ok: true, status: updated.status });
  }

  const nextStatus = parsed.data.action === "under_review" ? VerificationStatus.UNDER_REVIEW : VerificationStatus.EXPIRED;
  await prisma.userVerification.update({
    where: { id: verificationId },
    data: {
      status: nextStatus,
      reviewedAt: new Date(),
      reviewedById: admin.user.id,
      internalNotes: parsed.data.internalNotes ? sanitizePlainText(parsed.data.internalNotes, 2000) : null,
    },
  });
  await logVerificationAction({
    userId: row.userId,
    verificationId,
    actorId: admin.user.id,
    action: nextStatus === VerificationStatus.UNDER_REVIEW ? "VERIFICATION_MARKED_UNDER_REVIEW" : "VERIFICATION_EXPIRED",
    metadata: {
      internalNotes: parsed.data.internalNotes ?? null,
    },
    ipAddress: ip,
    userAgent,
  });
  return NextResponse.json({ ok: true, status: nextStatus });
}
