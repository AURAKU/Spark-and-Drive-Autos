"use client";

import { motion, useReducedMotion } from "framer-motion";
import Image from "next/image";
import type { ReactNode } from "react";

import { GUIDE_LIVE_HOST, type GuideMockKind } from "@/components/guides/platform-guide-data";
import { cn } from "@/lib/utils";

type MockProps = {
  kind: GuideMockKind;
  highlight: string;
  path: string;
};

export function GuidePageMock({ kind, highlight, path }: MockProps) {
  return (
    <MiniBrowser path={path} gear={kind === "parts" || kind === "parts-finder"}>
      {renderMock(kind, highlight)}
    </MiniBrowser>
  );
}

function MiniBrowser({ path, gear, children }: { path: string; gear?: boolean; children: ReactNode }) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-border bg-card shadow-[0_24px_60px_-32px_rgba(15,23,42,0.45)] ring-1 ring-foreground/5",
        gear && "[--brand:#ef4444] [--brand-readable:#dc2626]",
      )}
      aria-hidden
    >
      <div className="flex items-center gap-2 border-b border-border bg-muted/60 px-3 py-2">
        <span className="flex gap-1" aria-hidden>
          <span className="size-2 rounded-full bg-red-400/90" />
          <span className="size-2 rounded-full bg-amber-400/90" />
          <span className="size-2 rounded-full bg-emerald-400/90" />
        </span>
        <div className="min-w-0 flex-1 truncate rounded-full border border-border bg-background px-3 py-1 text-[10px] font-medium text-foreground sm:text-[11px]">
          {GUIDE_LIVE_HOST}
          {path}
        </div>
      </div>
      <MockHeader />
      <div className="relative min-h-[13.5rem] bg-background p-3 sm:min-h-[16rem] sm:p-4">{children}</div>
    </div>
  );
}

function MockHeader() {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-border bg-background px-3 py-2">
      <div className="flex items-center gap-1.5 rounded-full border border-border bg-muted/80 p-0.5">
        <span className="relative size-7 overflow-hidden rounded-full sm:size-8">
          <Image src="/brand/logo-emblem.png" alt="" fill sizes="32px" className="object-cover p-0.5" />
        </span>
      </div>
      <span className="hidden text-[10px] font-semibold tracking-[0.18em] text-[var(--brand-readable)] uppercase sm:inline">
        Spark &amp; Drive
      </span>
      <div className="flex items-center gap-1.5">
        <span className="grid size-7 place-items-center rounded-lg border border-border text-[10px] text-foreground">
          Aa
        </span>
        <span className="grid size-7 place-items-center rounded-lg border border-border text-[11px] font-semibold text-foreground">
          ☰
        </span>
      </div>
    </div>
  );
}

function Highlight({
  id,
  active,
  className,
  children,
}: {
  id: string;
  active: string;
  className?: string;
  children: ReactNode;
}) {
  const on = id === active;
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      className={cn("relative rounded-xl", on && "z-10", className)}
      animate={
        on && !reduceMotion
          ? { boxShadow: ["0 0 0 0 color-mix(in srgb, var(--brand) 50%, transparent)", "0 0 0 10px transparent"] }
          : on
            ? { boxShadow: "0 0 0 2px color-mix(in srgb, var(--brand) 70%, transparent)" }
            : { boxShadow: "0 0 0 0 transparent" }
      }
      transition={
        on && !reduceMotion ? { duration: 1.65, repeat: Infinity, ease: "easeOut" } : { duration: 0.2 }
      }
    >
      {on ? (
        <span className="absolute -top-2.5 left-2 z-20 rounded-full bg-[var(--brand)] px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-black uppercase">
          Tap here
        </span>
      ) : null}
      <div className={cn(on && "rounded-xl ring-2 ring-[var(--brand)] ring-offset-2 ring-offset-background")}>
        {children}
      </div>
    </motion.div>
  );
}

