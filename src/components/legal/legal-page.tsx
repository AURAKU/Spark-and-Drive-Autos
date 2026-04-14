import type { ReactNode } from "react";

import { PageHeading, SectionHeading } from "@/components/typography/page-headings";

type Section = {
  title: string;
  body: ReactNode;
};

export function LegalPage({
  title,
  intro,
  sections,
  footer,
}: {
  title: string;
  intro: ReactNode;
  sections: Section[];
  footer: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6 sm:py-16">
      <PageHeading>{title}</PageHeading>
      <div className="mt-5 rounded-2xl border border-border bg-card/90 p-5 text-sm leading-relaxed text-card-foreground shadow-sm ring-1 ring-border/40 dark:border-white/10 dark:bg-white/[0.03] dark:text-zinc-200 dark:ring-transparent">
        {intro}
      </div>

      <div className="mt-8 space-y-5">
        {sections.map((section) => (
          <section
            key={section.title}
            className="rounded-2xl border border-border bg-card/80 p-5 shadow-sm ring-1 ring-border/30 dark:border-white/10 dark:bg-white/[0.02] dark:ring-transparent"
          >
            <SectionHeading className="!text-lg sm:!text-xl">{section.title}</SectionHeading>
            <div className="mt-3 text-sm leading-relaxed text-muted-foreground dark:text-zinc-300">{section.body}</div>
          </section>
        ))}
      </div>

      <section className="mt-8 rounded-2xl border border-[var(--brand)]/35 bg-[var(--brand)]/[0.08] p-5 text-sm leading-relaxed text-foreground dark:border-[var(--brand)]/30 dark:text-zinc-100">
        {footer}
      </section>
    </div>
  );
}

