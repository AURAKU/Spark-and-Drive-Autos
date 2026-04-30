import { ProfilePartReviews } from "@/components/dashboard/profile-part-reviews";
import { VerificationClient } from "@/components/dashboard/verification-client";
import { PageHeading } from "@/components/typography/page-headings";
import { requireSessionOrRedirect } from "@/lib/auth-helpers";
import { getUserLegalStatusRows } from "@/lib/legal-profile";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

import { ProfileClient } from "./profile-client";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstQueryValue(sp: Record<string, string | string[] | undefined>, key: string): string | undefined {
  const v = sp[key];
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v.find((x): x is string => typeof x === "string");
  return undefined;
}

type ProfileView = "profile" | "verification";

function parseProfileView(raw: string | undefined): ProfileView {
  if (raw === "verification") return "verification";
  return "profile";
}

export default async function ProfilePage(props: { searchParams: SearchParams }) {
  const session = await requireSessionOrRedirect("/dashboard/profile");
  const searchParams = await props.searchParams;
  const view = parseProfileView(firstQueryValue(searchParams, "view"));
  const showReviews = firstQueryValue(searchParams, "reviews") === "1";
  let hadVerificationLoadError = false;
  let user: {
    id: string;
    email: string;
    name: string | null;
    ghanaCardIdNumber: string | null;
    ghanaCardImageUrl: string | null;
    walletBalance: unknown;
    addresses: {
      id: string;
      fullName: string;
      phone: string;
      region: string;
      city: string;
      district: string | null;
      locality: string | null;
      digitalAddress: string | null;
      streetAddress: string;
      landmark: string | null;
      notes: string | null;
      isDefault: boolean;
    }[];
  } | null = null;
  let legalRows: Awaited<ReturnType<typeof getUserLegalStatusRows>> = [];
  let latestVerification: {
    id: string;
    status: string;
    documentType: string;
    reason: string | null;
    rejectionReason: string | null;
    submittedAt: Date;
    reviewedAt: Date | null;
    expiresAt: Date | null;
  } | null = null;

  try {
    [user, legalRows, latestVerification] = await Promise.all([
      prisma.user.findUnique({
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
      }),
      getUserLegalStatusRows(session.user.id),
      prisma.userVerification.findFirst({
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
      }),
    ]);
  } catch (error) {
    hadVerificationLoadError = true;
    console.error("[dashboard/profile] Failed to load verification data", error);
  }

  return (
    <div>
      <PageHeading variant="dashboard">Profile</PageHeading>
      {view === "profile" ? (
        <p className="mt-2 text-sm text-zinc-400">
          Manage your Ghana delivery addresses and parts storefront wallet. Use{" "}
          <Link href="/dashboard/profile?view=verification" className="text-[var(--brand)] hover:underline">
            Identity verification
          </Link>{" "}
          for Ghana Card photo and ID number used at checkout and delivery.
        </p>
      ) : (
        <p className="mt-2 text-sm text-zinc-400">
          Ghana Card details for checkout and delivery, plus full identity verification for protected flows.
        </p>
      )}
      <div className="mt-5 inline-flex rounded-xl border border-border bg-muted/40 p-1 dark:border-white/10 dark:bg-white/[0.03]">
        {[
          { key: "profile" as const, label: "Profile" },
          { key: "verification" as const, label: "Identity verification" },
        ].map((item) => {
          const active = item.key === view;
          const href = item.key === "profile" ? "/dashboard/profile" : "/dashboard/profile?view=verification";
          return (
            <Link
              key={item.key}
              href={href}
              className={`rounded-lg px-3 py-1.5 text-sm transition ${
                active
                  ? "bg-[var(--brand)] text-black font-semibold"
                  : "text-muted-foreground hover:bg-background hover:text-foreground"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
      {view === "profile" ? (
        <>
          <div className="mt-5">
            <Link
              href={showReviews ? "/dashboard/profile" : "/dashboard/profile?reviews=1"}
              className="inline-flex h-10 items-center rounded-lg border border-white/15 bg-white/[0.03] px-4 text-sm font-medium text-zinc-200 transition hover:bg-white/[0.08]"
            >
              {showReviews ? "Hide my review comments" : "View my review comments"}
            </Link>
          </div>
          {showReviews ? (
            <div className="mt-8 rounded-2xl border border-border bg-card p-5 sm:p-6">
              <h2 className="text-lg font-semibold text-foreground">Your product reviews</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Showing only your review activity for a focused view.
              </p>
              <div className="mt-5">
                <ProfilePartReviews userId={session.user.id} />
              </div>
            </div>
          ) : (
            <div className="mt-8">
              <ProfileClient
                userId={user?.id ?? null}
                email={user?.email}
                name={user?.name}
                walletBalance={Number(user?.walletBalance ?? 0)}
                addresses={user?.addresses ?? []}
                legalRows={legalRows}
              />
            </div>
          )}
        </>
      ) : null}
      {view === "verification" ? (
        <div className="mt-8">
          {hadVerificationLoadError ? (
            <div className="mb-4 rounded-xl border border-amber-400/30 bg-amber-500/10 p-3 text-sm text-amber-200">
              We could not load your latest verification record right now. You can still upload and submit a new
              verification request.
            </div>
          ) : null}
          <VerificationClient
            ghanaCardIdNumber={user?.ghanaCardIdNumber ?? null}
            ghanaCardImageUrl={user?.ghanaCardImageUrl ?? null}
            latest={
              latestVerification
                ? {
                    id: latestVerification.id,
                    status: latestVerification.status as never,
                    documentType: latestVerification.documentType as never,
                    reason: latestVerification.reason,
                    rejectionReason: latestVerification.rejectionReason,
                    submittedAt: latestVerification.submittedAt.toISOString(),
                    reviewedAt: latestVerification.reviewedAt?.toISOString() ?? null,
                    expiresAt: latestVerification.expiresAt?.toISOString() ?? null,
                  }
                : null
            }
          />
        </div>
      ) : null}
    </div>
  );
}