function renderMock(kind: GuideMockKind, highlight: string) {
  switch (kind) {
    case "header":
      return <HeaderMock highlight={highlight} />;
    case "home":
      return <HomeMock highlight={highlight} />;
    case "inventory":
      return <InventoryMock highlight={highlight} />;
    case "car-detail":
      return <CarDetailMock highlight={highlight} />;
    case "checkout":
      return <CheckoutMock highlight={highlight} />;
    case "parts":
      return <PartsMock highlight={highlight} />;
    case "parts-finder":
      return <PartsFinderMock highlight={highlight} />;
    case "request-car":
      return <RequestCarMock highlight={highlight} />;
    case "request-parts":
      return <RequestPartsMock highlight={highlight} />;
    case "motorcycles":
      return <MotorcyclesMock highlight={highlight} />;
    case "duty":
      return <DutyMock highlight={highlight} />;
    case "dashboard":
      return <DashboardMock highlight={highlight} />;
    case "ghana-card":
      return <GhanaCardMock highlight={highlight} />;
    case "wallet":
      return <WalletMock highlight={highlight} />;
    case "receipts":
      return <ReceiptsMock highlight={highlight} />;
    case "chat-gate":
      return <ChatGateMock highlight={highlight} />;
    case "chat-thread":
      return <ChatThreadMock highlight={highlight} />;
    case "policies":
      return <PoliciesMock highlight={highlight} />;
    default:
      return null;
  }
}

function HomeMock({ highlight }: { highlight: string }) {
  return (
    <div className="space-y-3">
      <div className="text-center">
        <p className="font-serif text-lg font-semibold tracking-tight text-foreground sm:text-xl">Spark and Drive</p>
        <p className="font-serif text-lg font-semibold tracking-tight text-foreground sm:text-xl">Autos</p>
        <p className="mt-1 text-[10px] text-foreground/80">Ghana · China · verified payments</p>
      </div>
      <div className="grid gap-1.5 sm:grid-cols-3">
        <Highlight id="browse-cars" active={highlight}>
          <div className="rounded-xl border-2 border-[var(--brand)] bg-[var(--brand)]/15 px-2 py-2.5 text-center text-[11px] font-semibold text-[var(--brand-readable)]">
            Browse cars
          </div>
        </Highlight>
        <Highlight id="browse-bikes" active={highlight}>
          <div className="rounded-xl bg-foreground px-2 py-2.5 text-center text-[11px] font-semibold text-background">
            Electric Bikes &amp; Motorcycles
          </div>
        </Highlight>
        <Highlight id="buy-parts" active={highlight}>
          <div className="rounded-xl bg-red-600 px-2 py-2.5 text-center text-[11px] font-semibold text-white">
            Buy Parts &amp; Accessories
          </div>
        </Highlight>
      </div>
      <Highlight id="parts-finder" active={highlight}>
        <div className="rounded-xl border border-orange-300 bg-orange-500 px-2 py-2 text-center text-[11px] font-semibold text-black">
          Spark Parts Finder
        </div>
      </Highlight>
      <Highlight id="request-paths" active={highlight}>
        <div className="flex flex-wrap justify-center gap-2 text-[10px] font-semibold text-[var(--brand-readable)]">
          <span className="rounded-full border border-[var(--brand)]/35 px-2 py-1">Request a car</span>
          <span className="rounded-full border border-[var(--brand)]/35 px-2 py-1">Request AutoParts</span>
        </div>
      </Highlight>
    </div>
  );
}

function HeaderMock({ highlight }: { highlight: string }) {
  return (
    <div className="space-y-3">
      <p className="text-[10px] font-semibold tracking-[0.16em] text-[var(--brand-readable)] uppercase">Header on every public page</p>
      <div className="flex items-center justify-between rounded-xl border border-border bg-muted/40 px-2 py-2">
        <Highlight id="logo-menu" active={highlight}>
          <div className="flex items-center gap-1 rounded-full border border-border bg-card px-1.5 py-1 text-[10px] font-semibold text-foreground">
            <span className="relative size-6 overflow-hidden rounded-full">
              <Image src="/brand/logo-emblem.png" alt="" fill sizes="24px" className="object-cover p-0.5" />
            </span>
            Home · Dashboard
          </div>
        </Highlight>
        <span className="text-[10px] font-medium text-foreground">Theme</span>
        <Highlight id="account-menu" active={highlight}>
          <div className="rounded-lg border border-border bg-card px-2 py-1.5 text-[10px] font-semibold text-foreground">
            ☰ Account · GHS
          </div>
        </Highlight>
      </div>
      <div className="rounded-xl border border-border bg-card p-3 text-[11px] leading-relaxed text-foreground">
        <p className="font-semibold">Account menu</p>
        <ul className="mt-2 space-y-1">
          <li>Login with email or phone</li>
          <li className="font-semibold text-[var(--brand-readable)]">Create Account</li>
          <li>Display currency (GHS / USD / CNY)</li>
        </ul>
      </div>
    </div>
  );
}

