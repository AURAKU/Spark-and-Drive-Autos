import { cookies } from "next/headers";
import Image from "next/image";
import Link from "next/link";
import { Playfair_Display } from "next/font/google";

import { CarCard } from "@/components/cars/car-card";
import { LandingPartSpotlightCard } from "@/components/landing/landing-part-spotlight-card";
import { SourcingFlags } from "@/components/landing/sourcing-flags";
import { SectionHeading } from "@/components/typography/page-headings";
import { getCarDisplayPrice, getGlobalCurrencySettings, parseDisplayCurrency } from "@/lib/currency";
import { getHomeSpotlight } from "@/lib/landing-spotlight";
import { prisma } from "@/lib/prisma";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

/** Editorial serif — luxury / automotive showroom feel (replaces condensed uppercase display). */
const heroTitle = Playfair_Display({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
  variable: "--font-hero-display",
});

const PILLARS: Array<{ k: string; v: string; highlight?: boolean }> = [
  {
    k: "Inventory",
    highlight: true,
    v: "Explore our inventory of new and pre-owned Vehicles, Motorcycles, Autoparts available locally in Ghana or sourced from China. Find the right Car or Autoparts with transparent listings and real availability you can trust.",
  },
  {
    k: "Payment",
    highlight: true,
    v: "Pay securely using Paystack, Mobile Money (GHS), Bank transfer, Office Cash Payment (GHS or USD), or Alipay (RMB). Every payment is clear, verified, and transparent so you always know exactly what you're paying for.",
  },
  {
    k: "Logistics",
    highlight: true,
    v: "After your purchase, we handle the logistics from shipping and freight to supporting duty clearance in your destination country. We coordinate the process end-to-end, so your vehicle arrives smoothly and without stress.",
  },
  {
    k: "Other services",
    highlight: true,
    v: "Need upgrades or custom modifications? We handle vehicle enhancements and source quality parts and accessories, interior and exterior, with the same trusted, professional service.",
  },
];

