"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { PartsFinderUserDashboardStats } from "@/lib/parts-finder/dashboard-stats";
import type { PartsFinderActivationSnapshot } from "@/lib/parts-finder/pricing";
import type { MembershipAccessSnapshot, PartsFinderMembershipState } from "@/lib/parts-finder/search-types";
import { PartsFinderCtaLink } from "@/components/parts-finder/parts-finder-cta-link";
import { cn } from "@/lib/utils";

export type PartsFinderMembershipPanelInitial = {
  access: MembershipAccessSnapshot;
  pricing: PartsFinderActivationSnapshot;
  stats: PartsFinderUserDashboardStats;
  serverTime: string;
};

type StatusPayload = {
  ok: true;
  access: MembershipAccessSnapshot;
  pricing: PartsFinderActivationSnapshot;
  stats: PartsFinderUserDashboardStats;
  serverTime: string;
};

const PAYMENT_IN_FLIGHT = new Set(["PENDING", "AWAITING_PROOF", "PROCESSING"]);

function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return "—";
  }
}

function daysRemaining(activeUntil: string | null, serverTime: string) {
  if (!activeUntil) return null;
  const end = new Date(activeUntil).getTime();
  const now = new Date(serverTime).getTime();
  return Math.max(0, Math.ceil((end - now) / (24 * 60 * 60 * 1000)));
}

function flowPosition(state: PartsFinderMembershipState): 0 | 1 | 2 {
  if (state === "ACTIVE") return 2;
  if (state === "PENDING_PAYMENT") return 1;
  return 0;
}

function statusLabel(state: PartsFinderMembershipState): string {
  switch (state) {
    case "ACTIVE":
      return "Active";
    case "PENDING_PAYMENT":
      return "Payment pending";
    case "EXPIRED":
      return "Expired";
    case "SUSPENDED":
      return "Suspended";
    case "INACTIVE":
      return "Not activated";
    default:
      return state;
  }
}

function StatusDot({ className }: { className?: string }) {
  return <span className={cn("inline-block h-2 w-2 rounded-full", className)} aria-hidden />;
}

function ActivationFlow({ focusStep }: { focusStep: 0 | 1 | 2 }) {
  const steps = [
    { title: "Pay", sub: "Checkout" },
    { title: "Confirm", sub: "Provider sync" },
    { title: "Access", sub: "Unlocked" },
  ] as const;

  return (
    <div className="relative">
      <div className="flex items-start justify-between gap-1 sm:gap-2">
        {steps.map((s, i) => {
          const pipelineComplete = focusStep === 2;
          const done = pipelineComplete || i < focusStep;
          const active = !pipelineComplete && i === focusStep;
          const upcoming = !pipelineComplete && i > focusStep;
          return (
            <div key={s.title} className="flex min-w-0 flex-1 flex-col items-center text-center">
              <motion.div
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-full border-2 text-xs font-bold sm:h-11 sm:w-11",
                  done && "border-[var(--brand)] bg-[var(--brand)]/20 text-[var(--brand)]",
                  active && "border-[var(--brand)] bg-[var(--brand)]/10 text-white shadow-[0_0_24px_-4px_rgba(20,216,230,0.45)] ring-2 ring-[var(--brand)]/30",
                  upcoming && "border-white/15 bg-white/[0.04] text-zinc-500",
                )}
                animate={active ? { scale: [1, 1.04, 1] } : { scale: 1 }}
                transition={active ? { repeat: Infinity, duration: 2.2, ease: "easeInOut" } : undefined}
              >
                {done ? "✓" : i + 1}
              </motion.div>
              <p className="mt-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-300 sm:text-xs">{s.title}</p>
              <p className="mt-0.5 hidden text-[10px] text-zinc-500 sm:block">{s.sub}</p>
            </div>
          );
        })}
      </div>
      <div className="pointer-events-none absolute top-5 right-[calc(16.66%+6px)] left-[calc(16.66%+6px)] hidden h-0.5 -translate-y-1/2 sm:block">
        <div className="h-full w-full bg-gradient-to-r from-[var(--brand)]/0 via-white/10 to-white/10" />
      </div>
    </div>
  );
}

