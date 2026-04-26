import { NextResponse } from "next/server";
import { z } from "zod";

import { safeAuth } from "@/lib/safe-auth";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  id: z.string().trim().min(1),
});

export async function POST(req: Request) {
  const session = await safeAuth();
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "Sign in required." }, { status: 401 });
  }
  try {
    const parsed = bodySchema.parse(await req.json());
    const target = await prisma.userVehicle.findFirst({
      where: { id: parsed.id, userId: session.user.id },
      select: { id: true },
    });
    if (!target) {
      return NextResponse.json({ ok: false, error: "Vehicle not found." }, { status: 404 });
    }
    await prisma.$transaction([
      prisma.userVehicle.updateMany({
        where: { userId: session.user.id, isDefault: true },
        data: { isDefault: false },
      }),
      prisma.userVehicle.update({
        where: { id: target.id },
        data: { isDefault: true },
      }),
    ]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof z.ZodError ? error.issues[0]?.message : "Unable to set default vehicle.";
    return NextResponse.json({ ok: false, error: message ?? "Unable to set default vehicle." }, { status: 400 });
  }
}
