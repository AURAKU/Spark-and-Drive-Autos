import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ReceiptStatus } from "@prisma/client";

import { ReceiptPdfPreview } from "@/components/receipts/receipt-pdf-preview";
import { PageHeading } from "@/components/typography/page-headings";
import { requireAdmin } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ orderId: string }> };

export async function generateMetadata(): Promise<Metadata> {
  return { title: "Order receipt (admin)" };
}

export default async function AdminOrderReceiptPage({ params }: Props) {
  await requireAdmin();
  const { orderId } = await params;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
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
      where: { orderId, status: { in: [ReceiptStatus.ISSUED, ReceiptStatus.REGENERATED] } },
      orderBy: { issuedAt: "desc" },
      select: { pdfUrl: true },
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
      <p className="mb-6 text-sm text-zinc-500">Admin preview of the customer PDF receipt.</p>
      <ReceiptPdfPreview
        pdfSrc={pdfUrl}
        backLabel="← Back to order"
        backHref={`/admin/orders/${orderId}`}
        downloadHref={`/api/orders/${orderId}/receipt/download`}
        documentTitle={`Receipt ${label}`}
      />
    </div>
  );
}
