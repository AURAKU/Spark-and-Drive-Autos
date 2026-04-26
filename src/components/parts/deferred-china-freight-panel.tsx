"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { WalletTopupFlow } from "@/components/parts/wallet-topup-flow";
import type { ThreeModeChinaShippingQuotes } from "@/lib/shipping/parts-china-fees";

type Props = {
  orderId: string;
  walletBalanceGhs: number;
};

export function DeferredChinaFreightPanel({ orderId, walletBalanceGhs }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [quote, setQuote] = useState<ThreeModeChinaShippingQuotes | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const refetch = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    fetch(`/api/parts/orders/${orderId}/deferred-china/quote`)
      .then(async (res) => {
        if (res.status === 404) {
          setQuote(null);
          return;
        }
        const j = (await res.json().catch(() => ({}))) as
          | ThreeModeChinaShippingQuotes
          | { error?: string };
        if (!res.ok) {
          setLoadError("error" in j && j.error ? String(j.error) : "Could not load options.");
          return;
        }
        setQuote(j as ThreeModeChinaShippingQuotes);
      })
      .catch(() => setLoadError("Network error."))
      .finally(() => setLoading(false));
  }, [orderId]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  useEffect(() => {
    const r = searchParams.get("chinaFreightRef");
    if (typeof window === "undefined" || !r || r.length < 4) return;
    const dedupeKey = `sda_pcf_v_${orderId}_${r}`;
    if (sessionStorage.getItem(dedupeKey)) {
      const url = new URL(window.location.href);
      if (url.searchParams.has("chinaFreightRef")) {
        url.searchParams.delete("chinaFreightRef");
        window.history.replaceState({}, "", url.toString());
      }
      return;
    }
    sessionStorage.setItem(dedupeKey, "1");
    setVerifying(true);
    fetch(`/api/parts/orders/${orderId}/deferred-china/verify`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reference: r }),
    })
      .then(async (res) => {
        const j = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; alreadySettled?: boolean };
        if (!res.ok) throw new Error(j.error ?? "Could not confirm payment.");
        if (j.alreadySettled) {
          toast.success("Payment was already applied.");
        } else {
          toast.success("International shipping selected and paid.");
        }
        const url = new URL(window.location.href);
        url.searchParams.delete("chinaFreightRef");
        window.history.replaceState({}, "", url.toString());
        router.refresh();
        void refetch();
      })
      .catch((e) => {
        sessionStorage.removeItem(dedupeKey);
        toast.error(e instanceof Error ? e.message : "Could not confirm payment.");
      })
      .finally(() => setVerifying(false));
  }, [orderId, router, searchParams, refetch]);

  const payWallet = (mode: ThreeModeChinaShippingQuotes["sea"]["mode"]) => {
    setPaying(true);
    fetch(`/api/parts/orders/${orderId}/deferred-china/wallet`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mode }),
    })
      .then(async (res) => {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) throw new Error(j.error ?? "Payment failed.");
        toast.success("Paid from wallet. International option confirmed.");
        router.refresh();
        void refetch();
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : "Payment failed."))
      .finally(() => setPaying(false));
  };

  const paystack = (mode: ThreeModeChinaShippingQuotes["sea"]["mode"], fee: number) => {
    if (fee <= 0) {
      toast.error("This option has no GHS amount yet. Ask the team to connect delivery rates.");
      return;
    }
    setPaying(true);
    fetch(`/api/parts/orders/${orderId}/deferred-china/paystack`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mode }),
    })
      .then(async (res) => {
        const j = (await res.json().catch(() => ({}))) as
          | { authorizationUrl: string; error?: string }
          | { error: string };
        if (!res.ok) throw new Error("error" in j ? j.error : "Could not start Paystack.");
        if (!("authorizationUrl" in j) || !j.authorizationUrl) throw new Error("No Paystack URL returned.");
        window.location.href = j.authorizationUrl;
      })
      .catch((e) => {
        setPaying(false);
        toast.error(e instanceof Error ? e.message : "Could not start Paystack.");
      });
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-amber-500/25 bg-amber-500/[0.08] p-4 text-sm text-amber-50/95">
        Loading international options…
      </div>
    );
  }
  if (loadError) {
    return (
      <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
        {loadError}
      </div>
    );
  }
  if (!quote) {
    return null;
  }

  const options: Array<{
    key: string;
    label: string;
    fee: number;
    eta: string;
    mode: ThreeModeChinaShippingQuotes["sea"]["mode"];
  }> = [
    { key: "sea", label: "Sea cargo", fee: quote.sea.feeGhs, eta: quote.sea.eta, mode: quote.sea.mode },
    { key: "air", label: "Normal air", fee: quote.normalAir.feeGhs, eta: quote.normalAir.eta, mode: quote.normalAir.mode },
    { key: "x", label: "Express air", fee: quote.express.feeGhs, eta: quote.express.eta, mode: quote.express.mode },
  ];

  if (verifying) {
    return (
      <div className="rounded-2xl border border-[var(--brand)]/30 bg-white/[0.04] p-4 text-sm text-zinc-200">
        Confirming your Paystack payment for international shipping…
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-amber-500/30 bg-amber-500/[0.08] p-4 text-sm text-zinc-200">
      <h3 className="text-base font-semibold text-amber-50">Pre-order (China) — pay international shipping</h3>
      <p className="mt-1 text-xs leading-relaxed text-amber-100/85">
        This was not part of the parts subtotal. Amounts are in GHS using current delivery template rates. Choose a
        method and pay with your wallet (full amount) or Paystack.
      </p>
      <ul className="mt-3 space-y-2">
        {options.map((o) => (
          <li
            key={o.key}
            className="flex flex-col gap-2 rounded-xl border border-white/10 bg-black/25 p-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="font-medium text-white">{o.label}</p>
              <p className="text-xs text-zinc-400">
                {o.fee > 0 ? `GHS ${o.fee.toLocaleString()}` : "GHS 0 (admin must link templates)"} · {o.eta}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={paying || o.fee <= 0}
                onClick={() => {
                  if (o.fee > Number(walletBalanceGhs)) {
                    toast.error("Top up your wallet to pay this amount, or use Paystack.");
                    return;
                  }
                  void payWallet(o.mode);
                }}
                className="border-red-500/30 text-zinc-100"
              >
                Pay from wallet
              </Button>
              <Button
                type="button"
                size="sm"
                className="bg-red-500 hover:bg-red-400"
                disabled={paying}
                onClick={() => void paystack(o.mode, o.fee)}
              >
                Pay with Paystack
              </Button>
            </div>
          </li>
        ))}
      </ul>
      {options.some((o) => o.fee > Number(walletBalanceGhs)) ? (
        <div className="mt-3">
          <WalletTopupFlow
            walletBalance={walletBalanceGhs}
            isSignedIn
            variant="compact"
            showBalance={false}
            heading="Wallet top up"
            supportingText="Add funds in GHS if you prefer to pay the international leg from your wallet."
            signInHref="/login"
            className="[--brand:#ef4444]"
            gapGhs={Math.max(0, Math.max(...options.map((o) => o.fee)) - Number(walletBalanceGhs))}
            defaultAmount={Math.max(50, Math.ceil(Math.max(...options.map((o) => o.fee)) - Number(walletBalanceGhs)))}
          />
        </div>
      ) : null}
    </div>
  );
}
