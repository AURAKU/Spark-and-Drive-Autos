"use client";

import {
  Car,
  CircleDot,
  CircleDollarSign,
  MapPin,
  Package,
  PackageOpen,
  Plane,
  ShieldAlert,
  Ship,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "framer-motion";
import { useEffect, useMemo } from "react";

import { cn } from "@/lib/utils";

type StatTone = "brand" | "sky" | "amber" | "emerald" | "rose" | "zinc";

type StatCard = {
  label: string;
  value: string | number;
};

const TONE_STYLES: Record<
  StatTone,
  { bar: string; glow: string; icon: string; chip: string }
> = {
  brand: {
    bar: "from-[var(--brand)] via-[var(--brand)]/70 to-transparent",
    glow: "group-hover:shadow-[0_0_40px_-12px_color-mix(in_oklab,var(--brand)_55%,transparent)]",
    icon: "text-[var(--brand)] bg-[var(--brand)]/12 border-[var(--brand)]/25",
    chip: "bg-[var(--brand)]/10 text-[var(--brand)]",
  },
  sky: {
    bar: "from-sky-400 via-sky-400/70 to-transparent",
    glow: "group-hover:shadow-[0_0_40px_-12px_rgba(56,189,248,0.45)]",
    icon: "text-sky-300 bg-sky-400/10 border-sky-400/25",
    chip: "bg-sky-400/10 text-sky-200",
  },
  amber: {
    bar: "from-amber-400 via-amber-400/70 to-transparent",
    glow: "group-hover:shadow-[0_0_40px_-12px_rgba(251,191,36,0.4)]",
    icon: "text-amber-300 bg-amber-400/10 border-amber-400/25",
    chip: "bg-amber-400/10 text-amber-100",
  },
  emerald: {
    bar: "from-emerald-400 via-emerald-400/70 to-transparent",
    glow: "group-hover:shadow-[0_0_40px_-12px_rgba(52,211,153,0.4)]",
    icon: "text-emerald-300 bg-emerald-400/10 border-emerald-400/25",
    chip: "bg-emerald-400/10 text-emerald-100",
  },
  rose: {
    bar: "from-rose-400 via-rose-400/70 to-transparent",
    glow: "group-hover:shadow-[0_0_40px_-12px_rgba(251,113,133,0.4)]",
    icon: "text-rose-300 bg-rose-400/10 border-rose-400/25",
    chip: "bg-rose-400/10 text-rose-100",
  },
  zinc: {
    bar: "from-zinc-300 via-zinc-400/50 to-transparent",
    glow: "group-hover:shadow-[0_0_32px_-14px_rgba(255,255,255,0.2)]",
    icon: "text-zinc-300 bg-white/5 border-white/10",
    chip: "bg-white/5 text-zinc-300",
  },
};

function toneForLabel(label: string): StatTone {
  const l = label.toLowerCase();
  if (l.includes("low-stock") || l.includes("low stock")) return "rose";
  if (l.includes("sold") || l.includes("reserved") || l.includes("pre-order")) return "amber";
  if (l.includes("published") || l.includes("available")) return "emerald";
  if (l.includes("ship") || l.includes("transit") || l.includes("china")) return "sky";
  if (l.includes("part")) return "sky";
  if (l.includes("vehicle") || l.includes("car") || l.includes("ghana")) return "brand";
  return "zinc";
}

function iconForLabel(label: string): LucideIcon {
  const l = label.toLowerCase();
  if (l.includes("low-stock") || l.includes("low stock")) return ShieldAlert;
  if (l.includes("pre-order")) return PackageOpen;
  if (l.includes("sold")) return CircleDollarSign;
  if (l.includes("ship")) return Ship;
  if (l.includes("transit")) return Plane;
  if (l.includes("reserved")) return CircleDot;
  if (l.includes("ghana") || l.includes("china")) return MapPin;
  if (l.includes("part")) return Package;
  if (l.includes("vehicle") || l.includes("car") || l.includes("listing")) return Car;
  return Sparkles;
}

function parseNumeric(value: string | number): { n: number; prefix: string; suffix: string } | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return { n: value, prefix: "", suffix: "" };
  }
  const raw = String(value).trim();
  const m = raw.match(/^([^0-9\-+]*)([-+]?\d[\d,]*(?:\.\d+)?)(.*)$/);
  if (!m) return null;
  const n = Number(m[2].replace(/,/g, ""));
  if (!Number.isFinite(n)) return null;
  return { n, prefix: m[1] ?? "", suffix: m[3] ?? "" };
}

