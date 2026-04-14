import Image from "next/image";
import { Anton } from "next/font/google";

const display = Anton({
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

/**
 * Electric bikes & motorcycles “coming soon” page — single brand background
 * (`/public/brand/motorcycle-coming-soon-bg.jpg`).
 */
export function BikesMotorcyclesComingSoon() {
  return (
    <section
      aria-label="Electric bikes and motorcycles — coming soon"
      className={`relative min-h-[min(88dvh,900px)] w-full overflow-hidden border-y border-white/10 ${display.className}`}
    >
      <div className="absolute inset-0">
        <Image
          src="/brand/motorcycle-coming-soon-bg.jpg"
          alt="Motorcycle preview"
          fill
          className="object-cover object-center"
          sizes="100vw"
          priority
        />
      </div>

      <div
        className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-b from-black/55 via-black/45 to-black/70"
        aria-hidden
      />

      <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center px-4 text-center">
        <p className="max-w-[min(96vw,40rem)] text-[clamp(2.25rem,10vw,5.5rem)] font-black leading-[0.95] tracking-[0.06em] text-white uppercase drop-shadow-[0_4px_32px_rgba(0,0,0,0.9)]">
          Coming soon
        </p>
        <p className="mt-5 max-w-[min(92vw,36rem)] rounded-lg border-2 border-[var(--brand)] bg-[var(--brand)]/20 px-4 py-3 text-[clamp(0.65rem,3vw,1.2rem)] font-sans font-extrabold tracking-[0.22em] text-[var(--brand)] uppercase shadow-[0_0_48px_-4px_rgba(20,216,230,0.65)] backdrop-blur-sm sm:mt-6 sm:px-6 sm:py-3.5">
          Check again shortly
        </p>
      </div>
    </section>
  );
}