function InventoryMock({ highlight }: { highlight: string }) {
  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-bold text-[var(--brand-readable)]">Find Your Next Car</p>
        <p className="text-[10px] text-foreground/80">Ghana or China stock · in-transit excluded</p>
      </div>
      <Highlight id="apply-filters" active={highlight}>
        <div className="flex flex-wrap items-end gap-2 rounded-xl border border-border bg-muted/40 p-2">
          <span className="h-8 flex-1 rounded-lg border border-border bg-background px-2 text-[10px] leading-8 text-foreground">
            Brand, model…
          </span>
          <span className="h-8 rounded-lg border border-border bg-background px-2 text-[10px] leading-8 text-foreground">
            Available only
          </span>
          <span className="h-8 rounded-lg bg-[var(--brand)] px-3 text-[10px] font-semibold leading-8 text-black">
            Apply
          </span>
        </div>
      </Highlight>
      <div className="grid grid-cols-3 gap-2">
        {["Ghana · 15% dep.", "China · 15% dep.", "Ghana · Available"].map((label) => (
          <div key={label} className="rounded-lg border border-border bg-card p-2">
            <div className="mb-2 h-10 rounded-md bg-muted" />
            <p className="text-[9px] font-semibold text-foreground">{label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function CarDetailMock({ highlight }: { highlight: string }) {
  return (
    <div className="grid gap-3 sm:grid-cols-[1fr_1.1fr]">
      <div className="relative overflow-hidden rounded-xl border border-border bg-muted">
        <Image src="/brand/brand-hero-texture.png" alt="" fill className="object-cover opacity-80" sizes="240px" />
      </div>
      <div className="space-y-2">
        <span className="sda-chip-info">Ghana stock</span>
        <p className="text-sm font-bold text-foreground">2022 Toyota Land Cruiser</p>
        <p className="text-lg font-semibold text-[var(--brand-readable)]">GHS 1,250,000</p>
        <div className="grid grid-cols-2 gap-1 text-[10px] text-foreground">
          <span>Engine · Petrol</span>
          <span>Auto · 42,000 km</span>
        </div>
        <Highlight id="reserve-deposit" active={highlight}>
          <div className="flex flex-wrap gap-1.5">
            <span className="rounded-lg bg-[var(--brand)] px-2 py-1.5 text-[10px] font-semibold text-black">Pay full</span>
            <span className="rounded-lg border border-border bg-white px-2 py-1.5 text-[10px] font-semibold text-black">
              Reserve with deposit
            </span>
          </div>
        </Highlight>
      </div>
    </div>
  );
}

function CheckoutMock({ highlight }: { highlight: string }) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-bold text-[var(--brand-readable)]">Secure checkout</p>
      <div className="rounded-xl border border-border bg-card p-3 text-[11px] text-foreground">
        <p className="font-semibold">Reservation deposit</p>
        <p className="mt-1">15% of list total · GHS 187,500</p>
        <p className="mt-1 text-foreground/80">Remaining balance due within 21 days.</p>
      </div>
      <Highlight id="pay-checkout" active={highlight}>
        <div className="rounded-xl bg-[var(--brand)] px-3 py-2.5 text-center text-xs font-semibold text-black">
          Pay reservation deposit
        </div>
      </Highlight>
      <p className="sda-chip-warn w-fit">Account required to pay</p>
    </div>
  );
}

function PartsMock({ highlight }: { highlight: string }) {
  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-bold text-foreground">Parts &amp; Accessories</p>
          <p className="text-[10px] text-foreground/80">Ghana Stock is ready locally. Overseas Stock ships in.</p>
        </div>
        <span className="rounded-lg border border-red-400/40 px-2 py-1 text-[10px] font-semibold text-red-700 dark:text-red-200">
          Cart
        </span>
      </div>
      <div className="grid grid-cols-3 gap-1.5 text-center text-[10px] font-semibold">
        <span className="rounded-xl bg-red-600 py-2 text-white">Parts</span>
        <span className="rounded-xl border border-border py-2 text-foreground">Tools</span>
        <span className="rounded-xl border border-border py-2 text-foreground">Accessories</span>
      </div>
      <Highlight id="ghana-stock" active={highlight}>
        <div className="flex flex-wrap gap-1.5 text-[10px] font-semibold">
          <span className="rounded-full bg-red-600 px-2 py-1 text-white">Ghana Stock</span>
          <span className="rounded-full border border-border px-2 py-1 text-foreground">Overseas Stock</span>
        </div>
      </Highlight>
      <Highlight id="search-oem" active={highlight}>
        <div className="h-8 rounded-lg border border-border bg-background px-2 text-[10px] leading-8 text-foreground">
          Search OEM number or part name
        </div>
      </Highlight>
    </div>
  );
}

function PartsFinderMock({ highlight }: { highlight: string }) {
  return (
    <div className="space-y-3 rounded-xl border border-red-400/25 bg-zinc-950 p-3 text-zinc-100">
      <p className="text-sm font-semibold">Spark Parts Finder</p>
      <p className="text-[10px] leading-relaxed text-zinc-200">
        VIN, chassis, or vehicle details · OEM or equivalent matches · images and summaries.
      </p>
      <Highlight id="sign-in" active={highlight}>
        <div className="rounded-lg bg-[var(--brand)] px-3 py-2 text-center text-[11px] font-semibold text-black">
          Sign in to activate
        </div>
      </Highlight>
      <Highlight id="vin-search" active={highlight}>
        <div className="h-8 rounded-lg border border-white/20 bg-black/40 px-2 text-[10px] leading-8">
          VIN / chassis · OEM number
        </div>
      </Highlight>
      <Highlight id="next-steps" active={highlight}>
        <div className="flex flex-wrap gap-1.5 text-[10px] font-semibold">
          <span className="rounded-lg border border-white/20 px-2 py-1">Shop catalog</span>
          <span className="rounded-lg border border-white/20 px-2 py-1">Request AutoParts</span>
        </div>
      </Highlight>
    </div>
  );
}

function RequestCarMock({ highlight }: { highlight: string }) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-bold text-[var(--brand-readable)]">Request a car</p>
      <p className="text-[11px] leading-relaxed text-foreground">
        Vehicle sourcing is for signed-in customers so the enquiry stays on your account.
      </p>
      <Highlight id="create-account" active={highlight}>
        <div className="flex gap-2">
          <span className="flex-1 rounded-lg bg-[var(--brand)] py-2 text-center text-[11px] font-semibold text-black">
            Create Account
          </span>
          <span className="flex-1 rounded-lg border border-border py-2 text-center text-[11px] font-semibold text-foreground">
            Sign in
          </span>
        </div>
      </Highlight>
    </div>
  );
}

