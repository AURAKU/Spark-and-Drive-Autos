import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";

import { requireSuperAdmin } from "@/lib/auth-helpers";
import { getVerifiedPartSettings } from "@/lib/verified-parts";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  enabled: z.boolean(),
  feeAmount: z.number().positive(),
  currency: z.string().trim().max(10),
  serviceDescription: z.string().trim().max(2500).optional(),
  legalNote: z.string().trim().max(2500).optional(),
});

export async function GET() {
  await requireSuperAdmin();
  const settings = await getVerifiedPartSettings();
  return NextResponse.json({ ok: true, settings });
}

export async function PATCH(req: Request) {
  try {
    const session = await requireSuperAdmin();
    const input = schema.parse(await req.json());
    const settings = await getVerifiedPartSettings();
    const updated = await prisma.verifiedPartRequestSettings.update({
      where: { id: settings.id },
      data: {
        enabled: input.enabled,
        feeAmount: new Prisma.Decimal(input.feeAmount),
        currency: input.currency,
        serviceDescription: input.serviceDescription ?? null,
        legalNote: input.legalNote ?? null,
      },
    });
    await prisma.auditLog.create({
      data: {
        actorId: session.user.id,
        action: "verified_part_request.settings_updated",
        entityType: "VerifiedPartRequestSettings",
        entityId: updated.id,
      },
    });
    return NextResponse.json({ ok: true, settings: updated });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Unable to update settings." }, { status: 400 });
  }
}
