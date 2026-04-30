import { GhanaCardVerificationStatus } from "@prisma/client";
import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    await requireAdmin();

    await prisma.user.updateMany({
      where: {
        ghanaCardVerificationStatus: GhanaCardVerificationStatus.APPROVED,
        ghanaCardExpiresAt: { lt: new Date() },
      },
      data: { ghanaCardVerificationStatus: GhanaCardVerificationStatus.EXPIRED },
    });

    const [pendingRows, expiredRows] = await Promise.all([
      prisma.user.findMany({
        where: { ghanaCardVerificationStatus: GhanaCardVerificationStatus.PENDING_REVIEW },
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          email: true,
          name: true,
          ghanaCardPendingImageUrl: true,
          ghanaCardPendingIdNumber: true,
          ghanaCardAiSuggestedNumber: true,
          ghanaCardPendingExpiresAt: true,
          updatedAt: true,
        },
        take: 200,
      }),
      prisma.user.findMany({
        where: { ghanaCardVerificationStatus: GhanaCardVerificationStatus.EXPIRED },
        orderBy: { ghanaCardExpiresAt: "asc" },
        select: {
          id: true,
          email: true,
          name: true,
          ghanaCardIdNumber: true,
          ghanaCardImageUrl: true,
          ghanaCardExpiresAt: true,
        },
        take: 500,
      }),
    ]);

    return NextResponse.json({ ok: true, pendingRows, expiredRows });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "";
    if (msg === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (msg === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: "Unable to load queue." }, { status: 500 });
  }
}
