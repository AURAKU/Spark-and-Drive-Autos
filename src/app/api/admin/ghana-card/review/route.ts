import { GhanaCardVerificationStatus, NotificationType } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth-helpers";
import { normalizeGhanaCardId } from "@/lib/ghana-card-id";
import { prisma } from "@/lib/prisma";
import { isUniqueConstraintViolation } from "@/lib/prisma-unique";
import { sanitizePlainText } from "@/lib/sanitize";

const schema = z
  .object({
    userId: z.string().min(1),
    action: z.enum(["approve", "reject"]),
    rejectionReason: z.string().max(500).optional(),
    canonicalIdNumber: z.string().max(80).optional(),
    expiryDate: z.string().date().optional(),
  })
  .superRefine((data, ctx) => {
    // Approval requires an explicit expiry date to avoid any null/date ambiguity downstream.
    if (data.action === "approve" && !data.expiryDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["expiryDate"],
        message: "Expiry date is required before approval.",
      });
    }
  });

export async function POST(req: Request) {
  let admin;
  try {
    admin = await requireAdmin();
  } catch (error) {
    const msg = error instanceof Error ? error.message : "";
    if (msg === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (msg === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", issues: parsed.error.flatten() }, { status: 400 });
  }

  const { userId, action } = parsed.data;
  const now = new Date();

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      ghanaCardVerificationStatus: true,
      ghanaCardPendingIdNumber: true,
      ghanaCardAiSuggestedNumber: true,
      ghanaCardPendingImageUrl: true,
      ghanaCardPendingImagePublicId: true,
      ghanaCardPendingExpiresAt: true,
    },
  });
  if (!user) return NextResponse.json({ error: "User not found." }, { status: 404 });
  if (user.ghanaCardVerificationStatus !== GhanaCardVerificationStatus.PENDING_REVIEW) {
    return NextResponse.json({ error: "This user is not pending Ghana Card review." }, { status: 400 });
  }

  if (action === "reject") {
    const reason = parsed.data.rejectionReason?.trim();
    if (!reason || reason.length < 4) {
      return NextResponse.json({ error: "Provide a rejection reason (4+ characters)." }, { status: 400 });
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        ghanaCardVerificationStatus: GhanaCardVerificationStatus.REJECTED,
        ghanaCardRejectedReason: sanitizePlainText(reason, 500),
        ghanaCardReviewedAt: now,
        ghanaCardReviewedById: admin.user.id,
        notifications: {
          create: {
            type: NotificationType.SYSTEM,
            title: "Identity verification review failed",
            body:
              "Your ID verification review failed. Please try again with clear photos, full card edges visible, readable text, and a matching ID number.",
            href: "/dashboard/profile?view=verification",
          },
        },
      },
    });

    return NextResponse.json({ ok: true, status: GhanaCardVerificationStatus.REJECTED });
  }

  const override = normalizeGhanaCardId(parsed.data.canonicalIdNumber);
  const canonical = override ?? user.ghanaCardPendingIdNumber ?? user.ghanaCardAiSuggestedNumber ?? null;
  const parsedExpiry = parsed.data.expiryDate ? new Date(parsed.data.expiryDate) : null;
  if (!canonical) {
    return NextResponse.json({ error: "Enter a valid canonical Ghana Card ID before approval." }, { status: 400 });
  }
  if (!parsedExpiry || Number.isNaN(parsedExpiry.getTime())) {
    return NextResponse.json({ error: "Expiry date is required before approval." }, { status: 400 });
  }
  const expiry = parsedExpiry;

  const conflict = await prisma.user.findFirst({
    where: { id: { not: userId }, ghanaCardIdNumber: canonical },
    select: { id: true },
  });
  if (conflict) {
    return NextResponse.json({ error: "This Ghana Card ID is already linked to another account." }, { status: 409 });
  }

  const status = expiry < now ? GhanaCardVerificationStatus.EXPIRED : GhanaCardVerificationStatus.APPROVED;

  try {
    await prisma.user.update({
      where: { id: userId },
      data: {
        ghanaCardIdNumber: canonical,
        ghanaCardImageUrl: user.ghanaCardPendingImageUrl,
        ghanaCardImagePublicId: user.ghanaCardPendingImagePublicId,
        ghanaCardExpiresAt: expiry,
        ghanaCardVerificationStatus: status,
        ghanaCardPendingIdNumber: null,
        ghanaCardAiSuggestedNumber: null,
        ghanaCardPendingImageUrl: null,
        ghanaCardPendingImagePublicId: null,
        ghanaCardPendingExpiresAt: null,
        ghanaCardRejectedReason: null,
        ghanaCardReviewedAt: now,
        ghanaCardReviewedById: admin.user.id,
      },
    });
  } catch (e) {
    if (isUniqueConstraintViolation(e)) {
      return NextResponse.json({ error: "This Ghana Card ID is already linked to another account." }, { status: 409 });
    }
    throw e;
  }

  return NextResponse.json({ ok: true, status });
}
