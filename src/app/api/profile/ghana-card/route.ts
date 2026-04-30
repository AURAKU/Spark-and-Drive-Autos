import { GhanaCardVerificationStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { normalizeGhanaCardId } from "@/lib/ghana-card-id";
import { extractGhanaCardDetailsFromImageUrl } from "@/lib/ghana-card-vision";
import { prisma } from "@/lib/prisma";
import { safeAuth } from "@/lib/safe-auth";

const schema = z.object({
  ghanaCardIdNumber: z.string().min(3).max(80),
  imageUrl: z.string().url(),
  imagePublicId: z.string().min(1).max(500),
  expiryDate: z.string().date(),
});

async function findPendingOrCanonicalConflict(excludeUserId: string, normalizedId: string) {
  return prisma.user.findFirst({
    where: {
      id: { not: excludeUserId },
      OR: [
        { ghanaCardIdNumber: normalizedId },
        {
          ghanaCardVerificationStatus: GhanaCardVerificationStatus.PENDING_REVIEW,
          ghanaCardPendingIdNumber: normalizedId,
        },
      ],
    },
    select: { id: true },
  });
}

export async function POST(req: Request) {
  const session = await safeAuth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const userNormalized = normalizeGhanaCardId(parsed.data.ghanaCardIdNumber);
  if (!userNormalized) {
    return NextResponse.json({ error: "Ghana Card ID number is required." }, { status: 400 });
  }
  const ai = await extractGhanaCardDetailsFromImageUrl(parsed.data.imageUrl);
  const pendingNumber = userNormalized;
  const pendingExpiryDate = new Date(parsed.data.expiryDate);

  if (pendingNumber) {
    const other = await findPendingOrCanonicalConflict(session.user.id, pendingNumber);
    if (other) {
      return NextResponse.json(
        { error: "This Ghana Card ID number is already linked or pending on another account." },
        { status: 409 },
      );
    }
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      ghanaCardVerificationStatus: GhanaCardVerificationStatus.PENDING_REVIEW,
      ghanaCardPendingIdNumber: pendingNumber,
      ghanaCardAiSuggestedNumber: ai.normalizedIdNumber,
      ghanaCardPendingImageUrl: parsed.data.imageUrl,
      ghanaCardPendingImagePublicId: parsed.data.imagePublicId ?? null,
      ghanaCardPendingExpiresAt: pendingExpiryDate,
      ghanaCardRejectedReason: null,
      ghanaCardReviewedAt: null,
      ghanaCardReviewedById: null,
    },
  });

  return NextResponse.json({
    ok: true,
    status: GhanaCardVerificationStatus.PENDING_REVIEW,
    pendingIdNumber: pendingNumber,
    pendingExpiryDate: pendingExpiryDate?.toISOString() ?? null,
    aiSuggested: ai.normalizedIdNumber,
    aiUsed: ai.usedAi,
  });
}
