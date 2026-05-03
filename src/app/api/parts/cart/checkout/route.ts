import { NextResponse } from "next/server";
import { z } from "zod";

import { createPartsWalletOrder } from "@/lib/parts-checkout";
import { optionsFromCartRow } from "@/lib/part-variant-options";
import { isChinaPreOrderPart } from "@/lib/part-china-preorder-delivery";
import { isPartsStockError } from "@/lib/parts-stock-customer";
import { getRequestIp } from "@/lib/client-ip";
import { prisma } from "@/lib/prisma";
import { recordSecurityObservation } from "@/lib/security-observation";
import { safeAuth } from "@/lib/safe-auth";
import { requireVerification } from "@/lib/identity-verification";
import { assertProfileLegalCompleteOrResponse } from "@/lib/legal-compliance-central";

const schema = z.object({
  addressId: z.string().cuid(),
  itemIds: z.array(z.string().cuid()).optional(),
  requestKey: z.string().min(8).max(80).optional(),
  agreementAccepted: z.boolean().optional().default(true),
  agreementVersion: z.string().min(1).max(40),
  /** Required when the cart includes any China-origin parts. */
  chinaShippingChoice: z.enum(["AIR", "SEA"]).optional(),
  dispatchPhone: z.string().max(40).optional().transform((s) => (s?.trim() ? s.trim() : undefined)),
  deliveryInstructions: z
    .string()
    .max(2000)
    .optional()
    .transform((s) => (s?.trim() ? s.trim() : null)),
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

  const legalBlock = await assertProfileLegalCompleteOrResponse(session.user.id);
  if (legalBlock) return legalBlock;
  const cart = await prisma.partCart.findUnique({
    where: { userId: session.user.id },
    include: {
      items: {
        where: {
          selected: true,
          ...(parsed.data.itemIds?.length ? { id: { in: parsed.data.itemIds } } : {}),
        },
        select: { id: true, partId: true, quantity: true, optColor: true, optSize: true, optType: true },
      },
    },
  });
  if (!cart || cart.items.length === 0) {
    return NextResponse.json({ error: "No selected cart items found." }, { status: 400 });
  }

  const partMeta = await prisma.part.findMany({
    where: { id: { in: cart.items.map((i) => i.partId) } },
    select: { id: true, origin: true, stockStatus: true, priceGhs: true },
  });
  const byId = new Map(partMeta.map((p) => [p.id, p]));
  const needsChinaShippingChoice = cart.items.some((i) => {
    const p = byId.get(i.partId);
    return p?.origin === "CHINA" && !isChinaPreOrderPart(p);
  });
  if (needsChinaShippingChoice && !parsed.data.chinaShippingChoice) {
    return NextResponse.json(
      { error: "Select Air or Sea shipping for China in-stock items (not required for China pre-orders only)." },
      { status: 400 },
    );
  }
  const estimatedAmountGhs = cart.items.reduce((sum, item) => {
    const meta = byId.get(item.partId);
    if (!meta) return sum;
    return sum + Number(meta.priceGhs) * item.quantity;
  }, 0);
  try {
    await requireVerification({
      userId: session.user.id,
      context: "HIGH_VALUE_PAYMENT",
      amountGhs: estimatedAmountGhs,
      ipAddress: getRequestIp(req),
      userAgent: req.headers.get("user-agent"),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "IDENTITY_VERIFICATION_REQUIRED") {
      return NextResponse.json(
        {
          error:
            "Identity verification is required before this checkout can continue. Submit verification under Dashboard → Verification.",
          code: "IDENTITY_VERIFICATION_REQUIRED",
        },
        { status: 409 },
      );
    }
    throw error;
  }

  try {
    const order = await createPartsWalletOrder({
      userId: session.user.id,
      addressId: parsed.data.addressId,
      items: cart.items.map((i) => ({
        partId: i.partId,
        quantity: i.quantity,
        options: optionsFromCartRow(i),
        cartItemId: i.id,
      })),
      clearFromCart: true,
      clearCartItemIds: cart.items.map((i) => i.id),
      requestKey: parsed.data.requestKey,
      agreementVersion: parsed.data.agreementVersion,
      chinaShippingChoice: parsed.data.chinaShippingChoice,
      dispatchPhone: parsed.data.dispatchPhone,
      deliveryInstructions: parsed.data.deliveryInstructions,
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
