import Link from "next/link";

import { isAdminRole } from "@/auth";
import { PartsFinderCtaLink } from "@/components/parts-finder/parts-finder-cta-link";
import { requireSessionOrRedirect } from "@/lib/auth-helpers";
import { ensurePartsFinderActivationPolicyVersions } from "@/lib/legal-ensure-parts-finder-policies";
import { getPartsFinderActivationLegalVersions, POLICY_KEYS } from "@/lib/legal-enforcement";
import { getPartsFinderAccessSnapshot } from "@/lib/parts-finder/access";
import { getPartsFinderActivationSnapshot, getPartsFinderChargeQuote } from "@/lib/parts-finder/pricing";
import { prisma } from "@/lib/prisma";

import { PartsFinderActivationClient } from "./activation-client";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function PublicPartsFinderActivatePage(props: { searchParams: SearchParams }) {
  const session = await requireSessionOrRedirect("/parts-finder/activate");
  const ensured = await ensurePartsFinderActivationPolicyVersions({ actorUserId: session.user.id });
  if (!ensured.ok) {
    console.warn("[parts-finder/activate] policy ensure non-fatal:", ensured.reason, ensured.code ?? "");
  }
  const isAdmin = Boolean(session.user.role && isAdminRole(session.user.role));
  const sp = await props.searchParams;
  const statusHint =
    typeof sp.status === "string" ? sp.status : Array.isArray(sp.status) ? sp.status[0] : undefined;
  const [access, pricing, userRow, legalVersions] = await Promise.all([
    getPartsFinderAccessSnapshot(),
    getPartsFinderActivationSnapshot(),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { walletBalance: true },
    }),
    getPartsFinderActivationLegalVersions(),
  ]);
  const walletBalanceGhs = Number(userRow?.walletBalance ?? 0);
  const charge = getPartsFinderChargeQuote(access, pricing);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <div
        className="rounded-2xl border-2 border-orange-400/30 bg-gradient-to-br from-cyan-500/12 via-card to-orange-500/10 p-6 text-card-foreground shadow-md dark:from-cyan-500/15 dark:via-zinc-900/50 dark:to-orange-500/12 dark:shadow-[0_0_40px_-20px_rgba(6,182,212,0.35)] sm:p-8"
      >
        <h1 className="text-2xl font-bold text-orange-600 sm:text-3xl dark:text-orange-400">
          Activate Spark Parts Finder
        </h1>
        <p className="mt-3 text-sm font-medium text-cyan-900/90 sm:text-base dark:text-cyan-200/80">
          Membership &amp; payments are enforced securely on our servers. Activate to run advanced search and view refined
          results for Parts for your vehicle.
        </p>
        {isAdmin ? (
          <div className="mt-4 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-950 dark:border-amber-400/35 dark:bg-amber-500/15 dark:text-amber-100">
            <p className="font-semibold text-foreground dark:text-amber-50">Admin: legal copy for activation</p>
            <p className="mt-1 text-muted-foreground dark:text-amber-100/85">
              If you update terms or the Parts Finder disclaimer, publish new versions under Admin → Legal so activation
              always records acceptance against active policy rows.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                href={`/admin/legal?policyKey=${encodeURIComponent(POLICY_KEYS.PLATFORM_TERMS_PRIVACY)}`}
                className="rounded-lg border border-amber-600/50 bg-background/80 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-amber-500/15 dark:border-amber-400/40 dark:bg-zinc-950/50"
              >
                Edit platform terms &amp; privacy
              </Link>
              <Link
                href={`/admin/legal?policyKey=${encodeURIComponent(POLICY_KEYS.PARTS_FINDER_DISCLAIMER)}`}
                className="rounded-lg border border-amber-600/50 bg-background/80 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-amber-500/15 dark:border-amber-400/40 dark:bg-zinc-950/50"
              >
                Edit Parts Finder disclaimer
              </Link>
              <Link
                href="/admin/legal"
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/60 dark:border-white/15"
              >
                All legal policies
              </Link>
            </div>
          </div>
        ) : null}
        <div className="mt-5 rounded-xl border border-border bg-background/60 p-4 text-sm text-foreground dark:border-white/10 dark:bg-zinc-950/40">
          <p>
            <span className="text-muted-foreground">Status:</span>{" "}
            <span className="font-bold text-foreground">{access.state}</span>
          </p>
          <p className="mt-1">
            <span className="text-muted-foreground">Access window:</span> {pricing.defaultDurationDays} days
          </p>
          <p className="mt-1">
            <span className="text-muted-foreground">Currency:</span> {pricing.currency}
          </p>
          {statusHint === "already-active" ? (
            <p className="mt-2 text-sm font-medium text-cyan-800 dark:text-cyan-300">
              You already have active access. Payment and wallet renewal are disabled until your membership expires.
            </p>
          ) : null}
          {statusHint === "pending-payment" || access.state === "PENDING_PAYMENT" ? (
            <p className="mt-2 text-sm font-medium text-amber-700 dark:text-amber-400">
              Payment is still pending provider confirmation. If this lasts more than ~90 minutes, you can start a new
              payment attempt.
            </p>
          ) : null}
          {statusHint === "suspended" || access.state === "SUSPENDED" ? (
            <p className="mt-2 text-sm font-medium text-red-600 dark:text-red-400">
              Membership is suspended. Contact support for reinstatement guidance.
            </p>
          ) : null}
        </div>
        <PartsFinderActivationClient
          accessState={access.state}
          activeUntil={access.activeUntil}
          currency={pricing.currency}
          activationPriceMinor={pricing.activationPriceMinor}
          renewalPriceMinor={pricing.renewalPriceMinor}
          chargePriceMinor={charge.priceMinor}
          chargeKind={charge.kind}
          walletBalanceGhs={walletBalanceGhs}
          platformTermsVersion={legalVersions.platformTermsVersion}
          partsFinderDisclaimerVersion={legalVersions.partsFinderDisclaimerVersion}
        />
        <div className="mt-6 flex flex-wrap gap-2">
          <PartsFinderCtaLink href="/parts-finder/search" size="compact" className="!px-4 text-sm">
            Find Parts
          </PartsFinderCtaLink>
          <Link
            href="/dashboard/parts-finder"
            className="rounded-lg border-2 border-cyan-500/50 px-4 py-2 text-sm font-medium text-foreground transition hover:bg-cyan-500/10 dark:hover:bg-cyan-500/15"
          >
            Open dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
