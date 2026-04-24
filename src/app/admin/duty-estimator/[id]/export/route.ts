import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth-helpers";
import { getVehicleImportEstimateById } from "@/lib/vehicle-import-estimate/data";
import { buildVehicleImportEstimatePdf } from "@/lib/vehicle-import-estimate/pdf";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await context.params;
    if (!z.string().cuid().safeParse(id).success) {
      return NextResponse.json({ error: "Invalid estimate id." }, { status: 400 });
    }

    const e = await getVehicleImportEstimateById(id);
    if (!e) return NextResponse.json({ error: "Estimate not found." }, { status: 404 });
    const pdf = await buildVehicleImportEstimatePdf(e);

    return new NextResponse(Buffer.from(pdf), {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="${e.estimateNumber}.pdf"`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to generate estimate export." },
      { status: 500 },
    );
  }
}
