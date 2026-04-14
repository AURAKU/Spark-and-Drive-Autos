import { NextResponse } from "next/server";
import { z } from "zod";

import { partOutOfStockCustomerMessage, partQuantityExceedsStockMessage } from "@/lib/parts-stock-customer";
import { prisma } from "@/lib/prisma";
import { safeAuth } from "@/lib/safe-auth";

const createSchema = z.object({
  partId: z.string().cuid(),
  quantity: z.coerce.number().int().min(1).max(99).default(1),
});

const updateSchema = z.object({
  itemId: z.string().cuid(),
  quantity: z.coerce.number().int().min(1).max(99).optional(),
  selected: z.boolean().optional(),
});

async function getOrCreateCart(userId: string) {
  return prisma.partCart.upsert({
    where: { userId },
    create: { userId },
    update: {},
  });
}

async function getCartCount(userId: string) {
  const agg = await prisma.partCartItem.aggregate({
    where: { cart: { userId } },
    _sum: { quantity: true },
  });
  return Number(agg._sum.quantity ?? 0);
}

export async function GET() {
  const session = await safeAuth();
  if (!session?.user?.id) return NextResponse.json({ count: 0 });
  const count = await getCartCount(session.user.id);
  return NextResponse.json({ count });
}

export async function POST(req: Request) {
  const session = await safeAuth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  const part = await prisma.part.findUnique({
    where: { id: parsed.data.partId },
    select: { id: true, listingState: true, stockQty: true, title: true },
  });
  if (!part || part.listingState !== "PUBLISHED") return NextResponse.json({ error: "Part not available" }, { status: 404 });
  if (part.stockQty < 1) {
    return NextResponse.json(
      { error: partOutOfStockCustomerMessage(part.title), code: "OUT_OF_STOCK" as const },
      { status: 409 },
    );
  }
  if (parsed.data.quantity > part.stockQty) {
    return NextResponse.json(
      {
        error: partQuantityExceedsStockMessage(part.title, parsed.data.quantity, part.stockQty),
        code: "INSUFFICIENT_STOCK" as const,
        availableQty: part.stockQty,
        requestedQty: parsed.data.quantity,
      },
      { status: 409 },
    );
  }

  const cart = await getOrCreateCart(session.user.id);
  const existing = await prisma.partCartItem.findUnique({
    where: { cartId_partId: { cartId: cart.id, partId: part.id } },
    select: { id: true, quantity: true },
  });
  if (existing) {
    await prisma.partCartItem.update({
      where: { id: existing.id },
      data: { selected: true },
    });
    const count = await getCartCount(session.user.id);
    return NextResponse.json({ ok: true, alreadyInCart: true, count });
  }

  const qty = parsed.data.quantity;
  await prisma.partCartItem.upsert({
    where: { cartId_partId: { cartId: cart.id, partId: part.id } },
    create: { cartId: cart.id, partId: part.id, quantity: qty, selected: true },
    update: { quantity: qty, selected: true },
  });
  const count = await getCartCount(session.user.id);
  return NextResponse.json({ ok: true, count });
}

export async function PATCH(req: Request) {
  const session = await safeAuth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  const item = await prisma.partCartItem.findFirst({
    where: { id: parsed.data.itemId, cart: { userId: session.user.id } },
    include: { part: { select: { stockQty: true, title: true } } },
  });
  if (!item) return NextResponse.json({ error: "Cart item not found" }, { status: 404 });

  if (parsed.data.quantity != null) {
    if (item.part.stockQty < 1) {
      return NextResponse.json(
        { error: partOutOfStockCustomerMessage(item.part.title), code: "OUT_OF_STOCK" as const },
        { status: 409 },
      );
    }
    if (parsed.data.quantity > item.part.stockQty) {
      return NextResponse.json(
        {
          error: partQuantityExceedsStockMessage(item.part.title, parsed.data.quantity, item.part.stockQty),
          code: "INSUFFICIENT_STOCK" as const,
          availableQty: item.part.stockQty,
          requestedQty: parsed.data.quantity,
        },
        { status: 409 },
      );
    }
  }

  const nextQty = parsed.data.quantity != null ? parsed.data.quantity : item.quantity;
  await prisma.partCartItem.update({
    where: { id: item.id },
    data: {
      quantity: nextQty,
      ...(parsed.data.selected != null ? { selected: parsed.data.selected } : {}),
    },
  });
  const count = await getCartCount(session.user.id);
  return NextResponse.json({ ok: true, count });
}

export async function DELETE(req: Request) {
  const session = await safeAuth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const itemId = url.searchParams.get("itemId");
  const clear = url.searchParams.get("clear");
  if (clear === "1") {
    const cart = await prisma.partCart.findUnique({ where: { userId: session.user.id }, select: { id: true } });
    if (cart) await prisma.partCartItem.deleteMany({ where: { cartId: cart.id } });
    return NextResponse.json({ ok: true, cleared: true, count: 0 });
  }
  if (!itemId) return NextResponse.json({ error: "Missing item id" }, { status: 400 });
  await prisma.partCartItem.deleteMany({
    where: { id: itemId, cart: { userId: session.user.id } },
  });
  const count = await getCartCount(session.user.id);
  return NextResponse.json({ ok: true, count });
}