function RequestPartsMock({ highlight }: { highlight: string }) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-bold text-[var(--brand-readable)]">Request AutoParts or Accessories</p>
      <p className="text-[11px] text-foreground">Describe the part and the vehicle. A request fee is charged first.</p>
      <div className="h-16 rounded-lg border border-border bg-muted/40 px-2 py-1 text-[10px] text-foreground/80">
        e.g. Front brake pads + sensor for 2019 RAV4
      </div>
      <Highlight id="pay-fee" active={highlight}>
        <div className="rounded-lg bg-[var(--brand)] py-2 text-center text-[11px] font-semibold text-black">
          Pay request fee
        </div>
      </Highlight>
    </div>
  );
}

function MotorcyclesMock({ highlight }: { highlight: string }) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-bold text-[var(--brand-readable)]">Motorcycles &amp; E-Bikes</p>
      <Highlight id="fuel-filter" active={highlight}>
        <div className="flex flex-wrap gap-1.5">
          <span className="rounded-lg border border-border bg-background px-2 py-1 text-[10px] text-foreground">Ghana</span>
          <span className="rounded-lg border border-border bg-background px-2 py-1 text-[10px] text-foreground">
            Electric
          </span>
          <span className="rounded-lg bg-foreground px-2 py-1 text-[10px] font-semibold text-background">Filter</span>
        </div>
      </Highlight>
      <div className="grid grid-cols-3 gap-2">
        {["Scooter", "Sport", "E-bike"].map((label) => (
          <div key={label} className="rounded-lg border border-border bg-card p-2">
            <div className="mb-2 h-9 rounded-md bg-muted" />
            <p className="text-[9px] font-semibold text-foreground">{label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function DutyMock({ highlight }: { highlight: string }) {
  return (
    <div className="space-y-3">
      <p className="text-[10px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">Import planning</p>
      <Highlight id="duty-calc" active={highlight}>
        <div className="rounded-xl border border-[var(--brand)]/30 bg-[var(--brand)]/10 p-3">
          <p className="text-[11px] font-semibold text-[var(--brand-readable)]">Duty Intelligence</p>
          <div className="mt-2 grid grid-cols-2 gap-2 text-[10px] text-foreground">
            <span className="rounded-lg border border-border bg-background px-2 py-1.5">FOB amount</span>
            <span className="rounded-lg border border-border bg-background px-2 py-1.5">Year · fuel</span>
          </div>
          <span className="mt-2 inline-flex rounded-lg bg-[var(--brand)] px-2 py-1 text-[10px] font-semibold text-black">
            Estimate duty
          </span>
        </div>
      </Highlight>
      <Highlight id="disclaimer" active={highlight}>
        <p className="rounded-lg border border-border bg-card px-2 py-2 text-[10px] leading-relaxed text-foreground">
          Planning figure only. Final charges are set by Ghana Customs at clearance. List price is a non-CIF placeholder.
        </p>
      </Highlight>
    </div>
  );
}

function DashboardMock({ highlight }: { highlight: string }) {
  const items = [
    { id: "overview", label: "Overview" },
    { id: "inquiry", label: "Customer Inquiry & Request" },
    { id: "duty-estimates", label: "Duty Estimates" },
    { id: "messages", label: "Messages" },
    { id: "legal", label: "Legal status" },
  ];
  return (
    <div className="grid grid-cols-[7.5rem_1fr] gap-2 sm:grid-cols-[9rem_1fr]">
      <nav className="space-y-1 rounded-xl border border-border bg-muted/40 p-2">
        {items.map((item) => (
          <Highlight key={item.id} id={item.id} active={highlight}>
            <div
              className={cn(
                "rounded-md px-1.5 py-1 text-[10px] font-medium text-foreground",
                highlight === item.id && "bg-card",
              )}
            >
              {item.label}
            </div>
          </Highlight>
        ))}
      </nav>
      <div className="rounded-xl border border-border bg-card p-3">
        <p className="text-[10px] font-semibold tracking-[0.14em] text-[var(--brand-readable)] uppercase">Customer</p>
        <p className="mt-2 text-xs font-semibold text-foreground">Dashboard</p>
        <p className="mt-1 text-[10px] leading-relaxed text-foreground/80">
          Orders, payments, wallet, Ghana Card, and estimates stay on your signed-in account.
        </p>
      </div>
    </div>
  );
}

function GhanaCardMock({ highlight }: { highlight: string }) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-bold text-[var(--brand-readable)]">Ghana Card</p>
      <p className="text-[11px] text-foreground">Number and expiry are used at checkout and delivery.</p>
      <div className="grid gap-2">
        <span className="rounded-lg border border-border bg-background px-2 py-1.5 text-[10px] text-foreground">
          GHA-XXXXXXXX-X
        </span>
        <span className="rounded-lg border border-border bg-background px-2 py-1.5 text-[10px] text-foreground">
          Expiry date
        </span>
      </div>
      <Highlight id="ghana-save" active={highlight}>
        <div className="rounded-lg bg-[var(--brand)] py-2 text-center text-[11px] font-semibold text-black">
          Save Ghana Card details
        </div>
      </Highlight>
      <span className="sda-chip-warn">Waiting for review</span>
    </div>
  );
}

function WalletMock({ highlight }: { highlight: string }) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-bold text-[var(--brand-readable)]">Storefront wallet</p>
      <p className="text-2xl font-bold tabular-nums text-foreground">GHS 0.00</p>
      <p className="text-[11px] leading-relaxed text-foreground">
        For parts and accessories checkout. Add funds via Paystack (mobile money).
      </p>
      <Highlight id="wallet-topup" active={highlight}>
        <div className="rounded-lg bg-[var(--brand)] py-2 text-center text-[11px] font-semibold text-black">
          Add funds
        </div>
      </Highlight>
    </div>
  );
}

