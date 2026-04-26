import { VerificationClient } from "@/components/dashboard/verification-client";
import { PageHeading } from "@/components/typography/page-headings";
import { prisma } from "@/lib/prisma";
import { requireActiveSessionOrRedirect } from "@/lib/auth-helpers";

export const dynamic = "force-dynamic";

export default async function DashboardVerificationPage() {
  const session = await requireActiveSessionOrRedirect("/dashboard/verification");
  const latest = await prisma.userVerification.findFirst({
    where: { userId: session.user.id },
    orderBy: [{ submittedAt: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      status: true,
      documentType: true,
      reason: true,
      rejectionReason: true,
      submittedAt: true,
      reviewedAt: true,
      expiresAt: true,
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <PageHeading variant="dashboard">Identity verification</PageHeading>
        <p className="mt-2 max-w-3xl text-sm text-zinc-400">
          We only request ID verification for justified high-risk or high-value actions (payments, sourcing, disputes, or fraud checks).
        </p>
      </div>
      <VerificationClient
        latest={
          latest
            ? {
                ...latest,
                submittedAt: latest.submittedAt.toISOString(),
                reviewedAt: latest.reviewedAt?.toISOString() ?? null,
                expiresAt: latest.expiresAt?.toISOString() ?? null,
              }
            : null
        }
      />
    </div>
  );
}
