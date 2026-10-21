import Image from "next/image";

import { AboutShowcase } from "@/components/brand/about-showcase";
import { PageHeading, SectionHeading } from "@/components/typography/page-headings";

const emblemBlendMask = {
  WebkitMaskImage: "radial-gradient(circle at 50% 50%, #000 54%, transparent 76%)",
  maskImage: "radial-gradient(circle at 50% 50%, #000 54%, transparent 76%)",
} as const;

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6 sm:py-16">
      <div className="flex flex-col items-center text-center">
        <div className="relative h-36 w-36 sm:h-44 sm:w-44">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-[18%] rounded-full bg-[var(--brand)]/18 blur-3xl dark:bg-[var(--brand)]/22"
          />
          <Image
            src="/brand/about-logo-emblem.png"
            alt="Spark &amp; Drive Autos emblem"
            fill
            className="object-contain dark:mix-blend-screen"
            style={emblemBlendMask}
            sizes="(max-width: 640px) 9rem, 11rem"
            priority
          />
        </div>
        <AboutShowcase />
      </div>

      <PageHeading className="mt-12" align="center">
        About Spark &amp; Drive Autos
      </PageHeading>

      <div className="mx-auto mt-8 max-w-3xl space-y-4 text-sm leading-relaxed text-zinc-300 sm:text-[0.9375rem]">
        <p>
          Spark &amp; Drive Autos is a Ghana-focused automotive commerce platform built for customers who value trust,
          verification, and clear communication.
        </p>
        <p>
          We combine vehicle sales, parts and accessories, international sourcing, and managed logistics into one
          streamlined experience designed for real-world conditions.
        </p>
      </div>

      <div className="mt-12 grid gap-8 sm:grid-cols-2">
        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <SectionHeading>What we do</SectionHeading>
          <ul className="mt-5 space-y-3 text-sm leading-relaxed text-zinc-300 sm:text-[0.9375rem]">
            <li>Curated vehicle listings with clear availability, verification status, and transparent payment tracking.</li>
            <li>Parts and accessories storefront with secure checkout and full order visibility.</li>
            <li>
              International sourcing support, working with trusted suppliers and guided by customer approvals.
            </li>
            <li>
              Logistics and customs coordination on request, with full transparency on third-party processes.
            </li>
          </ul>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <SectionHeading>How we work</SectionHeading>
          <ul className="mt-5 space-y-3 text-sm leading-relaxed text-zinc-300 sm:text-[0.9375rem]">
            <li>We confirm all commercial terms upfront before any commitment.</li>
            <li>Every payment is documented and traceable within the platform.</li>
            <li>Customers receive structured updates through their dashboards where available.</li>
            <li>We prioritise clarity, accountability, and realistic timelines over assumptions.</li>
          </ul>
        </section>
      </div>

      <section className="mt-10 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <SectionHeading>Our commitment</SectionHeading>
        <div className="mt-5 space-y-4 text-sm leading-relaxed text-zinc-300 sm:text-[0.9375rem]">
          <p>
            We are committed to delivering a premium, responsible automotive experience, combining digital transparency
            with hands-on customer support.
          </p>
          <p>
            As we grow, we continuously improve our systems, controls, and documentation to meet both customer
            expectations and regulatory standards.
          </p>
        </div>
      </section>
    </div>
  );
}
