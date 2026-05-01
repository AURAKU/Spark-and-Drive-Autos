import { NextResponse } from "next/server";

import { ReceiptStatus } from "@prisma/client";

import { isAdminRole } from "@/auth";
import { getRequestIp } from "@/lib/client-ip";
import { prisma } from "@/lib/prisma";
import { resolveReceiptPdfBytes, sanitizeReceiptDownloadFilename } from "@/lib/receipt-pdf-files";
import { safeAuth } from "@/lib/safe-auth";

type Ctx = { params: Promise<{ orderId: string }> };

export async function GET(req: Request, ctx: Ctx) {
  const session = await safeAuth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { orderId } = await ctx.params;
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      userId: true,
      receiptPdfUrl: true,
      receiptReference: true,
      reference: true,
    },
  });
  if (!order) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const isAdmin = isAdminRole(session.user.role);
  if (!isAdmin && order.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const generated = await prisma.generatedReceipt.findFirst({
    where: { orderId, status: { in: [ReceiptStatus.ISSUED, ReceiptStatus.REGENERATED] } },
    orderBy: { issuedAt: "desc" },
    select: { id: true, pdfUrl: true, receiptNumber: true },
  });

  const pdfUrl = order.receiptPdfUrl ?? generated?.pdfUrl ?? null;
  if (!pdfUrl) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const filename = sanitizeReceiptDownloadFilename(
    order.receiptReference ?? generated?.receiptNumber ?? order.reference,
  );

  await prisma.receiptAuditLog.create({
    data: {
      receiptId: generated?.id ?? null,
      actorId: session.user.id,
      action: isAdmin ? "RECEIPT_DOWNLOADED_BY_ADMIN" : "RECEIPT_DOWNLOADED_BY_CUSTOMER",
      metadata: {
        ip: getRequestIp(req),
        source: "order_receipt_download",
        pdfSource: order.receiptPdfUrl ? "order.receiptPdfUrl" : "generatedReceipt.pdfUrl",
        orderId: order.id,
      },
    },
  });

  const bytes = await resolveReceiptPdfBytes(pdfUrl);
  if (bytes) {
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }

  const target = pdfUrl.trim();
  if (target.startsWith("/") || /^https?:\/\//i.test(target)) {
    return NextResponse.redirect(new URL(target, req.url));
  }
  return NextResponse.json({ error: "Receipt file not available" }, { status: 404 });
}
