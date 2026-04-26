import { NextResponse } from "next/server";
import { z } from "zod";

import { requirePartsFinderMembership } from "@/lib/parts-finder/access";
import { prisma } from "@/lib/prisma";
import { nextVerifiedPartRequestNumber, getVerifiedPartSettings } from "@/lib/verified-parts";

const schema = z.object({
  partsFinderSearchId: z.string().optional(),
  selectedMatchId: z.string().optional(),
  userVehicleId: z.string().optional(),
  vin: z.string().trim().optional(),
  vehicleYear: z.number().int().optional(),
  vehicleMake: z.string().trim().max(80).optional(),
  vehicleModel: z.string().trim().max(80).optional(),
  vehicleEngine: z.string().trim().max(120).optional(),
  partName: z.string().trim().min(2).max(180),
  customerNotes: z.string().trim().max(1200).optional(),
  selectedMatchSnapshot: z.unknown().optional(),
});

export async function POST(req: Request) {
  try {
    const { session } = await requirePartsFinderMembership("RESULTS");
    const settings = await getVerifiedPartSettings();
    if (!settings.enabled) {
      return NextResponse.json({ ok: false, error: "Verified Part Request service is currently unavailable." }, { status: 409 });
    }
    const input = schema.parse(await req.json());
    if (input.userVehicleId) {
      const ownedVehicle = await prisma.userVehicle.findFirst({
        where: { id: input.userVehicleId, userId: session.user.id },
        select: { id: true },
      });
      if (!ownedVehicle) {
        return NextResponse.json({ ok: false, error: "Selected vehicle was not found in your garage." }, { status: 404 });
      }
    }
    const requestNumber = await nextVerifiedPartRequestNumber();
    const created = await prisma.verifiedPartRequest.create({
      data: {
        requestNumber,
        userId: session.user.id,
        userVehicleId: input.userVehicleId ?? null,
        partsFinderSearchId: input.partsFinderSearchId ?? null,
        selectedMatchId: input.selectedMatchId ?? null,
        vin: input.vin ?? null,
        vehicleYear: input.vehicleYear ?? null,
        vehicleMake: input.vehicleMake ?? null,
        vehicleModel: input.vehicleModel ?? null,
        vehicleEngine: input.vehicleEngine ?? null,
        partName: input.partName,
        customerNotes: input.customerNotes ?? null,
        selectedMatchSnapshot: (input.selectedMatchSnapshot as object | undefined) ?? undefined,
        status: "AWAITING_PAYMENT",
        verificationFee: settings.feeAmount,
        currency: settings.currency,
      },
    });
    await prisma.auditLog.create({
      data: {
        actorId: session.user.id,
        action: "verified_part_request.created",
        entityType: "VerifiedPartRequest",
        entityId: created.id,
        metadataJson: { requestNumber: created.requestNumber, status: created.status },
      },
    });
    return NextResponse.json({ ok: true, request: created, paymentRequired: true });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json(
        {
          ok: false,
          code: "AUTH_REQUIRED",
          error: "Please sign in to continue.",
          redirectTo: "/login?callbackUrl=/parts-finder/search",
        },
        { status: 401 },
      );
    }
    return NextResponse.json(
      { ok: false, error: "We could not complete this action. Please try again." },
      { status: 400 },
    );
  }
}