export default async function HomePage() {
  const cookieStore = await cookies();
  const displayCurrency = parseDisplayCurrency(cookieStore.get("sda_currency")?.value);
  const fx = await getGlobalCurrencySettings();

  let spotlight = await getHomeSpotlight().catch((e) => {
    console.error("[HomePage] spotlight", e);
    return {
      entries: [] as Awaited<ReturnType<typeof getHomeSpotlight>>["entries"],
      slotStartedAt: new Date(),
      nextRotationAt: new Date(),
      seed: 0,
    };
  });

  if (spotlight.entries.length === 0) {
    try {
      const fallback = await prisma.car.findMany({
        where: { listingState: "PUBLISHED" },
        take: 3,
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          slug: true,
          title: true,
          brand: true,
          model: true,
          year: true,
          location: true,
          sourceType: true,
          availabilityStatus: true,
          listingState: true,
          coverImageUrl: true,
          basePriceRmb: true,
        },
      });
      spotlight = {
        entries: fallback.map((car) => ({ kind: "car" as const, car })),
        slotStartedAt: spotlight.slotStartedAt,
        nextRotationAt: spotlight.nextRotationAt,
        seed: spotlight.seed,
      };
    } catch (e) {
      console.error("[HomePage] prisma fallback", e);
    }
  }

  return (
    <div>
      <section className="relative overflow-hidden border-b border-white/10">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute left-1/2 top-1/2 h-[min(120vw,720px)] w-[min(120vw,720px)] -translate-x-1/2 -translate-y-1/2 opacity-[0.07]">
            <Image
              src="/brand/logo-emblem.png"
              alt=""
              fill
              className="object-contain"
              sizes="(max-width: 768px) 100vw, 720px"
              priority
            />
          </div>
          <div className="absolute inset-0 bg-[radial-gradient(600px_400px_at_50%_18%,rgba(20,216,230,0.12),transparent)]" />
        </div>
        <div className={`relative mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:py-28 ${heroTitle.variable}`}>
          <div className="relative mx-auto max-w-5xl text-center">
            <h1
              className={`${heroTitle.className} text-balance text-[clamp(2.75rem,11vw,5rem)] font-semibold leading-[0.98] tracking-[-0.02em] text-white sm:text-7xl md:text-8xl md:leading-[0.96] lg:text-[7.2rem] xl:text-[8.8rem]`}
            >
              <span className="inline-block bg-gradient-to-br from-white via-zinc-100 to-zinc-400 bg-clip-text text-transparent">
                Spark and Drive
              </span>
              <span className="block bg-gradient-to-br from-white via-zinc-100 to-zinc-400 bg-clip-text text-transparent">
                Autos
              </span>
            </h1>
            <div className="mt-6 flex justify-center sm:mt-7">
              <SourcingFlags className="justify-center" />
            </div>
            <div
              className="mx-auto mt-6 h-px max-w-[12rem] bg-gradient-to-r from-transparent via-[var(--brand)]/80 to-transparent sm:mt-8"
              aria-hidden
            />
            <p className="mx-auto mt-10 max-w-3xl text-balance text-center text-lg font-normal leading-[1.65] text-zinc-300 sm:mt-12 sm:text-xl md:text-[1.35rem] md:leading-[1.7]">
              We Buy and Sell Cars, Motorcycles, AutoParts, and Accessories across Ghana, and source globally when
              needed. From shipping and freight to duty clearance at the port, we handle everything, making the entire
              process smooth, transparent, and stress-free.
            </p>
          </div>
          <div className="mx-auto mt-12 flex max-w-4xl flex-col gap-3 sm:mt-14 sm:flex-row sm:flex-wrap sm:justify-center sm:gap-4">
            <Link
              href="/inventory"
              className="inline-flex min-h-12 flex-1 items-center justify-center rounded-xl border-2 border-[var(--brand)] bg-[var(--brand)]/[0.14] px-6 text-sm font-semibold tracking-wide text-[var(--brand)] shadow-[0_0_36px_-6px_rgba(20,216,230,0.55)] transition hover:border-[var(--brand)] hover:bg-[var(--brand)]/25 sm:min-w-[11.5rem] sm:flex-none"
            >
              Browse Car
            </Link>
            <Link
              href="/electric-bikes-motorcycles"
              className="inline-flex min-h-12 flex-1 items-center justify-center rounded-xl bg-white px-5 text-center text-sm font-semibold leading-snug tracking-wide text-zinc-950 shadow-[0_8px_30px_-8px_rgba(255,255,255,0.35)] transition hover:bg-zinc-100 sm:min-w-[11.5rem] sm:flex-none sm:px-6"
            >
              Browse Electric Bikes &amp; Motorcycles
            </Link>
            <Link
              href="/parts"
              className="inline-flex min-h-12 flex-1 items-center justify-center rounded-xl border border-white/90 bg-red-600 px-5 text-center text-sm font-semibold leading-snug tracking-wide text-white shadow-[0_8px_28px_-6px_rgba(220,38,38,0.55)] transition hover:bg-red-700 sm:min-w-[11.5rem] sm:flex-none sm:px-6"
            >
              Buy Parts &amp; Accessories
            </Link>
          </div>
          <dl className="mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {PILLARS.map((item) => (
              <div
                key={item.k}
                className={cn(
                  "rounded-2xl border p-5",
                  item.highlight
                    ? "border-[var(--brand)]/45 bg-[var(--brand)]/[0.07] shadow-[0_0_40px_-14px_rgba(20,216,230,0.35)]"
                    : "border-white/10 bg-white/[0.03]",
                )}
              >
                <dt
                  className={cn(
                    "text-xs font-semibold tracking-[0.22em] uppercase",
                    item.highlight
                      ? "text-[var(--brand)] drop-shadow-[0_0_14px_rgba(20,216,230,0.45)]"
                      : "font-medium tracking-wide text-zinc-500",
                  )}
                >
                  {item.k}
                </dt>
                <dd className="mt-2 text-sm leading-relaxed text-zinc-200">{item.v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <SectionHeading>Explore Featured and Best Selling</SectionHeading>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">
              Listings from our inventory driven by recent sales, Top picks, and New Arrivals.
            </p>
          </div>
          <div className="flex flex-wrap gap-4 text-sm">
            <Link href="/inventory" className="text-[var(--brand)] hover:underline">
              Browse cars →
            </Link>
            <Link href="/parts" className="text-[var(--brand)] hover:underline">
              Parts &amp; accessories →
            </Link>
          </div>
        </div>
        <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {spotlight.entries.length === 0 ? (
            <p className="text-sm text-zinc-500">
              No listings to highlight yet. Ensure Docker Postgres is up, then run{" "}
              <code className="rounded bg-white/5 px-1 py-0.5">npm run setup:local</code> or{" "}
              <code className="rounded bg-white/5 px-1 py-0.5">npm run db:seed</code>.
            </p>
          ) : (
            spotlight.entries.map((entry) =>
              entry.kind === "car" ? (
                <CarCard
                  key={`car-${entry.car.id}`}
                  car={entry.car}
                  displayAmount={getCarDisplayPrice(Number(entry.car.basePriceRmb), displayCurrency, fx)}
                  displayCurrency={displayCurrency}
                />
              ) : (
                <LandingPartSpotlightCard
                  key={`part-${entry.part.id}`}
                  part={entry.part}
                  displayCurrency={displayCurrency}
                  fx={fx}
                />
              ),
            )
          )}
        </div>
      </section>

      <section className="border-t border-white/10 bg-black/20">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
          <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
            <div>
              <p className="text-lg font-bold tracking-[0.12em] text-[var(--brand)] uppercase sm:text-xl">
                Cars &amp; Components
              </p>
              <SectionHeading className="mt-4 sm:text-[1.65rem] sm:leading-snug">
                Request a vehicle or shop the parts you need all in one place.
              </SectionHeading>
              <p className="mt-4 text-sm leading-relaxed text-zinc-400 sm:text-[0.9375rem]">
                If the right car isn&apos;t available, send us your brief and we&apos;ll source to your budget and timeline.
                Browse parts and accessories with clear pricing, or request items not yet listed.
              </p>
              <p className="mt-3 text-sm leading-relaxed text-zinc-400 sm:text-[0.9375rem]">
                With one team managing everything from first message to final handover, your experience stays simple,
                transparent, and stress-free.
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <Link
                  href="/request-a-car"
                  className="inline-flex h-11 flex-1 items-center justify-center rounded-lg bg-white px-6 text-sm font-semibold text-zinc-950 transition hover:bg-zinc-100 sm:min-w-[12rem] sm:flex-none"
                >
                  Request a car
                </Link>
                <Link
                  href="/request-autoparts"
                  className="inline-flex h-11 flex-1 items-center justify-center rounded-lg bg-[var(--brand)] px-6 text-sm font-semibold text-black transition hover:opacity-90 sm:min-w-[12rem] sm:flex-none"
                >
                  Request AutoParts or Accessories
                </Link>
              </div>
            </div>
            <ul className="space-y-3 text-sm text-zinc-300">
              {[
                "Not seeing the car you want? Send us a message, we will source to your budget and timeline.",
                "Parts and accessories with clear pricing; request items not yet listed when you need something specific.",
                "One team from first message to final handover, simple, transparent, and stress-free.",
              ].map((t) => (
                <li key={t} className="flex gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--brand)]" />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