function ReceiptsMock({ highlight }: { highlight: string }) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-bold text-[var(--brand-readable)]">My receipts</p>
      <div className="overflow-hidden rounded-xl border border-border text-[10px]">
        <div className="grid grid-cols-3 bg-muted/60 px-2 py-1.5 font-semibold text-foreground">
          <span>Receipt</span>
          <span>Amount</span>
          <span>PDF</span>
        </div>
        <div className="grid grid-cols-3 items-center px-2 py-2 text-foreground">
          <span className="font-mono">SDA-R-1042</span>
          <span>GHS 187,500</span>
          <Highlight id="download-receipt" active={highlight}>
            <span className="rounded-md bg-[var(--brand)] px-2 py-1 font-semibold text-black">Download</span>
          </Highlight>
        </div>
      </div>
    </div>
  );
}

function ChatGateMock({ highlight }: { highlight: string }) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-bold text-[var(--brand-readable)]">Customer Service Live Support Chat</p>
      <p className="text-[11px] leading-relaxed text-foreground">
        Guests can ask SPARK here. Sign in only if you want the chat saved to your dashboard.
      </p>
      <Highlight id="create-account" active={highlight}>
        <div className="flex gap-2">
          <span className="flex-1 rounded-lg bg-[var(--brand)] py-2 text-center text-[11px] font-semibold text-black">
            Create Account
          </span>
          <span className="flex-1 rounded-lg border border-border py-2 text-center text-[11px] font-semibold text-foreground">
            Sign in
          </span>
        </div>
      </Highlight>
      <Highlight id="start-chat" active={highlight}>
        <div className="rounded-lg border border-[var(--brand)]/40 py-2 text-center text-[11px] font-semibold text-[var(--brand-readable)]">
          Continue to live support
        </div>
      </Highlight>
    </div>
  );
}

