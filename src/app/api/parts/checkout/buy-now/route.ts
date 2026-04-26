import { NextResponse } from "next/server";
import { z } from "zod";

import { createPartsWalletOrder } from "@/lib/parts-checkout";
import { isChinaPreOrderPart } from "@/lib/part-china-preorder-delivery";
import { isPartsStockError } from "@/lib/parts-stock-customer";
import { prisma } from "@/lib/prisma";
import { safeAuth } from "@/lib/safe-auth";

const schema = z.object({
  partId: z.string().cuid(),
  quantity: z.coerce.number().int().min(1).max(99).default(1),
  color: z.string().max(120).optional().transform((s) => (s?.trim() ? s.trim() : undefined)),
  size: z.string().max(120).optional().transform((s) => (s?.trim() ? s.trim() : undefined)),
  partType: z.string().max(120).optional().transform((s) => (s?.trim() ? s.trim() : undefined)),
  addressId: z.string().cuid(),
  requestKey: z.string().min(8).max(80).optional(),
  agreementAccepted: z.boolean(),
  agreementVersion: z.string().min(1).max(40),
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
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  if (!parsed.data.agreementAccepted) {
    return NextResponse.json({ error: "Checkout agreement is required." }, { status: 400 });
  }
  const part = await prisma.part.findUnique({
    where: { id: parsed.data.partId },
    select: { origin: true, stockStatus: true },
  });
  if (part && part.origin === "CHINA" && !isChinaPreOrderPart(part) && !parsed.data.chinaShippingChoice) {
    return NextResponse.json(
      { error: "Select Air or Sea for China in-stock; pre-orders from China do not add international at checkout." },
      { status: 400 },
    );
  }
  try {
    const { color, size, partType, partId, quantity, ...rest } = parsed.data;
    const order = await createPartsWalletOrder({
      userId: session.user.id,
      addressId: rest.addressId,
      items: [
        {
          partId,
          quantity,
          options: { color, size, partType },
        },
      ],
      clearFromCart: false,
      requestKey: rest.requestKey,
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
