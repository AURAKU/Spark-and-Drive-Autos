import Link from "next/link";

import { PageHeading, SectionHeading } from "@/components/typography/page-headings";
import { LEGAL_COMPANY } from "@/lib/legal";

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6 sm:py-16">
      <PageHeading>Contact Us</PageHeading>
      <p className="mt-6 max-w-3xl text-sm leading-relaxed text-zinc-300 sm:text-[0.9375rem]">
        Get in touch with our team for sales support, sourcing requests, order inquiries, payment verification, or
        complaint resolution. We&apos;re here to help—clearly and promptly.
      </p>

      <div className="mt-10 grid gap-5 sm:grid-cols-2">
        <section className="rounded-2xl border border-[var(--brand)]/20 bg-white/[0.03] p-5 shadow-[0_0_32px_-16px_rgba(20,216,230,0.15)]">
          <SectionHeading>Business Details</SectionHeading>
          <dl className="mt-5 space-y-4 text-sm text-zinc-300 sm:text-[0.9375rem]">
            <div>
              <dt className="text-xs font-medium tracking-wide text-zinc-500">Business Name</dt>
              <dd className="mt-1 text-white">{LEGAL_COMPANY.businessName}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium tracking-wide text-zinc-500">Registration Number</dt>
              <dd className="mt-1 text-white">{LEGAL_COMPANY.registrationNumber}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium tracking-wide text-zinc-500">Office Address</dt>
              <dd className="mt-1">{LEGAL_COMPANY.officeAddress}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium tracking-wide text-zinc-500">Business Hours</dt>
              <dd className="mt-1">{LEGAL_COMPANY.workingHours}</dd>
            </div>
          </dl>
        </section>

        <section className="rounded-2xl border border-[var(--brand)]/20 bg-white/[0.03] p-5 shadow-[0_0_32px_-16px_rgba(20,216,230,0.15)]">
          <SectionHeading>Contact Channels</SectionHeading>
          <dl className="mt-5 space-y-4 text-sm text-zinc-300 sm:text-[0.9375rem]">
            <div>
              <dt className="text-xs font-medium tracking-wide text-zinc-500">Phone / WhatsApp</dt>
              <dd className="mt-1">
                <a href={`tel:${LEGAL_COMPANY.phone.replace(/\s/g, "")}`} className="text-white hover:text-[var(--brand)]">
                  {LEGAL_COMPANY.phone}
                </a>
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium tracking-wide text-zinc-500">General Support</dt>
              <dd className="mt-1">
                <a href={`mailto:${LEGAL_COMPANY.supportEmail}`} className="text-white hover:text-[var(--brand)]">
                  {LEGAL_COMPANY.supportEmail}
                </a>
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium tracking-wide text-zinc-500">Legal &amp; Complaints</dt>
              <dd className="mt-1">
                <a href={`mailto:${LEGAL_COMPANY.email}`} className="text-white hover:text-[var(--brand)]">
                  {LEGAL_COMPANY.email}
                </a>
              </dd>
            </div>
          </dl>
        </section>
      </div>

      <section className="mt-5 rounded-2xl border border-[var(--brand)]/20 bg-white/[0.03] p-5 shadow-[0_0_32px_-16px_rgba(20,216,230,0.15)]">
        <SectionHeading>Live Customer Support</SectionHeading>
        <p className="mt-5 text-sm leading-relaxed text-zinc-300 sm:text-[0.9375rem]">
          Available directly inside your dashboard.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-zinc-300 sm:text-[0.9375rem]">
          <span className="mr-2 inline-block" aria-hidden>
            👉
          </span>
          Start a conversation via our{" "}
          <Link href="/chat" className="font-medium text-[var(--brand)] hover:underline">
            in-app chat
          </Link>{" "}
          for faster assistance.
        </p>
      </section>
    </div>
  );
}
