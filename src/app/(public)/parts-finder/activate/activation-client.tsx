"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

type AccessState =
  | "UPSELL_ONLY"
  | "UNAUTHENTICATED"
  | "INACTIVE"
  | "PENDING_PAYMENT"
  | "PENDING_APPROVAL"
  | "ACTIVE"
  | "EXPIRED"
  | "SUSPENDED";

const paystackBtn =
  "inline-flex min-h-11 items-center justify-center rounded-xl border-2 border-orange-400/80 bg-gradient-to-r from-orange-500 to-orange-600 px-5 py-2.5 text-sm font-bold text-white shadow-[0_8px_28px_-6px_rgba(234,88,12,0.55)] transition hover:from-orange-600 hover:to-orange-700 hover:shadow-[0_10px_32px_-6px_rgba(234,88,12,0.6)] disabled:opacity-60 dark:border-orange-400/60";

const walletBtn =
  "inline-flex min-h-11 items-center justify-center rounded-xl border-2 border-cyan-500/70 bg-gradient-to-r from-cyan-600/90 to-teal-600/90 px-5 py-2.5 text-sm font-bold text-white shadow-[0_8px_28px_-6px_rgba(6,182,212,0.45)] transition hover:from-cyan-500 hover:to-teal-500 disabled:opacity-50 dark:from-cyan-600 dark:to-teal-700";