function AnimatedCount({ value, className }: { value: string | number; className?: string }) {
  const reduceMotion = useReducedMotion();
  const parsed = useMemo(() => parseNumeric(value), [value]);
  const motionValue = useMotionValue(0);
  const spring = useSpring(motionValue, { stiffness: 90, damping: 22, mass: 0.8 });
  const display = useTransform(spring, (latest) => {
    if (!parsed) return String(value);
    const rounded = Number.isInteger(parsed.n) ? Math.round(latest) : Math.round(latest * 10) / 10;
    return `${parsed.prefix}${rounded.toLocaleString()}${parsed.suffix}`;
  });

  useEffect(() => {
    if (!parsed || reduceMotion) {
      motionValue.set(parsed?.n ?? 0);
      return;
    }
    motionValue.set(0);
    const id = requestAnimationFrame(() => motionValue.set(parsed.n));
    return () => cancelAnimationFrame(id);
  }, [parsed, reduceMotion, motionValue, value]);

  if (!parsed) {
    return <span className={className}>{String(value)}</span>;
  }

  if (reduceMotion) {
    return (
      <span className={className}>
        {parsed.prefix}
        {parsed.n.toLocaleString()}
        {parsed.suffix}
      </span>
    );
  }

  return <motion.span className={className}>{display}</motion.span>;
}

function StatTile({ card, index }: { card: StatCard; index: number }) {
  const tone = toneForLabel(card.label);
  const styles = TONE_STYLES[tone];
  const Icon = iconForLabel(card.label);
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      layout={false}
      initial={reduceMotion ? false : { opacity: 0, y: 18, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        duration: 0.45,
        delay: reduceMotion ? 0 : Math.min(index * 0.045, 0.4),
        ease: [0.22, 1, 0.36, 1],
      }}
      whileHover={reduceMotion ? undefined : { y: -3, transition: { duration: 0.2 } }}
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/80 p-4 shadow-lg shadow-black/25",
        "transition-[border-color,background-color] duration-300 hover:border-white/20 hover:bg-zinc-950",
        styles.glow,
      )}
    >
      <div
        aria-hidden
        className={cn("pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r opacity-90", styles.bar)}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-8 -top-10 size-28 rounded-full bg-white/[0.04] blur-2xl transition-opacity duration-500 group-hover:opacity-100"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_0%_0%,rgba(255,255,255,0.06),transparent_55%)]"
      />

      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold tracking-[0.16em] text-zinc-500 uppercase">{card.label}</p>
          <AnimatedCount
            value={card.value}
            className="mt-2 block text-3xl font-semibold tracking-tight tabular-nums text-white sm:text-[1.85rem]"
          />
        </div>
        <span
          className={cn(
            "inline-flex size-9 shrink-0 items-center justify-center rounded-xl border transition duration-300 group-hover:scale-105",
            styles.icon,
          )}
        >
          <Icon className="size-4" strokeWidth={2} aria-hidden />
        </span>
      </div>

      <div className="relative mt-4 flex items-center gap-2">
        <span className={cn("rounded-md px-1.5 py-0.5 text-[9px] font-semibold tracking-wide uppercase", styles.chip)}>
          Live
        </span>
        <motion.span
          aria-hidden
          className="h-1 flex-1 overflow-hidden rounded-full bg-white/5"
        >
          <motion.span
            className={cn("block h-full rounded-full bg-gradient-to-r", styles.bar)}
            initial={reduceMotion ? { scaleX: 1 } : { scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{
              duration: 0.7,
              delay: reduceMotion ? 0 : 0.15 + Math.min(index * 0.04, 0.35),
              ease: [0.22, 1, 0.36, 1],
            }}
            style={{ originX: 0 }}
          />
        </motion.span>
      </div>
    </motion.div>
  );
}

export function CommandCenterStatGrid({ cards }: { cards: StatCard[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
      {cards.map((card, index) => (
        <StatTile key={card.label} card={card} index={index} />
      ))}
    </div>
  );
}
