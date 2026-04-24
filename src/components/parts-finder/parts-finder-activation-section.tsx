"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

import { partsFinderCtaClassName } from "@/components/parts-finder/parts-finder-cta-link";
import { cn } from "@/lib/utils";

type PartsFinderActivationSectionProps = {
  heading?: string;
  subheading?: string;
  message?: string;
  ctaLabel?: string;
  authenticatedRedirectHref?: string;
  guestRedirectHref?: string;
  helperText?: string;
  className?: string;
};

export function PartsFinderActivationSection({
  heading = "Parts Finder Access",
  subheading = "OEM-First Search Activation",
  message = "Activate your account now to help us find the exact OEM parts for your vehicle.",
  ctaLabel = "Activate Account",
  authenticatedRedirectHref = "/parts-finder/search",
  guestRedirectHref = "/login",
  helperText = "Activation unlocks guided verification and trusted fitment checks for your vehicle profile.",
  className,
}: PartsFinderActivationSectionProps) {
  const router = useRouter();
  const { status } = useSession();
  const [isNavigating, setIsNavigating] = useState(false);

  const redirectTarget = useMemo(() => {
    if (status === "authenticated") return authenticatedRedirectHref;
    return `${guestRedirectHref}?callbackUrl=${encodeURIComponent(authenticatedRedirectHref)}`;
  }, [authenticatedRedirectHref, guestRedirectHref, status]);

  function handleActivateClick() {
    if (isNavigating) return;
    setIsNavigating(true);
    router.push(redirectTarget);
  }

  return (
    <section
      aria-labelledby="parts-finder-activation-heading"
      className={`relative overflow-hidden rounded-2xl border border-white/15 bg-gradient-to-b from-[#0a121c] to-[#05080d] p-6 text-center shadow-[0_20px_50px_-30px_rgba(20,216,230,0.55)] sm:p-8 ${className ?? ""}`}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -top-20 left-1/2 h-44 w-44 -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(20,216,230,0.25),transparent_70%)]"
      />

      <div className="relative mx-auto max-w-2xl">
        <div
          aria-hidden
          className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl border border-white/20 bg-white/5 text-[var(--brand)]"
        >
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M4 13h16" />
            <path d="M6 17h2" />
            <path d="M16 17h2" />
            <path d="M5 13l1.2-4.1A2 2 0 0 1 8.1 7.5h7.8a2 2 0 0 1 1.9 1.4L19 13" />
            <circle cx="8" cy="17" r="1.6" />
            <circle cx="16" cy="17" r="1.6" />
          </svg>
        </div>

        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--brand)]/90">{subheading}</p>
        <h2 id="parts-finder-activation-heading" className="mt-2 text-2xl font-semibold text-white sm:text-3xl">
          {heading}
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-zinc-300 sm:text-base">{message}</p>

        <div className="mt-6">
          <button
            type="button"
            onClick={handleActivateClick}
            disabled={isNavigating}
            aria-busy={isNavigating}
            className={cn(
              partsFinderCtaClassName,
              "h-11 min-h-11 px-6 text-sm transition duration-200 hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#070b12] disabled:cursor-not-allowed disabled:opacity-70",
            )}
          >
            {isNavigating ? "Redirecting..." : ctaLabel}
          </button>
          <p className="mt-3 text-xs text-zinc-400">{helperText}</p>
        </div>
      </div>
    </section>
  );
}
