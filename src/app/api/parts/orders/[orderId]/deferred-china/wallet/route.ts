import { DeliveryMode } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { payDeferredChinaFromWallet } from "@/lib/parts-china-pending-shipping";
import { safeAuth } from "@/lib/safe-auth";

const bodySchema = z.object({
  mode: z.nativeEnum(DeliveryMode).refine((m) => ["AIR_EXPRESS", "AIR_STANDARD", "SEA"].includes(m), {
    message: "Mode must be express air, standard air, or sea.",
  }),
});

type RouteParams = { params: Promise<{ orderId: string }> };

export async function POST(req: Request, { params }: RouteParams) {
  const session = await safeAuth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { orderId } = await params;
  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid mode." }, { status: 400 });
  }
  try {
    await payDeferredChinaFromWallet(session.user.id, orderId, parsed.data.mode);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Payment failed." },
      { status: 400 },
    );
  }
}
