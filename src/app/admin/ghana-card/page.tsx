import { GhanaCardVerificationStatus } from "@prisma/client";
import { redirect } from "next/navigation";

import { GhanaCardReviewTable } from "@/components/admin/ghana-card-review-table";
import { PageHeading } from "@/components/typography/page-headings";
import { prisma } from "@/lib/prisma";
import { isAdminRole } from "@/lib/roles";
import { safeAuth } from "@/lib/safe-auth";

export const dynamic = "force-dynamic";

export default async function AdminGhanaCardPage() {
  const session = await safeAuth();
  if (!session?.user?.id) redirect("/login?callbackUrl=" + encodeURIComponent("/admin/ghana-card"));
  if (!session.user.role || !isAdminRole(session.user.role)) redirect("/admin");

  await prisma.user.updateMany({
    where: {
      ghanaCardVerificationStatus: GhanaCardVerificationStatus.APPROVED,
      ghanaCardExpiresAt: { lt: new Date() },
    },
    data: { ghanaCardVerificationStatus: GhanaCardVerificationStatus.EXPIRED },
  });

  const [pendingRows, expiredRows] = await Promise.all([
    prisma.user.findMany({
      where: { ghanaCardVerificationStatus: GhanaCardVerificationStatus.PENDING_REVIEW },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        email: true,
        name: true,
        ghanaCardPendingImageUrl: true,
        ghanaCardPendingIdNumber: true,
        ghanaCardAiSuggestedNumber: true,
        ghanaCardPendingExpiresAt: true,
        updatedAt: true,
      },
      take: 200,
    }),
    prisma.user.findMany({
      where: { ghanaCardVerificationStatus: GhanaCardVerificationStatus.EXPIRED },
      orderBy: { ghanaCardExpiresAt: "asc" },
      select: {
        id: true,
        email: true,
        name: true,
        ghanaCardIdNumber: true,
        ghanaCardExpiresAt: true,
        ghanaCardImageUrl: true,
      },
      take: 500,
    }),
  ]);

  return (
    <div>
      <PageHeading variant="dashboard">Identification Verification Review</PageHeading>
      <p className="mt-2 text-sm text-muted-foreground">
        Pending uploads are temporary until approval. Expired IDs are auto-detected and listed for admin reset.
      </p>
      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        <span className="rounded-full border border-amber-300/30 bg-amber-500/10 px-3 py-1 text-amber-100">
          Pending: {pendingRows.length}
        </span>
        <span className="rounded-full border border-red-300/30 bg-red-500/10 px-3 py-1 text-red-100">
          Expired: {expiredRows.length}
        </span>
      </div>
      <div className="mt-8">
        <GhanaCardReviewTable
          pendingRows={pendingRows.map((r) => ({
            id: r.id,
            email: r.email,
            name: r.name,
            ghanaCardImageUrl: r.ghanaCardPendingImageUrl,
            ghanaCardPendingIdNumber: r.ghanaCardPendingIdNumber,
            ghanaCardAiSuggestedNumber: r.ghanaCardAiSuggestedNumber,
            ghanaCardPendingExpiresAt: r.ghanaCardPendingExpiresAt,
            updatedAt: r.updatedAt,
          }))}
          expiredRows={expiredRows.map((r) => ({
            id: r.id,
            email: r.email,
            name: r.name,
            ghanaCardIdNumber: r.ghanaCardIdNumber,
            ghanaCardExpiresAt: r.ghanaCardExpiresAt,
            ghanaCardImageUrl: r.ghanaCardImageUrl,
          }))}
        />
      </div>
    </div>
  );
}
