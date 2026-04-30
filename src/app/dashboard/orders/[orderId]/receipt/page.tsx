import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ReceiptPdfPreview } from "@/components/receipts/receipt-pdf-preview";
import { PageHeading } from "@/components/typography/page-headings";
import { ReceiptStatus } from "@prisma/client";

import { requireSessionOrRedirect } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ orderId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { orderId } = await params;
  return { title: `Receipt · ${orderId.slice(0, 8)}…` };
}

export default async function DashboardOrderReceiptPage({ params }: Props) {
  const { orderId } = await params;
  const session = await requireSessionOrRedirect(`/dashboard/orders/${orderId}/receipt`);
  const userId = session.user.id;

  const order = await prisma.order.findFirst({
    where: { id: orderId, userId },
    select: {
      id: true,
      reference: true,
      receiptReference: true,
      receiptPdfUrl: true,
    },
  });
  if (!order) notFound();

  let pdfUrl = order.receiptPdfUrl;
  if (!pdfUrl) {
    const gr = await prisma.generatedReceipt.findFirst({
      where: {
        orderId,
        userId,
        status: { in: [ReceiptStatus.ISSUED, ReceiptStatus.REGENERATED] },
      },
      orderBy: { issuedAt: "desc" },
      select: { pdfUrl: true, receiptNumber: true },
    });
    pdfUrl = gr?.pdfUrl ?? null;
  }
  if (!pdfUrl) notFound();

  const label = order.receiptReference ?? order.reference;

  return (
    <div>
      <PageHeading variant="dashboard" className="mb-2">
        Receipt · {label}
      </PageHeading>
      <p className="mb-6 text-sm text-zinc-500">Preview your official PDF receipt. You can open it in a new tab or download a copy.</p>
      <ReceiptPdfPreview
        pdfSrc={pdfUrl}
        backLabel="← Back to order"
        backHref={`/dashboard/orders/${orderId}`}
        downloadHref={`/api/orders/${orderId}/receipt/download`}
        documentTitle={`Receipt ${label}`}
      />
    </div>
  );
}
