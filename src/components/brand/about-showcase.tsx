import Image from "next/image";

export function AboutShowcase() {
  return (
    <figure className="sda-about-showcase relative mt-8 aspect-[16/9] w-full max-w-3xl overflow-hidden rounded-2xl border border-[var(--brand)]/30 bg-black/40 shadow-[0_0_48px_-12px_rgba(20,216,230,0.35)]">
      <Image
        src="/brand/about-brand-showcase.png"
        alt="Spark & Drive Autos brand illustration"
        fill
        className="sda-about-showcase-img object-cover object-center"
        sizes="(max-width: 896px) 100vw, 896px"
        priority
      />
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <span className="sda-about-showcase-bay" />
        <span className="sda-about-showcase-road" />
        <span className="sda-about-showcase-lane" />
        <span className="sda-about-showcase-sweep" />
        <span className="sda-about-showcase-headlamp sda-about-showcase-headlamp--left" />
        <span className="sda-about-showcase-headlamp sda-about-showcase-headlamp--right" />
      </div>
    </figure>
  );
}
