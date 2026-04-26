import Link from "next/link";

import { PageHeading, SectionHeading } from "@/components/typography/page-headings";
import { getUserPolicyAcceptanceSnapshot } from "@/lib/legal-acceptance-guard";
import { POLICY_KEYS } from "@/lib/legal-enforcement";
import { safeAuth } from "@/lib/safe-auth";

const primaryPolicyLinks = [
  {
    href: "/privacy",
    title: "Privacy Policy",
    desc: "How we collect, use, retain, and protect personal data on the platform.",
    policyKeys: [POLICY_KEYS.PRIVACY_POLICY, POLICY_KEYS.PLATFORM_TERMS_PRIVACY],
  },
  {
    href: "/terms",
    title: "Terms and Conditions",
    desc: "Platform terms for account use, transactions, liability limits, and dispute process.",
    policyKeys: [POLICY_KEYS.PLATFORM_TERMS, POLICY_KEYS.PLATFORM_TERMS_PRIVACY],
  },
  {
    href: "/reservation-policy",
    title: "Reservation Policy",
    desc: "Reservation payment, hold period, lapse conditions, and cancellation treatment.",
    policyKeys: [] as const,
  },
  {
    href: "/refund-policy",
    title: "Refund Policy",
    desc: "Eligible and non-eligible refund scenarios and processing expectations.",
    policyKeys: [POLICY_KEYS.REFUND_POLICY, POLICY_KEYS.REFUND_AND_CANCELLATION_POLICY],
  },
  {
    href: "/sourcing-policy",
    title: "Sourcing Policy",
    desc: "Best-effort sourcing terms, approval flow, and external risk disclosures.",
    policyKeys: [POLICY_KEYS.SOURCING_RISK_ACKNOWLEDGEMENT, POLICY_KEYS.RISK_ACKNOWLEDGEMENT],
  },
  {
    href: "/payment-dispute-policy",
    title: "Payment and Dispute Policy",
    desc: "Payment verification rules, transaction statuses, and dispute handling process.",
    policyKeys: [POLICY_KEYS.PAYMENT_CONFIRMATION_NOTICE, POLICY_KEYS.PAYMENT_VERIFICATION_POLICY],
  },
] as const;

const legalRouteLinks = [
  {
    href: "/legal/terms",
    title: "Legal Route: Terms",
    desc: "Canonical legal URL for Terms and Conditions.",
  },
  {
    href: "/legal/privacy",
    title: "Legal Route: Privacy",
    desc: "Canonical legal URL for Privacy Policy.",
  },
  {
    href: "/legal/payments",
    title: "Legal Route: Payments",
    desc: "Canonical legal URL for Payment and Dispute Policy.",
  },
  {
    href: "/legal/sourcing-agreement",
    title: "Legal Route: Sourcing",
    desc: "Canonical legal URL for Vehicle and Parts Sourcing Agreement.",
  },
  {
    href: "/legal/parts-finder",
    title: "Legal Route: Parts Finder Notice",
    desc: "Canonical legal URL for Parts Finder legal notice.",
  },
] as const;

export default async function PoliciesIndexPage() {
  const session = await safeAuth();
  const accepted = session?.user?.id
    ? await getUserPolicyAcceptanceSnapshot(session.user.id, [
        POLICY_KEYS.PLATFORM_TERMS,
        POLICY_KEYS.PRIVACY_POLICY,
        POLICY_KEYS.PLATFORM_TERMS_PRIVACY,
        POLICY_KEYS.CHECKOUT_AGREEMENT,
        POLICY_KEYS.PARTS_FINDER_DISCLAIMER,
        POLICY_KEYS.SOURCING_RISK_ACKNOWLEDGEMENT,
        POLICY_KEYS.RISK_ACKNOWLEDGEMENT,
        POLICY_KEYS.REFUND_POLICY,
        POLICY_KEYS.REFUND_AND_CANCELLATION_POLICY,
        POLICY_KEYS.PAYMENT_CONFIRMATION_NOTICE,
        POLICY_KEYS.PAYMENT_VERIFICATION_POLICY,
      ])
    : [];
  const acceptedMap = new Map(accepted.map((x) => [x.policyKey, x]));

  function getAcceptanceFor(keys?: readonly string[]) {
    if (!keys || keys.length === 0) return null;
    const hit = keys
      .map((k) => acceptedMap.get(k))
      .find((row): row is NonNullable<typeof row> => Boolean(row));
    return hit ?? null;
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6 sm:py-16">
      <PageHeading>All policies</PageHeading>
      <p className="mt-4 max-w-3xl text-sm leading-relaxed text-muted-foreground">
        This page provides quick access to key legal and business policies for Spark and Drive Autos. Please review
        these documents before making reservations, payments, sourcing commitments, or logistics requests.
      </p>
      {!session?.user?.id ? (
        <p className="mt-3 rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-200">
          Sign in to view your acceptance status and active policy versions.
        </p>
      ) : null}

      <section className="mt-8">
        <SectionHeading size="compact">Core policies</SectionHeading>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {primaryPolicyLinks.map((item) => {
            const acceptance = getAcceptanceFor(item.policyKeys);
            return (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-2xl border border-border bg-card p-5 transition hover:border-[var(--brand)]/45 hover:bg-muted/40 dark:border-white/10 dark:bg-white/[0.03] dark:hover:bg-white/[0.05]"
              >
                <SectionHeading size="compact">{item.title}</SectionHeading>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.desc}</p>
                {acceptance ? (
                  <p className="mt-2 text-xs">
                    <span className={acceptance.accepted ? "text-emerald-500 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}>
                      {acceptance.accepted ? "Accepted" : "Not accepted"}
                    </span>{" "}
                    · v{acceptance.version}
                  </p>
                ) : null}
                <span className="mt-3 inline-flex text-sm font-medium text-[var(--brand)]">Open policy →</span>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="mt-10">
        <SectionHeading size="compact">Canonical legal routes</SectionHeading>
        <p className="mt-2 text-sm text-muted-foreground">
          These stable URLs are used for legal references and integrations.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {legalRouteLinks.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-2xl border border-border bg-card p-5 transition hover:border-[var(--brand)]/45 hover:bg-muted/40 dark:border-white/10 dark:bg-white/[0.03] dark:hover:bg-white/[0.05]"
            >
              <SectionHeading size="compact">{item.title}</SectionHeading>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.desc}</p>
              <span className="mt-3 inline-flex text-sm font-medium text-[var(--brand)]">Open policy →</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

