"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Loader2, ShieldCheck, Sparkles, Wallet } from "lucide-react";
import { toast } from "sonner";

import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const MIN_TOPUP = 50;
const PRESET_AMOUNTS = [50, 100, 200, 500, 1000] as const;

function formatGhs(n: number, compact = false) {
  if (compact) {
    return `GHS ${Math.round(n).toLocaleString()}`;
  }
  return `GHS ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export type WalletTopupFlowVariant = "card" | "compact" | "embed";

const DEFAULT_SUPPORTING_CARD =
  "Fund your wallet through Paystack using mobile money, bank transfer, or card. Once your payment is authorised, your balance updates immediately so you can complete parts checkout without leaving the flow.";

const DEFAULT_SUPPORTING_COMPACT =
  "You will complete payment on Paystack. After it succeeds, return here to pay from your wallet.";

export type WalletTopupFlowProps = {
  walletBalance: number;
  isSignedIn?: boolean;
  /** Shortfall (e.g. cart total − balance). Adds a “cover gap” chip and nudges amount up. */
  gapGhs?: number;
  defaultAmount?: number;
  variant?: WalletTopupFlowVariant;
  /** Show large balance readout (hide when balance is shown elsewhere). */
  showBalance?: boolean;
  heading?: string;
  /** Professional supporting copy under the heading (card / compact). Overrides built-in defaults when set. */
  supportingText?: string;
  className?: string;
  signInHref?: string;
};

/**
 * Shared wallet top-up UI: amount presets, custom entry, Paystack handoff.
 * Used on parts pages, cart, buy dialog, and dashboard profile.
 */
export function WalletTopupFlow({
  walletBalance,
  isSignedIn = true,
  gapGhs,
  defaultAmount = 100,
  variant = "card",
  showBalance = true,
  heading,
  supportingText,
  className,
  signInHref = "/login?callbackUrl=%2Fparts",
}: WalletTopupFlowProps) {
  const coverAmount = useMemo(() => {
    if (gapGhs == null || gapGhs <= 0) return null;
    return Math.max(MIN_TOPUP, Math.ceil(gapGhs));
  }, [gapGhs]);

  const chipValues = useMemo(() => {
    const set = new Set<number>([...PRESET_AMOUNTS]);
    if (coverAmount != null) set.add(coverAmount);
    return Array.from(set).sort((a, b) => a - b);
  }, [coverAmount]);

  const [amount, setAmount] = useState(() => {
    if (coverAmount != null) return coverAmount;
    return Math.max(MIN_TOPUP, defaultAmount);
  });

  useEffect(() => {
    if (coverAmount == null) return;
    setAmount((prev) => (prev < coverAmount ? coverAmount : prev));
  }, [coverAmount]);

  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!isSignedIn) {
      toast.error("Sign in to add funds to your wallet.");
      return;
    }
    if (amount < MIN_TOPUP || Number.isNaN(amount)) {
      toast.error(`The minimum top-up is ${formatGhs(MIN_TOPUP)}.`);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/wallet/topup/initialize", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ amount }),
      });
      const data = (await res.json().catch(() => ({}))) as { authorizationUrl?: string; error?: string };
      if (!res.ok || !data.authorizationUrl) {
        throw new Error(data.error ?? "We could not start the payment session. Please try again.");
      }
      window.location.href = data.authorizationUrl;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Top-up could not be started. Please try again.");
      setLoading(false);
    }
  }

  const isCompact = variant === "compact";
  const isEmbed = variant === "embed";

  const shell = cn(
    "relative overflow-hidden",
    isEmbed
      ? "rounded-xl border border-amber-500/30 bg-gradient-to-br from-amber-500/[0.14] via-card/95 to-card p-4 shadow-inner ring-1 ring-amber-500/20 dark:from-amber-500/[0.08] dark:via-[oklch(0.2_0.02_250)] dark:to-transparent"
      : isCompact
        ? "rounded-xl border border-border bg-gradient-to-b from-card via-card to-muted/25 p-4 shadow-md ring-1 ring-border/50 dark:border-white/10 dark:from-white/[0.07] dark:via-white/[0.03] dark:to-transparent dark:ring-white/[0.06]"
        : "rounded-2xl border border-border bg-card p-5 shadow-xl ring-1 ring-[var(--brand)]/20 sm:p-6 dark:border-white/10 dark:bg-gradient-to-br dark:from-[oklch(0.22_0.03_250)] dark:via-card dark:to-[oklch(0.18_0.02_250)]",
    className,
  );

  return (
    <div className={shell}>
      {!isEmbed ? (
        <>
          <div
            className="pointer-events-none absolute -right-16 -top-20 size-48 rounded-full bg-[var(--brand)]/20 blur-3xl"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -bottom-20 -left-12 size-40 rounded-full bg-emerald-500/15 blur-3xl dark:bg-emerald-400/12"
            aria-hidden
          />
        </>
      ) : null}

      <div className={cn("relative", !isEmbed && "space-y-5", isEmbed && "space-y-3")}>
        {(heading != null || showBalance) && (
          <div
            className={cn(
              "flex flex-col gap-3",
              !isCompact && !isEmbed && "sm:flex-row sm:items-start sm:justify-between sm:gap-6",
            )}
          >
            <div className="min-w-0 flex-1 space-y-1">
              {heading ? (
                <h3
                  className={cn(
                    "font-semibold tracking-tight text-foreground",
                    isEmbed ? "text-sm" : isCompact ? "text-base" : "text-lg",
                  )}
                >
                  {heading}
                </h3>
              ) : null}
              {showBalance ? (
                <>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                    Available balance
                  </p>
                  <p
                    className={cn(
                      "font-bold tracking-tight text-[var(--brand)] drop-shadow-[0_0_20px_color-mix(in_srgb,var(--brand)_35%,transparent)]",
                      isCompact ? "text-2xl" : "text-3xl sm:text-4xl",
                    )}
                  >
                    {formatGhs(walletBalance)}
                  </p>
                </>
              ) : null}
              {isEmbed ? (
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Top up by at least{" "}
                  <span className="font-semibold text-foreground">{formatGhs(Math.max(0, gapGhs ?? 0))}</span> to pay from
                  your wallet. When Paystack confirms the payment, return to this screen and complete checkout.
                </p>
              ) : !isCompact ? (
                <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
                  {supportingText ?? DEFAULT_SUPPORTING_CARD}
                </p>
              ) : (
                <p className="max-w-prose text-xs leading-relaxed text-muted-foreground">
                  {supportingText ?? DEFAULT_SUPPORTING_COMPACT}
                </p>
              )}
            </div>
            {!isCompact && !isEmbed ? (
              <div className="flex shrink-0 items-center justify-center rounded-2xl border border-border/80 bg-muted/50 p-4 dark:border-white/10 dark:bg-white/[0.05]">
                <Wallet className="size-10 text-[var(--brand)]" aria-hidden />
              </div>
            ) : null}
          </div>
        )}

        <div className={cn("space-y-3", isEmbed && "pt-1")}>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Amount</span>
            <span className="h-px flex-1 bg-border dark:bg-white/10" aria-hidden />
          </div>
          <div className="flex flex-wrap gap-2">
            {chipValues.map((v) => {
              const isCoverChip = coverAmount === v;
              const selected = amount === v;
              return (
                <button
                  key={v}
                  type="button"
                  onClick={() => setAmount(v)}
                  className={cn(
                    "rounded-xl border px-3 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]/50",
                    selected
                      ? "border-[var(--brand)]/70 bg-[var(--brand)]/18 text-foreground shadow-[0_0_22px_-10px_color-mix(in_srgb,var(--brand)_50%,transparent)]"
                      : "border-border bg-background/90 text-muted-foreground hover:border-[var(--brand)]/40 hover:text-foreground dark:border-white/10 dark:bg-white/[0.05]",
                  )}
                >
                  {isCoverChip ? <span className="mr-1 text-[10px] font-bold uppercase text-[var(--brand)]">Gap</span> : null}
                  {formatGhs(v, true)}
                </button>
              );
            })}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
            <label className="flex flex-1 cursor-text items-center gap-2 rounded-xl border border-border bg-background/95 px-3 py-2 dark:border-white/10 dark:bg-black/25">
              <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">Custom</span>
              <Input
                type="number"
                min={MIN_TOPUP}
                step={1}
                value={Number.isNaN(amount) ? "" : amount}
                onChange={(e) => setAmount(Number(e.target.value) || 0)}
                className="h-9 min-w-0 flex-1 border-0 bg-transparent p-0 text-right text-base font-semibold text-foreground shadow-none focus-visible:ring-0"
                aria-label="Custom top-up amount in GHS"
              />
            </label>
          </div>
        </div>

        <div className={cn("flex flex-col gap-2", isCompact || isEmbed ? "sm:flex-row" : "")}>
          {!isSignedIn ? (
            <Link
              href={signInHref}
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "h-11 min-h-11 w-full justify-center sm:w-auto",
              )}
            >
              Sign in to add funds
            </Link>
          ) : (
            <Button
              type="button"
              size="lg"
              className={cn(
                "h-11 min-h-11 gap-2 bg-[var(--brand)] font-semibold text-[#041014] shadow-[0_0_32px_-8px_rgba(20,216,230,0.55)] hover:bg-[var(--brand-deep)] hover:text-white dark:hover:text-white",
                (isCompact || isEmbed) && "w-full sm:flex-1",
                !isCompact && !isEmbed && "w-full sm:w-auto sm:min-w-[220px]",
              )}
              disabled={loading}
              onClick={() => void submit()}
            >
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Redirecting to secure checkout…
                </>
              ) : (
                <>
                  Continue to secure checkout
                  <ArrowRight className="size-4" aria-hidden />
                </>
              )}
            </Button>
          )}
        </div>

        {!isEmbed ? (
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border/70 pt-4 text-[11px] text-muted-foreground dark:border-white/10">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
              Paystack-secured payment
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Sparkles className="size-3.5 shrink-0 text-[var(--brand)]" aria-hidden />
              Minimum top-up {formatGhs(MIN_TOPUP)}
            </span>
          </div>
        ) : (
          <p className="text-[10px] leading-snug text-muted-foreground">
            Minimum {formatGhs(MIN_TOPUP)} · Paystack (mobile money, bank, or card)
          </p>
        )}
      </div>
    </div>
  );
}
