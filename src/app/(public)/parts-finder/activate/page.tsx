import Link from "next/link";

import { PartsFinderCtaLink } from "@/components/parts-finder/parts-finder-cta-link";
import { requireSessionOrRedirect } from "@/lib/auth-helpers";
import { getPartsFinderAccessSnapshot } from "@/lib/parts-finder/access";
import { getPartsFinderActivationSnapshot } from "@/lib/parts-finder/pricing";
import { PartsFinderActivationClient } from "./activation-client";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function PublicPartsFinderActivatePage(props: { searchParams: SearchParams }) {
  await requireSessionOrRedirect("/parts-finder/activate");
  const sp = await props.searchParams;
  const reference =
    typeof sp.reference === "string" ? sp.reference : Array.isArray(sp.reference) ? sp.reference[0] : undefined;
  const statusHint =
    typeof sp.status === "string" ? sp.status : Array.isArray(sp.status) ? sp.status[0] : undefined;
  const [access, pricing] = await Promise.all([getPartsFinderAccessSnapshot(), getPartsFinderActivationSnapshot()]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-semibold">Activate Parts Finder</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Membership status is enforced server-side. Activate or renew to run advanced search and view refined results.
      </p>
      <div className="mt-6 rounded-xl border border-border bg-card p-4 text-sm">
        <p>Current state: <span className="font-semibold">{access.state}</span></p>
        <p>Access window: {pricing.defaultDurationDays} days</p>
        <p>Currency: {pricing.currency}</p>
        {statusHint === "pending-payment" || access.state === "PENDING_PAYMENT" ? (
          <p className="mt-2 text-xs text-amber-500">Payment is still pending provider confirmation.</p>
        ) : null}
        {statusHint === "suspended" || access.state === "SUSPENDED" ? (
          <p className="mt-2 text-xs text-red-500">Membership is suspended. Contact support for reinstatement guidance.</p>
        ) : null}
      </div>
      <PartsFinderActivationClient
        initialReference={reference}
        accessState={access.state}
        currency={pricing.currency}
        activationPriceMinor={pricing.activationPriceMinor}
        renewalPriceMinor={pricing.renewalPriceMinor}
      />
      <div className="mt-6 flex flex-wrap gap-2">
        <PartsFinderCtaLink href="/parts-finder/search" size="compact" className="!px-4 text-sm">
          Find Parts
        </PartsFinderCtaLink>
        <Link href="/dashboard/parts-finder" className="rounded-lg border border-border px-4 py-2 text-sm">
          Open dashboard view
        </Link>
      </div>
    </div>
  );
}
