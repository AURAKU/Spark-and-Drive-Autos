import { NextResponse } from "next/server";
import { z } from "zod";

import { normalizeGhanaCardId } from "@/lib/ghana-card-id";
import { prisma } from "@/lib/prisma";
import { isUniqueConstraintViolation } from "@/lib/prisma-unique";
import { safeAuth } from "@/lib/safe-auth";

const schema = z.object({
  ghanaCardIdNumber: z.string().max(80).optional(),
  imageUrl: z.string().url(),
  imagePublicId: z.string().max(500).optional(),
});

export async function POST(req: Request) {
  const session = await safeAuth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  const ghanaNormalized = normalizeGhanaCardId(parsed.data.ghanaCardIdNumber);
  if (ghanaNormalized) {
    const other = await prisma.user.findUnique({
      where: { ghanaCardIdNumber: ghanaNormalized },
      select: { id: true },
    });
    if (other && other.id !== session.user.id) {
      return NextResponse.json(
        { error: "This Ghana Card ID number is already linked to another account." },
        { status: 409 },
      );
    }
  }

  try {
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        ghanaCardIdNumber: ghanaNormalized,
        ghanaCardImageUrl: parsed.data.imageUrl,
        ghanaCardImagePublicId: parsed.data.imagePublicId ?? null,
      },
    });
  } catch (e) {
    if (isUniqueConstraintViolation(e)) {
      return NextResponse.json(
        { error: "This Ghana Card ID number is already linked to another account." },
        { status: 409 },
      );
    }
    throw e;
  }
  return NextResponse.json({ ok: true });
}
