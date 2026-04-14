import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
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
  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      ghanaCardIdNumber: parsed.data.ghanaCardIdNumber ?? null,
      ghanaCardImageUrl: parsed.data.imageUrl,
      ghanaCardImagePublicId: parsed.data.imagePublicId ?? null,
    },
  });
  return NextResponse.json({ ok: true });
}
