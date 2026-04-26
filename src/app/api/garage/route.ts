import { NextResponse } from "next/server";
import { z } from "zod";

import { safeAuth } from "@/lib/safe-auth";
import { prisma } from "@/lib/prisma";
import { decodeVin, parseVin } from "@/lib/vin";

const addSchema = z.object({
  vin: z.string().trim().optional(),
  make: z.string().trim().min(1).max(80).optional(),
  model: z.string().trim().min(1).max(80).optional(),
  year: z.union([z.string(), z.number()]).optional(),
  engine: z.string().trim().max(120).optional(),
  trim: z.string().trim().max(120).optional(),
  nickname: z.string().trim().max(80).optional(),
  nextServiceReminder: z.string().datetime().optional().nullable(),
});

export async function GET() {
  const session = await safeAuth();
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "Sign in required." }, { status: 401 });
  }
  const rows = await prisma.userVehicle.findMany({
    where: { userId: session.user.id },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
  });
  return NextResponse.json({ ok: true, vehicles: rows });
}

export async function POST(req: Request) {
  const session = await safeAuth();
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "Sign in required." }, { status: 401 });
  }
  try {
    const parsed = addSchema.parse(await req.json());
    const vin = parsed.vin?.trim() ? parseVin(parsed.vin) : null;
    let make = parsed.make ?? null;
    let model = parsed.model ?? null;
    let year =
      typeof parsed.year === "number"
        ? parsed.year
        : typeof parsed.year === "string"
          ? Number.parseInt(parsed.year, 10)
          : null;
    let engine = parsed.engine ?? null;
    let trim = parsed.trim ?? null;
    if (vin) {
      const decoded = await decodeVin(vin);
      make = decoded.make ?? make;
      model = decoded.model ?? model;
      year = decoded.year ?? year;
      engine = decoded.engine ?? engine;
      trim = decoded.trim ?? trim;
    }
    if (!make || !model || !year || !Number.isFinite(year)) {
      return NextResponse.json({ ok: false, error: "Provide valid vehicle make, model, and year." }, { status: 400 });
    }
    const duplicateWhere: Array<Record<string, unknown>> = [{ make, model, year, engine: engine ?? null, trim: trim ?? null }];
    if (vin) duplicateWhere.push({ vin });
    const existing = await prisma.userVehicle.findFirst({
      where: {
        userId: session.user.id,
        OR: duplicateWhere as never,
      },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json({ ok: false, error: "Vehicle already exists in your garage." }, { status: 409 });
    }
    const hasDefault = await prisma.userVehicle.findFirst({
      where: { userId: session.user.id, isDefault: true },
      select: { id: true },
    });
    const created = await prisma.userVehicle.create({
      data: {
        userId: session.user.id,
        vin,
        make,
        model,
        year,
        engine,
        trim,
        nickname: parsed.nickname || null,
        isDefault: !hasDefault,
        nextServiceReminder: parsed.nextServiceReminder ? new Date(parsed.nextServiceReminder) : null,
      },
    });
    return NextResponse.json({ ok: true, vehicle: created });
  } catch (error) {
    const message = error instanceof z.ZodError ? error.issues[0]?.message : "Unable to save vehicle.";
    return NextResponse.json({ ok: false, error: message ?? "Unable to save vehicle." }, { status: 400 });
  }
}
