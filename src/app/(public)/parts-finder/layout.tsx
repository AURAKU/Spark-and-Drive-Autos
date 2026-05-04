/**
 * Orange + Spark teal atmosphere for all public Parts Finder routes (matches Gear storefront energy).
 */
export default function PartsFinderPublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="parts-theme relative isolate min-h-[calc(100dvh-4.5rem)] [--brand:#ef4444]">
      <div
        className="parts-theme-bg pointer-events-none absolute inset-0 z-0 opacity-[0.88]"
        style={{
          backgroundImage: [
            "radial-gradient(920px 500px at 8% 12%, rgba(239,68,68,0.28), transparent)",
            "radial-gradient(760px 440px at 88% 16%, rgba(20,216,230,0.22), transparent)",
            "radial-gradient(620px 400px at 18% 88%, rgba(20,216,230,0.14), transparent)",
            "linear-gradient(180deg, rgba(3,5,8,0.97), rgba(7,9,12,0.92))",
            "url('/brand/gear-storefront-theme.png')",
          ].join(", "),
          backgroundBlendMode: "screen,screen,screen,normal,overlay",
          backgroundSize: "auto,auto,auto,auto,cover",
        }}
        aria-hidden
      />
      <div className="relative z-[1] min-w-0">{children}</div>
    </div>
  );
}
