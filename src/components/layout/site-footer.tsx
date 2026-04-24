import type { ReactNode } from "react";
import Link from "next/link";

import { PartsFinderCtaLink } from "@/components/parts-finder/parts-finder-cta-link";
import { DealershipSocialIconRow } from "@/components/social/dealership-social-icon-row";
import { BrowseCarsCtaLink, BuyPartsCtaLink } from "@/components/storefront/storefront-cta-links";

type FooterLinkItem = {
  href: string;
  label: string;
  ctaStyle?: "parts-finder" | "browse-cars" | "buy-parts";
};

const exploreLinks: readonly FooterLinkItem[] = [
  { href: "/inventory", label: "Browse cars", ctaStyle: "browse-cars" },
  { href: "/request-a-car", label: "Request a car" },
  { href: "/parts-finder/entry", label: "Spark Parts Finder", ctaStyle: "parts-finder" },
  { href: "/chat", label: "Live Support Chat" },
  { href: "/parts", label: "Buy Parts & Accessories", ctaStyle: "buy-parts" },
  { href: "/electric-bikes-motorcycles", label: "Electric bikes & motorcycles" },
];

const companyLinks = [
  { href: "/about", label: "About" },
  { href: "/faq", label: "FAQ" },
  { href: "/contact", label: "Contact" },
] as const;

/** Index first, then individual policies; vertical list matches other columns. */
const policyLinks = [
  { href: "/policies", label: "All policies" },
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms and Conditions" },
  { href: "/reservation-policy", label: "Reservation Policy" },
  { href: "/refund-policy", label: "Refunds" },
  { href: "/sourcing-policy", label: "Sourcing Policy" },
] as const;

const footerBrandTitle =
  "text-sm font-semibold leading-tight text-[var(--brand)] sm:text-[0.95rem] sm:leading-snug";

const footerLinkColumnTitle =
  "border-b border-[var(--brand)]/30 pb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--brand)] dark:border-white/10";

function FooterColumn({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className={footerLinkColumnTitle}>{title}</p>
      <div className="pt-3">{children}</div>
    </div>
  );
}

function FooterLinkList({ links }: { links: readonly FooterLinkItem[] }) {
  return (
    <ul className="space-y-2 text-xs leading-snug text-foreground/90 sm:text-sm dark:text-zinc-300">
      {links.map((item) => (
        <li key={item.href}>
          {item.ctaStyle === "parts-finder" ? (
            <PartsFinderCtaLink href={item.href} size="compact" className="w-full text-center sm:inline-flex sm:w-auto">
              {item.label}
            </PartsFinderCtaLink>
          ) : item.ctaStyle === "browse-cars" ? (
            <BrowseCarsCtaLink href={item.href} size="compact" className="w-full text-center sm:inline-flex sm:w-auto">
              {item.label}
            </BrowseCarsCtaLink>
          ) : item.ctaStyle === "buy-parts" ? (
            <BuyPartsCtaLink href={item.href} size="compact" className="w-full text-center sm:inline-flex sm:w-auto">
              {item.label}
            </BuyPartsCtaLink>
          ) : (
            <Link className="transition hover:text-[var(--brand)]" href={item.href}>
              {item.label}
            </Link>
          )}
        </li>
      ))}
    </ul>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-card text-card-foreground dark:border-white/10 dark:bg-slate-950 dark:text-zinc-100">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        {/* Brand line: three pillars in one row on tablet+ */}
        <div className="grid gap-5 border-b border-border pb-6 sm:gap-6 md:grid-cols-3 md:gap-6 md:pb-7 dark:border-white/10">
          <div className="min-w-0 md:border-r md:border-border md:pr-6 dark:md:border-white/10">
            <p className={footerBrandTitle}>Spark &amp; Drive Autos</p>
            <p className="mt-1.5 text-xs leading-snug text-muted-foreground sm:text-sm sm:leading-snug">
              Discover, source, and import vehicles with ease starting from Ghana and built for seamless global delivery.
            </p>
          </div>
          <div className="min-w-0 md:border-r md:border-border md:pr-6 dark:md:border-white/10">
            <p className={footerBrandTitle}>Spark and Drive Gear</p>
            <p className="mt-1.5 text-xs leading-snug text-muted-foreground sm:text-sm sm:leading-snug">
              Parts, accessories, and upgrade essentials, sourced with fitment in mind so you can maintain, personalize, and
              protect your vehicle with confidence.
            </p>
          </div>
          <div className="min-w-0">
            <p className={footerBrandTitle}>Spark Parts Finder</p>
            <p className="mt-1.5 text-xs leading-snug text-muted-foreground sm:text-sm sm:leading-snug">
              Premium, evidence based search that matches exact OEM or high quality equivalent parts using your VIN, chassis,
              or vehicle details, with honest confidence labels and curated top results.
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-8 sm:grid-cols-3 sm:gap-6 md:mt-7">
          <FooterColumn title="Explore">
            <FooterLinkList links={exploreLinks} />
          </FooterColumn>

          <FooterColumn title="Company">
            <FooterLinkList links={companyLinks} />
            <div className="mt-4 border-t border-border/50 pt-4 dark:border-white/10">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--brand)]/90">Follow us</p>
              <DealershipSocialIconRow className="mt-2" />
            </div>
          </FooterColumn>

          <FooterColumn title="Policies">
            <FooterLinkList links={policyLinks} />
          </FooterColumn>
        </div>
      </div>

      <div className="border-t border-border py-4 text-center text-xs text-muted-foreground sm:text-sm dark:border-white/5">
        <p>
          © {new Date().getFullYear()} Spark and Drive Autos | Spark and Drive Gear.
        </p>
        <p className="mt-1">All rights reserved.</p>
        <p className="mt-1.5">
          <span className="inline-flex items-center rounded-full border border-[var(--brand)]/50 bg-[var(--brand)]/10 px-2.5 py-0.5 text-[10px] font-semibold tracking-[0.18em] text-[var(--brand)] uppercase shadow-[0_0_24px_-4px_rgba(20,216,230,0.45)] sm:px-3 sm:py-1 sm:text-[11px] sm:tracking-[0.2em]">
            Powered by AGI
          </span>
        </p>
      </div>
    </footer>
  );
}
