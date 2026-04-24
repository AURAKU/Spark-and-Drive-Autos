import { CarListingState } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { safeAuth } from "@/lib/safe-auth";

const schema = z.object({ carId: z.string().cuid() });

export async function POST(req: Request) {
  const session = await safeAuth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid vehicle" }, { status: 400 });

  const car = await prisma.car.findFirst({
    where: {
      id: parsed.data.carId,
      listingState: { in: [CarListingState.PUBLISHED, CarListingState.SOLD] },
    },
    select: { id: true },
  });
  if (!car) return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });

  await prisma.favorite.upsert({
    where: { userId_carId: { userId: session.user.id, carId: parsed.data.carId } },
    create: { userId: session.user.id, carId: parsed.data.carId },
    update: {},
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const session = await safeAuth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const carId = url.searchParams.get("carId");
  const clearAll = url.searchParams.get("all");

  if (clearAll === "1") {
    await prisma.favorite.deleteMany({ where: { userId: session.user.id } });
    return NextResponse.json({ ok: true, cleared: true });
  }
  if (!carId) return NextResponse.json({ error: "Missing vehicle id" }, { status: 400 });

  await prisma.favorite.deleteMany({ where: { userId: session.user.id, carId } });
  return NextResponse.json({ ok: true });
}
