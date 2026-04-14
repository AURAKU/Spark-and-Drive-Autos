import { NextResponse } from "next/server";
import { z } from "zod";

import { createPartsWalletOrder } from "@/lib/parts-checkout";
import { isPartsStockError } from "@/lib/parts-stock-customer";
import { getRequestIp } from "@/lib/client-ip";
import { prisma } from "@/lib/prisma";
import { recordSecurityObservation } from "@/lib/security-observation";
import { safeAuth } from "@/lib/safe-auth";

const schema = z.object({
  addressId: z.string().cuid(),
  itemIds: z.array(z.string().cuid()).optional(),
  requestKey: z.string().min(8).max(80).optional(),
  agreementAccepted: z.boolean(),
  agreementVersion: z.string().min(1).max(40),
  /** Required when the cart includes any China-origin parts. */
  chinaShippingChoice: z.enum(["AIR", "SEA"]).optional(),
});

export async function POST(req: Request) {
  const session = await safeAuth();
  if (!session?.user?.id) {
    const ip = getRequestIp(req);
    await recordSecurityObservation({
      severity: "MEDIUM",
      channel: "PAYMENT",
      title: "Parts checkout API called without session",
      ipAddress: ip,
      userAgent: req.headers.get("user-agent"),
      path: "/api/parts/cart/checkout",
    });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  if (!parsed.data.agreementAccepted) {
    return NextResponse.json({ error: "Checkout agreement is required." }, { status: 400 });
  }
  const cart = await prisma.partCart.findUnique({
    where: { userId: session.user.id },
    include: {
      items: {
        where: {
          selected: true,
          ...(parsed.data.itemIds?.length ? { id: { in: parsed.data.itemIds } } : {}),
        },
        select: { id: true, partId: true, quantity: true },
      },
    },
  });
  if (!cart || cart.items.length === 0) {
    return NextResponse.json({ error: "No selected cart items found." }, { status: 400 });
  }

  const partMeta = await prisma.part.findMany({
    where: { id: { in: cart.items.map((i) => i.partId) } },
    select: { id: true, origin: true },
  });
  const originByPart = new Map(partMeta.map((p) => [p.id, p.origin]));
  const hasChina = cart.items.some((i) => originByPart.get(i.partId) === "CHINA");
  if (hasChina && !parsed.data.chinaShippingChoice) {
    return NextResponse.json({ error: "Select Air or Sea shipping for China-origin parts." }, { status: 400 });
  }

  try {
    const order = await createPartsWalletOrder({
      userId: session.user.id,
      addressId: parsed.data.addressId,
      items: cart.items.map((i) => ({ partId: i.partId, quantity: i.quantity })),
      clearFromCart: true,
      requestKey: parsed.data.requestKey,
      agreementVersion: parsed.data.agreementVersion,
      chinaShippingChoice: parsed.data.chinaShippingChoice,
    });
    return NextResponse.json({ ok: true, orderId: order.orderId, reference: order.reference });
  } catch (e) {
    if (isPartsStockError(e)) {
      return NextResponse.json(
        {
          error: e.message,
          code: e.code,
          partTitle: e.partTitle,
          availableQty: e.availableQty,
          requestedQty: e.requestedQty,
        },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: e instanceof Error ? e.message : "Checkout failed" }, { status: 400 });
  }
}
