import { NextResponse } from "next/server";
import { z } from "zod";

import { verifyDeferredChinaPaystack } from "@/lib/parts-china-pending-shipping";
import { safeAuth } from "@/lib/safe-auth";

const bodySchema = z.object({
  reference: z.string().min(6).max(120),
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
    return NextResponse.json({ error: "Invalid reference." }, { status: 400 });
  }
  try {
    const out = await verifyDeferredChinaPaystack(session.user.id, orderId, parsed.data.reference);
    return NextResponse.json(out);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Verification failed." },
      { status: 400 },
    );
  }
}
