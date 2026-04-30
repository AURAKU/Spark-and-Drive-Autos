import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";

import { requirePartsFinderMembership } from "@/lib/parts-finder/access";
import { prisma } from "@/lib/prisma";
import { nextVerifiedPartRequestNumber, getVerifiedPartSettings } from "@/lib/verified-parts";

const schema = z.object({
  partsFinderSearchId: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().optional(),
  ),
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

    let partsFinderSearchDbId: string | null = null;
    const rawSearchKey = input.partsFinderSearchId?.trim();
    if (rawSearchKey) {
      const searchSession = await prisma.partsFinderSearchSession.findFirst({
        where: {
          userId: session.user.id,
          OR: [{ id: rawSearchKey }, { sessionId: rawSearchKey }],
        },
        select: { id: true },
      });
      if (!searchSession) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Parts Finder search could not be found or is no longer linked to your account. Open this page again from your Parts Finder results.",
          },
          { status: 400 },
        );
      }
      partsFinderSearchDbId = searchSession.id;
    }

    const requestNumber = await nextVerifiedPartRequestNumber();
    let created;
    try {
      created = await prisma.verifiedPartRequest.create({
        data: {
          requestNumber,
          userId: session.user.id,
          userVehicleId: input.userVehicleId ?? null,
          partsFinderSearchId: partsFinderSearchDbId,
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
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2003") {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Could not link this request to Parts Finder (reference invalid). Go back to your search results and try again.",
          },
          { status: 400 },
        );
      }
      throw err;
    }
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
