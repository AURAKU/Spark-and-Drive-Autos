import { DeliveryMode } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { createDeferredChinaPaystackSession } from "@/lib/parts-china-pending-shipping";
import { prisma } from "@/lib/prisma";
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
  const u = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { email: true },
  });
  const email = (u?.email?.trim() ? u.email : session.user.email)?.trim() ?? null;
  if (!email) {
    return NextResponse.json({ error: "Add an email to your account before card payment." }, { status: 400 });
  }
  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid mode." }, { status: 400 });
  }
  try {
    const out = await createDeferredChinaPaystackSession(
      session.user.id,
      email,
      orderId,
      parsed.data.mode,
    );
    return NextResponse.json(out);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not start Paystack." },
      { status: 400 },
    );
  }
}
