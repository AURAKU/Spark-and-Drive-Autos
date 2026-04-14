import type { ReactNode } from "react";
import Link from "next/link";

const exploreLinks = [
  { href: "/inventory", label: "Inventory" },
  { href: "/request-a-car", label: "Request a car" },
  { href: "/chat", label: "Live Support Chat" },
  { href: "/parts", label: "Parts & accessories" },
  { href: "/electric-bikes-motorcycles", label: "Electric bikes & motorcycles" },
] as const;

const companyLinks = [
  { href: "/about", label: "About" },
  { href: "/faq", label: "FAQ" },
  { href: "/contact", label: "Contact" },
] as const;

/** Index first, then individual policies — vertical list matches other columns. */
const policyLinks = [
  { href: "/policies", label: "All policies" },
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms and Conditions" },
  { href: "/reservation-policy", label: "Reservation Policy" },
  { href: "/refund-policy", label: "Refunds" },
  { href: "/sourcing-policy", label: "Sourcing Policy" },
] as const;

function FooterColumn({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="border-b border-border pb-2.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground dark:border-white/10">
        {title}
      </p>
      <div className="pt-4">{children}</div>
    </div>
  );
}

function FooterLinkList({ links }: { links: readonly { href: string; label: string }[] }) {
  return (
    <ul className="space-y-2.5 text-sm leading-snug text-foreground/90 dark:text-zinc-300">
      {links.map((item) => (
        <li key={item.href}>
          <Link className="transition hover:text-[var(--brand)]" href={item.href}>
            {item.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-card text-card-foreground dark:border-white/10 dark:bg-slate-950 dark:text-zinc-100">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <div className="grid gap-12 sm:gap-10 lg:grid-cols-12 lg:gap-8">
          {/* Brand — spans more width on large screens */}
          <div className="lg:col-span-4">
            <p className="text-base font-semibold tracking-wide text-foreground dark:text-white">Spark &amp; Drive Autos</p>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
              Discover, source, and import vehicles with ease starting from Ghana and built for seamless global delivery.
            </p>
          </div>

          <div className="grid gap-10 sm:grid-cols-3 sm:gap-8 lg:col-span-8 lg:grid-cols-3">
            <FooterColumn title="Explore">
              <FooterLinkList links={exploreLinks} />
            </FooterColumn>

            <FooterColumn title="Company">
              <FooterLinkList links={companyLinks} />
            </FooterColumn>

            <FooterColumn title="Policies">
              <FooterLinkList links={policyLinks} />
            </FooterColumn>
          </div>
        </div>
      </div>

      <div className="border-t border-border py-6 text-center text-xs text-muted-foreground dark:border-white/5">
        <p>© {new Date().getFullYear()} Spark and Drive Autos. All rights reserved.</p>
        <p className="mt-2">
          <span className="inline-flex items-center rounded-full border border-[var(--brand)]/50 bg-[var(--brand)]/10 px-3 py-1 text-[11px] font-semibold tracking-[0.2em] text-[var(--brand)] uppercase shadow-[0_0_24px_-4px_rgba(20,216,230,0.45)]">
            Powered by AGI
          </span>
        </p>
      </div>
    </footer>
  );
}
