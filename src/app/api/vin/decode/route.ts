import { NextResponse } from "next/server";
import { z } from "zod";

import { safeAuth } from "@/lib/safe-auth";
import { checkPartsFinderRateLimit } from "@/lib/parts-finder/rate-limit";
import { prisma } from "@/lib/prisma";
import { decodeVin } from "@/lib/vin";

const bodySchema = z.object({
  vin: z.string().trim().min(1),
  saveToGarage: z.boolean().optional(),
  nickname: z.string().trim().max(80).optional(),
});

export async function POST(req: Request) {
  const session = await safeAuth();
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "Sign in required." }, { status: 401 });
  }

  const limit = checkPartsFinderRateLimit({
    key: `vin:decode:${session.user.id}`,
    maxRequests: 20,
    windowMs: 60_000,
  });
  if (!limit.allowed) {
    return NextResponse.json(
      { ok: false, error: "Too many VIN decode requests. Please wait and try again." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  try {
    const parsed = bodySchema.parse(await req.json());
    const decoded = await decodeVin(parsed.vin);
    const decodeSuccess = Boolean(decoded.year && decoded.make && decoded.model);
    await prisma.auditLog.create({
      data: {
        actorId: session.user.id,
        action: "vin.decode.requested",
        entityType: "VIN",
        entityId: decoded.vin,
        metadataJson: {
          success: decodeSuccess,
          hasVehicle: Boolean(decoded.make && decoded.model),
          confidence: decoded.confidence,
          provider: (process.env.VIN_PROVIDER ?? "nhtsa").trim().toLowerCase(),
        },
      },
    });

    if (parsed.saveToGarage) {
      if (!decoded.make || !decoded.model || !decoded.year) {
        return NextResponse.json(
          { ok: false, error: "VIN decoded with incomplete vehicle details. Please review manually before saving." },
          { status: 400 },
        );
      }
      const existing = await prisma.userVehicle.findFirst({
        where: { userId: session.user.id, vin: decoded.vin },
        select: { id: true },
      });
      const hasDefault = await prisma.userVehicle.findFirst({
        where: { userId: session.user.id, isDefault: true },
        select: { id: true },
      });
      if (existing) {
        await prisma.userVehicle.update({
          where: { id: existing.id },
          data: {
            make: decoded.make,
            model: decoded.model,
            year: decoded.year,
            engine: decoded.engine,
            trim: decoded.trim,
            nickname: parsed.nickname || null,
          },
        });
      } else {
        await prisma.userVehicle.create({
          data: {
            userId: session.user.id,
            vin: decoded.vin,
            make: decoded.make,
            model: decoded.model,
            year: decoded.year,
            engine: decoded.engine,
            trim: decoded.trim,
            nickname: parsed.nickname || null,
            isDefault: !hasDefault,
          },
        });
      }
    }

    const warning =
      decoded.confidence === "high"
        ? null
        : "Unable to fully decode VIN - using available vehicle details.";

    return NextResponse.json({ ok: true, vehicle: decoded, warning });
  } catch (error) {
    const message = error instanceof z.ZodError ? error.issues[0]?.message : "Unable to decode VIN right now.";
    return NextResponse.json({ ok: false, error: message ?? "Unable to decode VIN right now." }, { status: 400 });
  }
}
