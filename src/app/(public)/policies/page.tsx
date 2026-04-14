import Link from "next/link";

import { PageHeading, SectionHeading } from "@/components/typography/page-headings";

const policyLinks = [
  {
    href: "/privacy",
    title: "Privacy Policy",
    desc: "How we collect, use, retain, and protect personal data on the platform.",
  },
  {
    href: "/terms",
    title: "Terms and Conditions",
    desc: "Platform terms for account use, transactions, liability limits, and dispute process.",
  },
  {
    href: "/reservation-policy",
    title: "Reservation Policy",
    desc: "Reservation payment, hold period, lapse conditions, and cancellation treatment.",
  },
  {
    href: "/refund-policy",
    title: "Refund Policy",
    desc: "Eligible and non-eligible refund scenarios and processing expectations.",
  },
  {
    href: "/sourcing-policy",
    title: "Sourcing Policy",
    desc: "Best-effort sourcing terms, approval flow, and external risk disclosures.",
  },
] as const;

export default function PoliciesIndexPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6 sm:py-16">
      <PageHeading>Policies</PageHeading>
      <p className="mt-4 max-w-3xl text-sm leading-relaxed text-zinc-300">
        This page provides quick access to key legal and business policies for Spark and Drive Autos. Please review
        these documents before making reservations, payments, sourcing commitments, or logistics requests.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {policyLinks.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition hover:border-[var(--brand)]/40 hover:bg-white/[0.05]"
          >
            <SectionHeading size="compact">{item.title}</SectionHeading>
            <p className="mt-2 text-sm leading-relaxed text-zinc-300">{item.desc}</p>
            <span className="mt-3 inline-flex text-sm font-medium text-[var(--brand)]">Open policy →</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