function ChatThreadMock({ highlight }: { highlight: string }) {
  return (
    <div className="flex h-full min-h-[14rem] flex-col">
      <div className="flex-1 space-y-2">
        <div className="max-w-[80%] rounded-2xl rounded-tl-md bg-muted px-3 py-2 text-[10px] text-foreground">
          Hello. Share the car listing or OEM number and we will pick it up from here.
        </div>
        <div className="ml-auto max-w-[80%] rounded-2xl rounded-tr-md bg-[var(--brand)]/20 px-3 py-2 text-[10px] text-foreground">
          2019 RAV4 · front pads · OEM 04465-42180
        </div>
      </div>
      <Highlight id="composer" active={highlight} className="mt-3">
        <div className="flex items-center gap-2 rounded-full border border-border bg-background px-2 py-1.5">
          <span className="flex-1 text-[10px] text-foreground/70">Message the team…</span>
          <span className="grid size-8 place-items-center rounded-full bg-[var(--brand)] text-[10px] font-bold text-black">
            ●
          </span>
        </div>
      </Highlight>
    </div>
  );
}

function PoliciesMock({ highlight }: { highlight: string }) {
  const items = [
    { id: "all-policies", label: "All policies", hint: "Index of every public policy" },
    { id: "reservation-policy", label: "Reservation Policy", hint: "Deposit, hold, lapse" },
    { id: "refunds", label: "Refund Policy", hint: "When refunds apply" },
    { id: "sourcing", label: "Sourcing Policy", hint: "Best-effort terms" },
  ];
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <Highlight key={item.id} id={item.id} active={highlight}>
          <div className="rounded-xl border border-border bg-card px-3 py-2">
            <p className="text-[11px] font-semibold text-[var(--brand-readable)]">{item.label}</p>
            <p className="text-[10px] text-foreground/80">{item.hint}</p>
          </div>
        </Highlight>
      ))}
    </div>
  );
}
