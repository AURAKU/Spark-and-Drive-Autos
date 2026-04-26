import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  status: z
    .enum(["IN_REVIEW", "VERIFIED", "FAILED", "NEEDS_MORE_INFO", "CANCELLED"])
    .optional(),
  assignToSelf: z.boolean().optional(),
  assignedAdminId: z.string().optional(),
  adminNotes: z.string().trim().max(2500).optional(),
  verifiedPartNumber: z.string().trim().max(120).optional(),
  verifiedOemNumber: z.string().trim().max(120).optional(),
  verifiedBrand: z.string().trim().max(120).optional(),
  verifiedSupplier: z.string().trim().max(180).optional(),
  verifiedPrice: z.number().nonnegative().optional(),
  verifiedCurrency: z.string().trim().max(10).optional(),
  verifiedAvailability: z.string().trim().max(120).optional(),
  verifiedFitmentNotes: z.string().trim().max(3000).optional(),
  resultJson: z.unknown().optional(),
});

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdmin();
    const { id } = await context.params;
    const input = schema.parse(await req.json());
    if (input.status === "VERIFIED") {
      if (!input.verifiedFitmentNotes || !(input.verifiedPartNumber || input.verifiedOemNumber)) {
        return NextResponse.json(
          { ok: false, error: "Verified status requires fitment notes and verified part number or OEM number." },
          { status: 400 },
        );
      }
    }
    const updated = await prisma.verifiedPartRequest.update({
      where: { id },
      data: {
        status: input.status,
        assignedAdminId: input.assignToSelf ? session.user.id : input.assignedAdminId ?? undefined,
        adminNotes: input.adminNotes ?? undefined,
        verifiedPartNumber: input.verifiedPartNumber ?? undefined,
        verifiedOemNumber: input.verifiedOemNumber ?? undefined,
        verifiedBrand: input.verifiedBrand ?? undefined,
        verifiedSupplier: input.verifiedSupplier ?? undefined,
        verifiedPrice: input.verifiedPrice ?? undefined,
        verifiedCurrency: input.verifiedCurrency ?? undefined,
        verifiedAvailability: input.verifiedAvailability ?? undefined,
        verifiedFitmentNotes: input.verifiedFitmentNotes ?? undefined,
        resultJson: (input.resultJson as object | undefined) ?? undefined,
        completedAt: input.status === "VERIFIED" ? new Date() : undefined,
        cancelledAt: input.status === "CANCELLED" ? new Date() : undefined,
      },
    });
    await prisma.auditLog.create({
      data: {
        actorId: session.user.id,
        action: "verified_part_request.admin_updated",
        entityType: "VerifiedPartRequest",
        entityId: updated.id,
        metadataJson: { status: updated.status, assignedAdminId: updated.assignedAdminId ?? null },
      },
    });
    return NextResponse.json({ ok: true, request: updated });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Unable to update request." }, { status: 400 });
  }
}
