import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { safeAuth } from "@/lib/safe-auth";

const schema = z.object({
  fullName: z.string().min(2).max(120),
  phone: z.string().min(6).max(40),
  region: z.string().min(2).max(80),
  city: z.string().min(2).max(80),
  district: z.string().max(120).optional(),
  locality: z.string().max(120).optional(),
  digitalAddress: z.string().max(80).optional(),
  streetAddress: z.string().min(3).max(240),
  landmark: z.string().max(240).optional(),
  notes: z.string().max(500).optional(),
  isDefault: z.boolean().optional(),
});

export async function POST(req: Request) {
  const session = await safeAuth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  const d = parsed.data;
  await prisma.$transaction(async (tx) => {
    if (d.isDefault) {
      await tx.userAddress.updateMany({
        where: { userId: session.user.id, isDefault: true },
        data: { isDefault: false },
      });
    }
    await tx.userAddress.create({
      data: {
        userId: session.user.id,
        fullName: d.fullName,
        phone: d.phone,
        region: d.region,
        city: d.city,
        district: d.district ?? null,
        locality: d.locality ?? null,
        digitalAddress: d.digitalAddress ?? null,
        streetAddress: d.streetAddress,
        landmark: d.landmark ?? null,
        notes: d.notes ?? null,
        isDefault: Boolean(d.isDefault),
      },
    });
  });
  return NextResponse.json({ ok: true });
}

const patchSchema = z.object({
  id: z.string().cuid(),
  isDefault: z.boolean().optional(),
});

export async function PATCH(req: Request) {
  const session = await safeAuth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  const { id, isDefault } = parsed.data;
  const address = await prisma.userAddress.findFirst({ where: { id, userId: session.user.id } });
  if (!address) return NextResponse.json({ error: "Address not found" }, { status: 404 });
  if (isDefault) {
    await prisma.$transaction([
      prisma.userAddress.updateMany({ where: { userId: session.user.id }, data: { isDefault: false } }),
      prisma.userAddress.update({ where: { id }, data: { isDefault: true } }),
    ]);
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const session = await safeAuth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  await prisma.userAddress.deleteMany({ where: { id, userId: session.user.id } });
  return NextResponse.json({ ok: true });
}
