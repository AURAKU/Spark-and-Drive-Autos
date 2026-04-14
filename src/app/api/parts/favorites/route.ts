import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { safeAuth } from "@/lib/safe-auth";

const schema = z.object({ partId: z.string().cuid() });

export async function POST(req: Request) {
  const session = await safeAuth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid part" }, { status: 400 });

  const part = await prisma.part.findUnique({ where: { id: parsed.data.partId }, select: { id: true } });
  if (!part) return NextResponse.json({ error: "Part not found" }, { status: 404 });

  await prisma.partFavorite.upsert({
    where: { userId_partId: { userId: session.user.id, partId: parsed.data.partId } },
    create: { userId: session.user.id, partId: parsed.data.partId },
    update: {},
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const session = await safeAuth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const partId = url.searchParams.get("partId");
  const clearAll = url.searchParams.get("all");

  if (clearAll === "1") {
    await prisma.partFavorite.deleteMany({ where: { userId: session.user.id } });
    return NextResponse.json({ ok: true, cleared: true });
  }
  if (!partId) return NextResponse.json({ error: "Missing part id" }, { status: 400 });

  await prisma.partFavorite.deleteMany({ where: { userId: session.user.id, partId } });
  return NextResponse.json({ ok: true });
}
