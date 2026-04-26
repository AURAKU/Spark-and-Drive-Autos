import { NextResponse } from "next/server";

import { isAdminRole } from "@/auth";
import { getRequestIp } from "@/lib/client-ip";
import { prisma } from "@/lib/prisma";
import { safeAuth } from "@/lib/safe-auth";

type Ctx = { params: Promise<{ receiptId: string }> };

export async function GET(req: Request, ctx: Ctx) {
  const session = await safeAuth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { receiptId } = await ctx.params;
  const receipt = await prisma.generatedReceipt.findUnique({
    where: { id: receiptId },
    select: { id: true, userId: true, pdfUrl: true },
  });
  if (!receipt) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const isAdmin = isAdminRole(session.user.role);
  if (!isAdmin && receipt.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  await prisma.receiptAuditLog.create({
    data: {
      receiptId,
      actorId: session.user.id,
      action: isAdmin ? "RECEIPT_DOWNLOADED_BY_ADMIN" : "RECEIPT_DOWNLOADED_BY_CUSTOMER",
      metadata: { ip: getRequestIp(req) },
    },
  });
  return NextResponse.redirect(new URL(receipt.pdfUrl, req.url));
}
