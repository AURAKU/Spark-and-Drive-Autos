import { NextResponse } from "next/server";
import { z } from "zod";

import { safeAuth } from "@/lib/safe-auth";
import { prisma } from "@/lib/prisma";

const patchSchema = z.object({
  nickname: z.string().trim().max(80).optional(),
  nextServiceReminder: z.string().datetime().optional().nullable(),
});

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await safeAuth();
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "Sign in required." }, { status: 401 });
  }
  const { id } = await context.params;
  try {
    const parsed = patchSchema.parse(await req.json());
    const row = await prisma.userVehicle.updateMany({
      where: { id, userId: session.user.id },
      data: {
        nickname: parsed.nickname || null,
        nextServiceReminder: parsed.nextServiceReminder ? new Date(parsed.nextServiceReminder) : null,
      },
    });
    if (row.count === 0) {
      return NextResponse.json({ ok: false, error: "Vehicle not found." }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof z.ZodError ? error.issues[0]?.message : "Unable to update vehicle.";
    return NextResponse.json({ ok: false, error: message ?? "Unable to update vehicle." }, { status: 400 });
  }
}

export async function DELETE(_req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await safeAuth();
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "Sign in required." }, { status: 401 });
  }
  const { id } = await context.params;
  const deleted = await prisma.userVehicle.deleteMany({ where: { id, userId: session.user.id } });
  if (deleted.count === 0) {
    return NextResponse.json({ ok: false, error: "Vehicle not found." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
