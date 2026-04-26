import { NextResponse } from "next/server";
import { z } from "zod";

import { isChinaPreOrderPart } from "@/lib/part-china-preorder-delivery";
import { partOutOfStockCustomerMessage, partQuantityExceedsStockMessage } from "@/lib/parts-stock-customer";
import {
  computeVariantKey,
  parsePartOptionsMeta,
  validateSelectionAgainstPart,
} from "@/lib/part-variant-options";
import { prisma } from "@/lib/prisma";
import { safeAuth } from "@/lib/safe-auth";

const optStr = z
  .string()
  .max(120)
  .optional()
  .transform((s) => (s?.trim() ? s.trim() : undefined));

const createSchema = z.object({
  partId: z.string().cuid(),
  quantity: z.coerce.number().int().min(1).max(99).default(1),
  color: optStr,
  size: optStr,
  partType: optStr,
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
    select: {
      id: true,
      listingState: true,
      stockQty: true,
      title: true,
      origin: true,
      stockStatus: true,
      metaJson: true,
    },
  });
  if (!part || part.listingState !== "PUBLISHED") return NextResponse.json({ error: "Part not available" }, { status: 404 });

  const lists = parsePartOptionsMeta(part.metaJson);
  const opt = {
    color: parsed.data.color,
    size: parsed.data.size,
    partType: parsed.data.partType,
  };
  const v = validateSelectionAgainstPart(lists, opt);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
  const variantKey = computeVariantKey(opt);
  const optColor = opt.color?.trim() || null;
  const optSize = opt.size?.trim() || null;
  const optType = opt.partType?.trim() || null;

  const preorder = isChinaPreOrderPart(part);
  if (!preorder && part.stockQty < 1) {
    return NextResponse.json(
      { error: partOutOfStockCustomerMessage(part.title), code: "OUT_OF_STOCK" as const },
      { status: 409 },
    );
  }

  const cart = await getOrCreateCart(session.user.id);
  const existing = await prisma.partCartItem.findFirst({
    where: { cartId: cart.id, partId: part.id, variantKey },
    select: { id: true, quantity: true },
  });

  if (existing) {
    await prisma.partCartItem.update({
      where: { id: existing.id },
      data: { selected: true, optColor, optSize, optType, variantKey },
    });
    const count = await getCartCount(session.user.id);
    return NextResponse.json({ ok: true, alreadyInCart: true, count });
  }

  const otherLines = await prisma.partCartItem.findMany({
    where: { cartId: cart.id, partId: part.id },
    select: { quantity: true },
  });
  const qtyOther = otherLines.reduce((s, l) => s + l.quantity, 0);
  const qty = parsed.data.quantity;
  if (!preorder) {
    const newTotal = qtyOther + qty;
    if (newTotal > part.stockQty) {
      if (part.stockQty < 1) {
        return NextResponse.json(
          { error: partOutOfStockCustomerMessage(part.title), code: "OUT_OF_STOCK" as const },
          { status: 409 },
        );
      }
      return NextResponse.json(
        {
          error: partQuantityExceedsStockMessage(part.title, newTotal, part.stockQty),
          code: "INSUFFICIENT_STOCK" as const,
          availableQty: part.stockQty,
          requestedQty: newTotal,
        },
        { status: 409 },
      );
    }
  }

  await prisma.partCartItem.create({
    data: {
      cartId: cart.id,
      partId: part.id,
      quantity: qty,
      selected: true,
      optColor,
      optSize,
      optType,
      variantKey,
    },
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
    include: {
      part: { select: { id: true, stockQty: true, title: true, origin: true, stockStatus: true } },
    },
  });
  if (!item) return NextResponse.json({ error: "Cart item not found" }, { status: 404 });

  const preorder = isChinaPreOrderPart(item.part);
  const nextQty = parsed.data.quantity != null ? parsed.data.quantity : item.quantity;
  if (!preorder) {
    if (item.part.stockQty < 1) {
      return NextResponse.json(
        { error: partOutOfStockCustomerMessage(item.part.title), code: "OUT_OF_STOCK" as const },
        { status: 409 },
      );
    }
    const otherLines = await prisma.partCartItem.aggregate({
      where: { cartId: item.cartId, partId: item.partId, NOT: { id: item.id } },
      _sum: { quantity: true },
    });
    const otherSum = Number(otherLines._sum.quantity ?? 0);
    const newTotal = otherSum + nextQty;
    if (newTotal > item.part.stockQty) {
      return NextResponse.json(
        {
          error: partQuantityExceedsStockMessage(item.part.title, newTotal, item.part.stockQty),
          code: "INSUFFICIENT_STOCK" as const,
          availableQty: item.part.stockQty,
          requestedQty: newTotal,
        },
        { status: 409 },
      );
    }
  }

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
