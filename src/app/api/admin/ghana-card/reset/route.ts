import { GhanaCardVerificationStatus, NotificationType } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  userIds: z.array(z.string().min(1)).min(1).max(300),
});

export async function POST(req: Request) {
  try {
    await requireAdmin();
  } catch (error) {
    const msg = error instanceof Error ? error.message : "";
    if (msg === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (msg === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  const { userIds } = parsed.data;

  await prisma.$transaction([
    prisma.user.updateMany({
      where: { id: { in: userIds } },
      data: {
        ghanaCardVerificationStatus: GhanaCardVerificationStatus.NONE,
        ghanaCardIdNumber: null,
        ghanaCardImageUrl: null,
        ghanaCardImagePublicId: null,
        ghanaCardExpiresAt: null,
        ghanaCardPendingIdNumber: null,
        ghanaCardAiSuggestedNumber: null,
        ghanaCardPendingImageUrl: null,
        ghanaCardPendingImagePublicId: null,
        ghanaCardPendingExpiresAt: null,
        ghanaCardRejectedReason: null,
      },
    }),
    prisma.notification.createMany({
      data: userIds.map((userId) => ({
        userId,
        type: NotificationType.SYSTEM,
        title: "Identification verification reset",
        body: "Your previous ID verification expired. Please upload a new valid ID for admin approval.",
        href: "/dashboard/profile?view=verification",
      })),
    }),
  ]);

  return NextResponse.json({ ok: true, count: userIds.length });
}
