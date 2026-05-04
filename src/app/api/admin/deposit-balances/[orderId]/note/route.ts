import { OrderKind, PaymentType } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  note: z.string().min(1).max(8000),
});

type RouteContext = { params: Promise<{ orderId: string }> };

export async function POST(req: Request, context: RouteContext) {
  try {
    await requireAdmin();
    const { orderId } = await context.params;
    const body = await req.json().catch(() => null);
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const order = await prisma.order.findFirst({
      where: { id: orderId, kind: OrderKind.CAR, paymentType: PaymentType.RESERVATION_DEPOSIT },
      select: { id: true, balanceCollectionNote: true },
    });
    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    const prev = order.balanceCollectionNote?.trim() ?? "";
    const next = [prev, parsed.data.note.trim()].filter(Boolean).join("\n\n");
    await prisma.order.update({
      where: { id: orderId },
      data: { balanceCollectionNote: next || null },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "";
    if (msg === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (msg === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    console.error("[deposit balance note]", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
