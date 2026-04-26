import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await context.params;
    const dispute = await prisma.disputeCase.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, email: true, name: true } },
        payment: { select: { id: true, providerReference: true, status: true, amount: true, currency: true } },
        order: { select: { id: true, reference: true, orderStatus: true } },
        receipt: { select: { id: true, receiptNumber: true, status: true, issuedAt: true, pdfUrl: true } },
        evidence: { orderBy: { createdAt: "asc" } },
        timeline: { orderBy: { createdAt: "asc" } },
      },
    });
    if (!dispute) return NextResponse.json({ error: "Dispute not found." }, { status: 404 });

    const packet = {
      exportedAt: new Date().toISOString(),
      case: {
        id: dispute.id,
        caseNumber: dispute.caseNumber,
        type: dispute.type,
        status: dispute.status,
        priority: dispute.priority,
        reason: dispute.reason,
        customerClaim: dispute.customerClaim,
        adminSummary: dispute.adminSummary,
        resolution: dispute.resolution,
        openedAt: dispute.openedAt,
        dueAt: dispute.dueAt,
        resolvedAt: dispute.resolvedAt,
      },
      customer: dispute.user,
      payment: dispute.payment,
      order: dispute.order,
      receipt: dispute.receipt,
      evidence: dispute.evidence,
      timeline: dispute.timeline,
    };

    return new NextResponse(JSON.stringify(packet, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${dispute.caseNumber}-packet.json"`,
      },
    });
  } catch (error) {
    console.error("[GET /api/admin/disputes/[id]/export]", error);
    return NextResponse.json({ error: "Failed to export dispute packet." }, { status: 500 });
  }
}
