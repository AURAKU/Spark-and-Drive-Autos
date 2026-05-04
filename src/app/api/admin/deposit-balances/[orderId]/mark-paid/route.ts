import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth-helpers";
import { markVehicleDepositBalancePaidAdmin } from "@/lib/vehicle-deposit-admin-actions";

const bodySchema = z.object({
  note: z.string().max(4000).optional(),
  manualReference: z.string().max(160).optional(),
});

type RouteContext = { params: Promise<{ orderId: string }> };

export async function POST(req: Request, context: RouteContext) {
  try {
    const session = await requireAdmin();
    const { orderId } = await context.params;
    const body = await req.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const r = await markVehicleDepositBalancePaidAdmin({
      orderId,
      adminUserId: session.user.id,
      note: parsed.data.note,
      manualReference: parsed.data.manualReference,
    });
    if (!r.ok) {
      return NextResponse.json({ error: r.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "";
    if (msg === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (msg === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    console.error("[mark-paid deposit balance]", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
