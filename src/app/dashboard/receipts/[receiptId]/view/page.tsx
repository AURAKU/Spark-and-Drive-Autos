import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ReceiptPdfPreview } from "@/components/receipts/receipt-pdf-preview";
import { PageHeading } from "@/components/typography/page-headings";
import { ReceiptStatus } from "@prisma/client";

import { requireSessionOrRedirect } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ receiptId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { receiptId } = await params;
  return { title: `Receipt ${receiptId.slice(0, 8)}…` };
}

export default async function DashboardGeneratedReceiptViewPage({ params }: Props) {
  const { receiptId } = await params;
  const session = await requireSessionOrRedirect(`/dashboard/receipts/${receiptId}/view`);
  const userId = session.user.id;

  const receipt = await prisma.generatedReceipt.findFirst({
    where: {
      id: receiptId,
      userId,
      status: { in: [ReceiptStatus.ISSUED, ReceiptStatus.REGENERATED] },
    },
    select: { pdfUrl: true, receiptNumber: true, orderId: true },
  });
  if (!receipt) notFound();

  const backHref = receipt.orderId ? `/dashboard/orders/${receipt.orderId}` : "/dashboard/receipts";

  return (
    <div>
      <PageHeading variant="dashboard" className="mb-2">
        Receipt · {receipt.receiptNumber}
      </PageHeading>
      <p className="mb-6 text-sm text-zinc-500">Preview, open in a new tab, or download your receipt.</p>
      <ReceiptPdfPreview
        pdfSrc={receipt.pdfUrl}
        backLabel="← Back"
        backHref={backHref}
        downloadHref={`/api/receipts/${receiptId}/download`}
        documentTitle={`Receipt ${receipt.receiptNumber}`}
      />
    </div>
  );
}