function DaysProgressRing({
  daysLeft,
  windowDays,
  className,
}: {
  daysLeft: number;
  windowDays: number;
  className?: string;
}) {
  const pct = windowDays > 0 ? Math.min(100, Math.max(0, (daysLeft / windowDays) * 100)) : 0;
  const r = 40;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;
  return (
    <div className={cn("relative flex h-28 w-28 items-center justify-center", className)}>
      <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100" aria-hidden>
        <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8" />
        <motion.circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke="var(--brand)"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: offset }}
          transition={{ type: "spring", stiffness: 60, damping: 20 }}
        />
      </svg>
      <div className="absolute flex flex-col items-center text-center">
        <span className="text-2xl font-bold tabular-nums text-white">{daysLeft}</span>
        <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">days left</span>
      </div>
    </div>
  );
}

export function PartsFinderMembershipPanel({ initial }: { initial: PartsFinderMembershipPanelInitial }) {
  const router = useRouter();
  const [data, setData] = useState<PartsFinderMembershipPanelInitial>(initial);
  const previousState = useRef(initial.access.state);

  const shouldPoll = useMemo(() => {
    const s = data.access.state;
    const p = data.stats.latestPayment?.status;
    if (s === "PENDING_PAYMENT") return true;
    if (p && PAYMENT_IN_FLIGHT.has(p)) return true;
    return false;
  }, [data.access.state, data.stats.latestPayment?.status]);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/parts-finder/membership-status", { cache: "no-store" });
    const json = (await res.json().catch(() => ({}))) as StatusPayload | { ok: false };
    if (!res.ok || !("ok" in json) || !json.ok) return;
    setData({
      access: json.access,
      pricing: json.pricing,
      stats: json.stats,
      serverTime: json.serverTime,
    });
    if (previousState.current === "PENDING_PAYMENT" && json.access.state === "ACTIVE") {
      router.refresh();
    }
    previousState.current = json.access.state;
  }, [router]);

  useEffect(() => {
    if (!shouldPoll) return;
    void refresh();
    const t = window.setInterval(() => void refresh(), 5000);
    const onVis = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(t);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [shouldPoll, refresh]);

  const focusStep = flowPosition(data.access.state);
  const { access, pricing, stats, serverTime } = data;
  const left = daysRemaining(access.activeUntil, serverTime);
  const showRing = access.state === "ACTIVE" && access.activeUntil && left !== null;
  const activateCta =
    access.state === "PENDING_PAYMENT"
      ? "Payment pending"
      : access.state === "SUSPENDED"
        ? "Suspended"
        : access.state === "EXPIRED"
          ? "Renew access"
          : "Activate or renew";

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.07] to-white/[0.02] shadow-[0_0_40px_-20px_rgba(20,216,230,0.35)]">
        <div className="border-b border-white/10 bg-black/20 px-4 py-3 sm:px-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--brand)]">Activation analysis</p>
              <p className="mt-0.5 text-xs text-zinc-500">Live sync with payment status — updates when your provider confirms.</p>
            </div>
            {shouldPoll ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--brand)]/30 bg-[var(--brand)]/10 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-[var(--brand)]">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--brand)] opacity-40" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--brand)]" />
                </span>
                Listening
              </span>
            ) : null}
          </div>
        </div>

        <div className="grid gap-6 p-4 sm:grid-cols-[1fr_auto] sm:items-center sm:gap-8 sm:p-6">
          <div className="space-y-4">
            <ActivationFlow focusStep={focusStep} />
            <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm">
              <StatusDot
                className={cn(
                  access.state === "ACTIVE" && "bg-emerald-400",
                  access.state === "PENDING_PAYMENT" && "bg-amber-400",
                  access.state === "EXPIRED" && "bg-rose-400",
                  access.state === "SUSPENDED" && "bg-zinc-500",
                  access.state === "INACTIVE" && "bg-zinc-500",
                )}
              />
              <span className="font-medium text-zinc-200">Membership</span>
              <span className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 font-mono text-xs text-zinc-300">
                {statusLabel(access.state)}
              </span>
            </div>
            <dl className="grid gap-2 text-sm text-zinc-400 sm:grid-cols-2">
              <div className="rounded-lg border border-white/5 bg-black/20 p-3">
                <dt className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Activation window</dt>
                <dd className="mt-1 text-white">{pricing.defaultDurationDays} days / {pricing.currency}</dd>
              </div>
              <div className="rounded-lg border border-white/5 bg-black/20 p-3">
                <dt className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Activated</dt>
                <dd className="mt-1 text-zinc-200">{formatDate(access.activeFrom)}</dd>
              </div>
              <div className="rounded-lg border border-white/5 bg-black/20 p-3">
                <dt className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Expires</dt>
                <dd className="mt-1 text-zinc-200">{formatDate(access.activeUntil)}</dd>
              </div>
              <div className="rounded-lg border border-white/5 bg-black/20 p-3">
                <dt className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Time remaining</dt>
                <dd className="mt-1 text-zinc-200">
                  {access.state === "ACTIVE" && left !== null ? (
                    <span>
                      {left} day{left === 1 ? "" : "s"} left
                    </span>
                  ) : access.state === "PENDING_PAYMENT" ? (
                    <span className="text-amber-200/90">Awaiting successful payment</span>
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
            </dl>
            {stats.latestPayment && access.state === "PENDING_PAYMENT" ? (
              <p className="text-xs text-zinc-500">
                Latest ref:{" "}
                <span className="font-mono text-zinc-300">{stats.latestPayment.providerReference}</span> ·{" "}
                {stats.latestPayment.status}
              </p>
            ) : null}
            {access.suspensionReason ? (
              <p className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-100/90">
                {access.suspensionReason}
              </p>
            ) : null}
          </div>

          {showRing && left !== null ? (
            <div className="flex flex-col items-center justify-center sm:border-l sm:border-white/10 sm:pl-6">
              <DaysProgressRing daysLeft={left} windowDays={pricing.defaultDurationDays} />
              <p className="mt-2 text-center text-[10px] text-zinc-500">Access window progress</p>
            </div>
          ) : (
            <div className="hidden sm:block" />
          )}
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Engagement</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {[
            { label: "Your activations", value: stats.userSuccessfulActivations, hint: "Successful membership payments" },
            { label: "Your searches", value: stats.userSearchSessions, hint: "Parts Finder sessions" },
            { label: "Platform activations", value: pricing.successfulActivations, hint: "All users, all time" },
          ].map((c) => (
            <motion.div
              key={c.label}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl border border-white/10 bg-white/[0.04] p-4"
            >
              <p className="text-2xl font-semibold tabular-nums text-white">{c.value}</p>
              <p className="mt-1 text-xs font-medium text-zinc-300">{c.label}</p>
              <p className="mt-0.5 text-[10px] text-zinc-500">{c.hint}</p>
            </motion.div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {access.allowSearch ? (
          <Link
            href="/dashboard/parts-finder/searches"
            className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-sm text-zinc-200 transition hover:border-[var(--brand)]/40 hover:bg-white/[0.08]"
          >
            Search history
          </Link>
        ) : null}
        <PartsFinderCtaLink href="/parts-finder/search" size="compact" className="!px-3.5 text-sm">
          Find Parts
        </PartsFinderCtaLink>
        <PartsFinderCtaLink href="/parts-finder/activate" size="compact" className="!px-3.5 text-sm">
          {activateCta}
        </PartsFinderCtaLink>
      </div>
    </div>
  );
}
