import { NextResponse } from "next/server";

import { isAdminRole } from "@/auth";
import { getRequestIp } from "@/lib/client-ip";
import { prisma } from "@/lib/prisma";
import { resolveReceiptPdfBytes, sanitizeReceiptDownloadFilename } from "@/lib/receipt-pdf-files";
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
    select: { id: true, userId: true, pdfUrl: true, receiptNumber: true },
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
  const filename = sanitizeReceiptDownloadFilename(receipt.receiptNumber);
  const bytes = await resolveReceiptPdfBytes(receipt.pdfUrl);
  if (bytes) {
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }
  const target = receipt.pdfUrl.trim();
  if (target.startsWith("/") || /^https?:\/\//i.test(target)) {
    return NextResponse.redirect(new URL(target, req.url));
  }
  return NextResponse.json({ error: "Receipt file not available" }, { status: 404 });
}
