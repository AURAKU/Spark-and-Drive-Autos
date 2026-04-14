import { ProfilePartReviews } from "@/components/dashboard/profile-part-reviews";
import { PageHeading } from "@/components/typography/page-headings";
import { requireSessionOrRedirect } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

import { ProfileClient } from "./profile-client";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const session = await requireSessionOrRedirect("/dashboard/profile");
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      name: true,
      ghanaCardIdNumber: true,
      ghanaCardImageUrl: true,
      walletBalance: true,
      addresses: {
        orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
        select: {
          id: true,
          fullName: true,
          phone: true,
          region: true,
          city: true,
          district: true,
          locality: true,
          digitalAddress: true,
          streetAddress: true,
          landmark: true,
          notes: true,
          isDefault: true,
        },
      },
    },
  });

  return (
    <div>
      <PageHeading variant="dashboard">Profile</PageHeading>
      <p className="mt-2 text-sm text-zinc-400">
        Manage your Ghana delivery addresses, Ghana Card verification, and parts storefront wallet.
      </p>
      <ProfilePartReviews userId={session.user.id} />
      <div className="mt-8">
        <ProfileClient
          email={user?.email}
          name={user?.name}
          ghanaCardIdNumber={user?.ghanaCardIdNumber ?? null}
          ghanaCardImageUrl={user?.ghanaCardImageUrl ?? null}
          walletBalance={Number(user?.walletBalance ?? 0)}
          addresses={user?.addresses ?? []}
        />
      </div>
    </div>
  );
}
