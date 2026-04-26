import { NextResponse } from "next/server";

import { getDeferredChinaContextForUser } from "@/lib/parts-china-pending-shipping";
import { computeThreeModeChinaQuotesForPartIds } from "@/lib/shipping/parts-china-fees";
import { safeAuth } from "@/lib/safe-auth";

type RouteParams = { params: Promise<{ orderId: string }> };

export async function GET(_req: Request, { params }: RouteParams) {
  const session = await safeAuth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { orderId } = await params;
  const ctx = await getDeferredChinaContextForUser(orderId, session.user.id);
  if (!ctx) {
    return NextResponse.json({ error: "No pending China pre-order international shipping for this order." }, { status: 404 });
  }
  const quote = await computeThreeModeChinaQuotesForPartIds(ctx.preOrderPartIds);
  return NextResponse.json(quote);
}
