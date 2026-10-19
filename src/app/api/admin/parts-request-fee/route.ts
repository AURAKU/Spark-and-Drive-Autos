import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth-helpers";
import { getPartsRequestFeeSettings } from "@/lib/parts-request-fee";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  enabled: z.boolean(),
  feeAmount: z.number().positive().max(100000),
});

export const runtime = "nodejs";

export async function GET() {
  await requireAdmin();
  const settings = await getPartsRequestFeeSettings();
  return NextResponse.json({
    ok: true,
    settings: { enabled: settings.enabled, feeAmount: Number(settings.feeAmount), currency: settings.currency },
  });
}

export async function PATCH(req: Request) {
  const session = await requireAdmin();
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Enter a fee greater than zero." }, { status: 400 });
  }
  const settings = await getPartsRequestFeeSettings();
  const updated = await prisma.partsRequestFeeSettings.update({
    where: { id: settings.id },
    data: { enabled: parsed.data.enabled, feeAmount: new Prisma.Decimal(parsed.data.feeAmount.toFixed(2)) },
  });
  await prisma.auditLog.create({
    data: {
      actorId: session.user.id,
      action: "parts_request_fee.updated",
      entityType: "PartsRequestFeeSettings",
      entityId: updated.id,
      metadataJson: { feeAmount: Number(updated.feeAmount), enabled: updated.enabled },
    },
  });
  return NextResponse.json({ ok: true, settings: { enabled: updated.enabled, feeAmount: Number(updated.feeAmount) } });
}
