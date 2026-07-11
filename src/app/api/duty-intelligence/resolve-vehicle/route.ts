import { NextResponse } from "next/server";

import { assertPublicCalculatorEnabled } from "@/lib/duty-intelligence/public-access";
import { minimumIntakeSchema } from "@/lib/duty-intelligence/intake-schema";
import { resolveVehicleSpec } from "@/lib/duty-intelligence/vehicle-spec-resolver";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const gate = await assertPublicCalculatorEnabled("GH");
    if (!gate.ok) {
      return NextResponse.json({ error: "CALCULATOR_DISABLED", message: gate.message }, { status: 503 });
    }

    const body = await req.json();
    const parsed = minimumIntakeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid vehicle input", details: parsed.error.flatten() }, { status: 400 });
    }

    const spec = await resolveVehicleSpec({
      input: parsed.data,
      vinDecodeEnabled: body.vinDecodeEnabled !== false,
    });

    return NextResponse.json({
      spec: {
        make: spec.make,
        model: spec.model,
        year: spec.year,
        fuelType: spec.fuelType,
        engineCc: spec.engineCc,
        powerKw: spec.powerKw,
        vehicleCategory: spec.vehicleCategory,
        countryOfOrigin: spec.countryOfOrigin,
        hsCode: spec.hsCode,
        source: spec.source,
        confidence: spec.confidence,
        inferredFields: spec.inferredFields,
        needsConfirmation: spec.needsConfirmation,
      },
    });
  } catch (error) {
    console.error("[duty-intelligence/resolve-vehicle]", error);
    return NextResponse.json({ error: "VEHICLE_RESOLVE_FAILED" }, { status: 500 });
  }
}
