import { OrderKind, PaymentType } from "@prisma/client";
import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth-helpers";
import { sendDepositBalanceReminderEmailSafe } from "@/lib/deposit-balance-reminder-email";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ orderId: string }> };

export async function POST(_req: Request, context: RouteContext) {
  try {
    await requireAdmin();
    const { orderId } = await context.params;

    const order = await prisma.order.findFirst({
      where: { id: orderId, kind: OrderKind.CAR, paymentType: PaymentType.RESERVATION_DEPOSIT },
      include: {
        user: { select: { email: true, name: true } },
        car: { select: { title: true } },
      },
    });
    if (!order?.user?.email) {
      return NextResponse.json({ error: "Order or customer email not found" }, { status: 404 });
    }

    const remaining = order.remainingBalance != null ? Number(order.remainingBalance) : 0;
    if (remaining <= 0) {
      return NextResponse.json({ error: "No outstanding balance" }, { status: 400 });
    }

    const emailResult = await sendDepositBalanceReminderEmailSafe({
      toEmail: order.user.email,
      customerName: order.user.name,
      orderReference: order.reference,
      carTitle: order.car?.title ?? null,
      remainingBalanceGhs: remaining,
      balanceDueAt: order.balanceDueAt,
    });

    await prisma.order.update({
      where: { id: orderId },
      data: {
        balanceReminderCount: { increment: 1 },
        lastBalanceReminderAt: new Date(),
      },
    });

    return NextResponse.json({ ok: true, email: emailResult });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "";
    if (msg === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (msg === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    console.error("[send deposit reminder]", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