export function PartsFinderActivationClient(props: {
  accessState: AccessState;
  currency: string;
  activationPriceMinor: number;
  renewalPriceMinor: number;
  /** Actual amount for this user (first activation vs renewal), must match server quote. */
  chargePriceMinor: number;
  chargeKind: "activation" | "renewal";
  walletBalanceGhs: number;
  platformTermsVersion: string;
  partsFinderDisclaimerVersion: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<null | "paystack" | "wallet">(null);
  const [message, setMessage] = useState<string | null>(null);
  const [verifyingReturn, setVerifyingReturn] = useState(false);
  const [acceptPlatform, setAcceptPlatform] = useState(false);
  const [acceptDisclaimer, setAcceptDisclaimer] = useState(false);

  const activationPrice = props.activationPriceMinor / 100;
  const renewalPrice = props.renewalPriceMinor / 100;
  const chargePrice = props.chargePriceMinor / 100;
  const chargeStr = chargePrice.toFixed(2);
  const canPayFromWallet =
    props.walletBalanceGhs + 1e-9 >= chargePrice &&
    props.accessState !== "PENDING_PAYMENT" &&
    props.accessState !== "SUSPENDED" &&
    props.accessState !== "ACTIVE";

  const legalReady = acceptPlatform && acceptDisclaimer;
  const payDisabled =
    busy !== null ||
    props.accessState === "PENDING_PAYMENT" ||
    props.accessState === "SUSPENDED" ||
    props.accessState === "ACTIVE" ||
    !legalReady;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const reference = params.get("reference");
    if (!reference) return;
    let cancelled = false;
    async function verifyReturn() {
      setVerifyingReturn(true);
      try {
        const res = await fetch("/api/parts-finder/verify-payment", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ providerReference: reference }),
        });
        const data = (await res.json().catch(() => ({}))) as { ok?: boolean; membershipState?: string; error?: string };
        if (!res.ok || !data.ok) {
          if (!cancelled) setMessage(data.error ?? "Could not verify payment return yet. Please refresh shortly.");
          return;
        }
        if (data.membershipState === "ACTIVE") {
          router.push("/parts-finder/search");
          router.refresh();
          return;
        }
        if (!cancelled) {
          setMessage("Payment is still pending confirmation. Refresh in a moment.");
        }
      } finally {
        if (!cancelled) setVerifyingReturn(false);
      }
    }
    void verifyReturn();
    return () => {
      cancelled = true;
    };
  }, [router]);

  function activatePayload() {
    return {
      platformTermsAccepted: true as const,
      partsFinderDisclaimerAccepted: true as const,
      platformTermsVersion: props.platformTermsVersion,
      partsFinderDisclaimerVersion: props.partsFinderDisclaimerVersion,
    };
  }

  async function startPaystack() {
    setBusy("paystack");
    setMessage(null);
    try {
      const res = await fetch("/api/parts-finder/activate", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(activatePayload()),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; authorizationUrl?: string };
      if (!res.ok || !data.authorizationUrl) {
        setMessage(data.error ?? "Could not start secure payment. Try again or pay from wallet.");
        return;
      }
      window.location.href = data.authorizationUrl;
    } finally {
      setBusy(null);
    }
  }

  async function startWallet() {
    setBusy("wallet");
    setMessage(null);
    try {
      const res = await fetch("/api/parts-finder/activate/wallet", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(activatePayload()),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; redirectTo?: string };
      if (!res.ok || !data.ok) {
        setMessage(data.error ?? "Could not pay from wallet.");
        return;
      }
      router.push(data.redirectTo ?? "/parts-finder/search");
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  if (props.accessState === "ACTIVE") {
    return (
      <div
        className={cn(
          "mt-6 rounded-2xl border-2 border-cyan-500/30 bg-gradient-to-br from-cyan-500/10 via-card to-orange-500/5 p-5 text-center shadow-sm dark:border-cyan-500/20",
        )}
      >
        <p className="text-base font-semibold text-foreground">Your membership is already active.</p>
        <p className="mt-2 text-sm text-muted-foreground">Use Find Parts to run advanced search.</p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "mt-6 space-y-4 rounded-2xl border-2 border-cyan-500/25 bg-gradient-to-br from-cyan-500/8 via-card to-orange-500/10 p-5 shadow-sm dark:from-cyan-500/12 dark:via-zinc-950/80 dark:to-orange-500/15 sm:p-6",
      )}
    >
      <p className="text-sm text-muted-foreground sm:text-base">
        List prices — Activation:{" "}
        <span className="font-bold text-foreground">{formatMoney(activationPrice, props.currency)}</span>
        <span className="text-muted-foreground"> · Renewal: </span>
        <span className="font-semibold text-foreground">{formatMoney(renewalPrice, props.currency)}</span>
      </p>
      <p className="text-sm font-medium text-foreground">
        Your charge now ({props.chargeKind === "renewal" ? "renewal" : "activation"}):{" "}
        <span className="font-bold text-orange-600 dark:text-orange-400">{formatMoney(chargePrice, props.currency)}</span>
      </p>
      <p className="text-xs text-cyan-800/90 dark:text-cyan-200/80">
        Wallet balance: <span className="font-mono font-semibold text-foreground">{formatMoney(props.walletBalanceGhs, props.currency)}</span>{" "}
        | <span className="text-foreground/90">Pay &amp; Activate</span> uses secured Payment channel (Mobile Money).{" "}
        <span className="text-foreground/90">Pay from Wallet</span> deducts {formatMoney(chargePrice, props.currency)} when
        balance covers it.
      </p>
      <div className="rounded-xl border border-border/80 bg-muted/30 p-4 text-xs leading-relaxed text-muted-foreground">
        <p className="text-sm font-semibold text-foreground">Legal acknowledgement</p>
        <p className="mt-1 text-[11px]">
          Operational consent only not legal advice. You must accept the active platform terms and Parts Finder disclaimer
          before payment.
        </p>
        <label className="mt-3 flex cursor-pointer gap-2 rounded-lg border border-border/70 bg-background/70 px-3 py-2 text-foreground dark:border-white/15 dark:bg-white/[0.05] dark:text-zinc-100">
          <input
            type="checkbox"
            checked={acceptPlatform}
            onChange={(e) => setAcceptPlatform(e.target.checked)}
            className="mt-0.5 accent-[var(--brand)]"
          />
          <span className="font-medium">
            I accept the <span className="font-semibold text-foreground dark:text-white">active platform terms &amp; privacy notice</span> (v{" "}
            <span className="font-mono text-foreground">{props.platformTermsVersion}</span>).
          </span>
        </label>
        <label className="mt-2 flex cursor-pointer gap-2 rounded-lg border border-border/70 bg-background/70 px-3 py-2 text-foreground dark:border-white/15 dark:bg-white/[0.05] dark:text-zinc-100">
          <input
            type="checkbox"
            checked={acceptDisclaimer}
            onChange={(e) => setAcceptDisclaimer(e.target.checked)}
            className="mt-0.5 accent-[var(--brand)]"
          />
          <span className="font-medium">
            I accept the <span className="font-semibold text-foreground dark:text-white">Parts Finder disclaimer</span> (v{" "}
            <span className="font-mono text-foreground">{props.partsFinderDisclaimerVersion}</span>).
          </span>
        </label>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <button
          type="button"
          onClick={startPaystack}
          disabled={payDisabled}
          className={cn(paystackBtn, "sm:min-w-[12rem]")}
        >
          {busy === "paystack" ? "Opening payment…" : "Pay & Activate"}
        </button>
        <button
          type="button"
          onClick={startWallet}
          disabled={payDisabled || !canPayFromWallet}
          className={cn(walletBtn, "sm:min-w-[12rem]")}
          title={
            !canPayFromWallet && props.walletBalanceGhs < chargePrice
              ? `Need at least ${chargeStr} ${props.currency} in wallet (or use Pay & Activate).`
              : undefined
          }
        >
          {busy === "wallet" ? "Paying from wallet…" : "Pay from Wallet"}
        </button>
      </div>
      {!canPayFromWallet && props.walletBalanceGhs < chargePrice && props.accessState !== "PENDING_PAYMENT" ? (
        <p className="text-xs text-amber-800 dark:text-amber-200/90">
          Add funds to your account wallet in parts checkout to use Pay from Wallet, or use Pay &amp; Activate (card / Mobile
          Money).
        </p>
      ) : null}
      {message ? <p className="text-sm text-destructive">{message}</p> : null}
      {verifyingReturn ? <p className="text-xs text-muted-foreground">Verifying payment return…</p> : null}
    </div>
  );
}
