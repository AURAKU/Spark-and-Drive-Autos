"use client";

import { Lock } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { PageHeading } from "@/components/typography/page-headings";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  clearCheckoutIntent,
  persistCheckoutIntent,
  readCheckoutIntent,
  type CheckoutIntent,
} from "@/lib/checkout-intent";
import { formatConverted, type VehiclePricePreview } from "@/lib/currency";
import { cn } from "@/lib/utils";

/** Survives React Strict Mode remounts so we do not double-hit Paystack initialization. */
let paymentInitializeInFlight = false;
/** Prevents duplicate auto-resume when `resume=1` is in the URL. */
let resumePipelineToken: string | null = null;

export function CheckoutClient({
  checkoutSummary,
  checkoutBlock,
  legalRequirements,
}: {
  checkoutSummary: VehiclePricePreview | null;
  checkoutBlock?: { message: string; title: string } | null;
  legalRequirements: {
    agreementVersion: string;
    contractVersion: string;
    riskVersion: string;
    requiresContract: boolean;
    requiresRisk: boolean;
  };
}) {
  const sp = useSearchParams();
  const router = useRouter();
  const { data: session, status } = useSession();
  const carId = sp.get("carId");
  const type: CheckoutIntent["type"] =
    sp.get("type") === "RESERVATION_DEPOSIT" ? "RESERVATION_DEPOSIT" : "FULL";
  const [loading, setLoading] = useState(false);
  const [authGateOpen, setAuthGateOpen] = useState(false);
  const [agreementAccepted, setAgreementAccepted] = useState(false);
  const [contractAccepted, setContractAccepted] = useState(false);
  const [riskAccepted, setRiskAccepted] = useState(false);
  const [contractOpen, setContractOpen] = useState(false);
  const [riskOpen, setRiskOpen] = useState(false);

  const returnToCheckout = useMemo(() => {
    const q = new URLSearchParams();
    if (carId) q.set("carId", carId);
    q.set("type", type);
    return `/checkout?${q.toString()}`;
  }, [carId, type]);

  /** After sign-in/register, land here with `resume=1` to continue without an extra tap. */
  const returnToCheckoutResume = useMemo(() => `${returnToCheckout}&resume=1`, [returnToCheckout]);

  const loginHref = `/login?callbackUrl=${encodeURIComponent(returnToCheckoutResume)}`;
  const registerHref = `/register?callbackUrl=${encodeURIComponent(returnToCheckoutResume)}`;

  const initiatePayment = useCallback(async () => {
    if (!carId) {
      toast.error("Missing vehicle.");
      return;
    }
    if (paymentInitializeInFlight) return;
    paymentInitializeInFlight = true;
    setLoading(true);
    try {
      const res = await fetch("/api/payments/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          carId,
          paymentType: type,
          agreementAccepted,
          agreementVersion: legalRequirements.agreementVersion,
          contractAccepted,
          contractVersion: legalRequirements.contractVersion,
          riskAccepted,
          riskVersion: legalRequirements.riskVersion,
        }),
      });
      const data = (await res.json()) as { error?: string; code?: string; authorizationUrl?: string; message?: string };
      if (res.status === 401 && data?.code === "AUTH_REQUIRED") {
        setAuthGateOpen(true);
        toast.message("Sign in to pay", { description: "We need your account before Paystack." });
        return;
      }
      if (!res.ok) throw new Error(data.error ?? data.message ?? "Unable to start payment");
      clearCheckoutIntent();
      window.location.href = data.authorizationUrl as string;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Payment failed to start");
    } finally {
      setLoading(false);
      paymentInitializeInFlight = false;
    }
  }, [
    agreementAccepted,
    carId,
    contractAccepted,
    legalRequirements.agreementVersion,
    legalRequirements.contractVersion,
    legalRequirements.riskVersion,
    riskAccepted,
    type,
  ]);

  /** Restore /checkout from sessionStorage when the URL lost query params (refresh edge cases). */
  useEffect(() => {
    if (carId) return;
    const intent = readCheckoutIntent();
    if (!intent) return;
    router.replace(`/checkout?carId=${encodeURIComponent(intent.carId)}&type=${encodeURIComponent(intent.type)}`);
  }, [carId, router]);

  /** Keep sessionStorage aligned with the current URL selection. */
  useEffect(() => {
    if (!carId) return;
    persistCheckoutIntent({ carId, type });
  }, [carId, type]);

  /** Guest: gate with modal. Signed-in: go straight to Paystack. */
  async function pay() {
    if (!carId) {
      toast.error("Missing vehicle.");
      return;
    }
    if (status === "unauthenticated" || !session?.user) {
      persistCheckoutIntent({ carId, type });
      setAuthGateOpen(true);
      return;
    }
    if (!agreementAccepted) {
      toast.error("You must agree to the checkout terms before payment.");
      return;
    }
    if (legalRequirements.requiresContract && !contractAccepted) {
      setContractOpen(true);
      return;
    }
    if (legalRequirements.requiresRisk && !riskAccepted) {
      setRiskOpen(true);
      return;
    }
    await initiatePayment();
  }

  /** After auth, one-shot resume from login/register callback URL (`resume=1`). */
  useEffect(() => {
    if (checkoutBlock) return;
    if (sp.get("resume") !== "1") {
      resumePipelineToken = null;
      return;
    }
    if (status !== "authenticated" || !session?.user?.id || !carId) return;

    const token = `${carId}|${type}|resume`;
    if (resumePipelineToken === token) return;
    resumePipelineToken = token;

    const next = new URLSearchParams(sp.toString());
    next.delete("resume");
    router.replace(`/checkout?${next.toString()}`, { scroll: false });
    toast.success("Welcome back", { description: "Continuing to secure payment…" });
    void initiatePayment();
  }, [checkoutBlock, status, session, carId, type, sp, router, initiatePayment]);

  if (!carId) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16">
        <p className="text-sm text-zinc-400">Open checkout from a vehicle page, or we&apos;ll restore your last selection if available.</p>
        <Button className="mt-4" type="button" onClick={() => router.push("/inventory")}>
          Browse inventory
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-16">
      <PageHeading variant="dashboard">Secure checkout</PageHeading>
      <p className="mt-2 text-sm leading-relaxed text-zinc-400">
        You will be redirected to Paystack to complete payment. Success is confirmed server-side—never on the client alone.
      </p>

      {status === "unauthenticated" && (
        <p className="mt-6 rounded-2xl border border-white/[0.08] bg-gradient-to-br from-white/[0.06] to-transparent px-5 py-4 text-sm leading-relaxed text-zinc-200">
          Browse freely—an account is only required when you continue to payment so we can tie your purchase to a secure
          profile and receipt.
        </p>
      )}

      {status === "authenticated" && (
        <div className="mt-8 space-y-1">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Signed in as</p>
          <p className="text-sm text-zinc-100">{session?.user?.email}</p>
        </div>
      )}

      {checkoutBlock ? (
        <div className="mt-8 rounded-2xl border border-amber-500/35 bg-amber-500/10 px-5 py-4 text-sm leading-relaxed text-amber-50">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-200/90">Checkout unavailable</p>
          <p className="mt-1 font-medium text-white">{checkoutBlock.title}</p>
          <p className="mt-2 text-amber-50/95">{checkoutBlock.message}</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link href="/inventory" className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}>
              Browse inventory
            </Link>
            <Link href="/contact" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
              Contact support
            </Link>
          </div>
        </div>
      ) : null}

      {!checkoutBlock ? (
        <>
          <div className="mt-8 space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-sm text-zinc-300">
            {checkoutSummary ? (
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Vehicle</p>
                <p className="mt-1 text-base font-medium text-white">{checkoutSummary.title}</p>
                <p className="mt-2 text-lg font-semibold text-[var(--brand)]">
                  {formatConverted(checkoutSummary.displayAmount, checkoutSummary.displayCurrency)}
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  Base CNY {checkoutSummary.basePriceRmb.toLocaleString()} · Paystack settles in GHS using the same admin rates
                </p>
                {checkoutSummary.seaShippingFeeGhs != null && checkoutSummary.seaShippingFeeGhs > 0 ? (
                  <div className="mt-4 rounded-xl border border-cyan-500/25 bg-cyan-500/5 px-3 py-2 text-xs text-cyan-100/95">
                    <p className="font-semibold text-cyan-50">Sea shipping to Ghana (estimate)</p>
                    <p className="mt-1 text-cyan-100/80">
                      Operations typically bill sea freight separately from the vehicle subtotal. Listed fee:{" "}
                      <span className="font-mono font-semibold text-white">
                        {formatConverted(checkoutSummary.seaShippingFeeGhs, "GHS")}
                      </span>{" "}
                      — exact charges may be confirmed before vessel booking.
                    </p>
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-zinc-500">
                    Sea shipping fees will appear here when set on the vehicle listing (admin inventory).
                  </p>
                )}
              </div>
            ) : null}
            <p>
              Payment type: <span className="font-medium text-white">{type.replaceAll("_", " ")}</span>
            </p>
            <label className="mt-3 flex items-start gap-2 rounded-xl border border-white/10 bg-white/[0.02] p-3">
              <input
                type="checkbox"
                checked={agreementAccepted}
                onChange={(e) => setAgreementAccepted(e.target.checked)}
                className="mt-0.5"
              />
              <span className="text-xs leading-relaxed text-zinc-300">
                I agree to the checkout terms, payment verification rules, and applicable policies for this order. Version{" "}
                {legalRequirements.agreementVersion}.
              </span>
            </label>
            {legalRequirements.requiresContract ? (
              <button
                type="button"
                onClick={() => setContractOpen(true)}
                className="inline-flex text-xs font-medium text-[var(--brand)] hover:underline"
              >
                Review sourcing contract
              </button>
            ) : null}
            {legalRequirements.requiresRisk ? (
              <button
                type="button"
                onClick={() => setRiskOpen(true)}
                className="inline-flex text-xs font-medium text-[var(--brand)] hover:underline"
              >
                Review risk acknowledgement
              </button>
            ) : null}
          </div>

          <Button
            className="mt-8 min-h-11 px-8"
            type="button"
            disabled={loading || status === "loading"}
            onClick={() => void pay()}
          >
            {loading ? "Redirecting…" : "Continue to Paystack"}
          </Button>
        </>
      ) : null}

      {carId && !checkoutBlock ? (
        <p className="mt-6 text-sm text-zinc-500">
          Prefer bank transfer, Alipay, Mobile Money receipt, or cash at the office?{" "}
          <Link
            href={`/checkout/manual?carId=${encodeURIComponent(carId)}&type=${encodeURIComponent(type)}`}
            className="font-medium text-[var(--brand)] hover:underline"
          >
            Set up offline payment
          </Link>{" "}
          — we&apos;ll track your proof on the same order timeline.
        </p>
      ) : null}

      <Dialog open={authGateOpen} onOpenChange={setAuthGateOpen}>
        <DialogContent className="overflow-hidden border border-white/10 bg-[#0a0e14] p-0 shadow-2xl sm:max-w-md">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--brand)]/50 to-transparent" />
          <div className="px-6 pb-6 pt-8">
            <div className="mb-5 flex size-12 items-center justify-center rounded-2xl border border-[var(--brand)]/25 bg-[var(--brand)]/10">
              <Lock className="size-6 text-[var(--brand)]" aria-hidden />
            </div>
            <DialogHeader className="space-y-3 text-left">
              <DialogTitle className="text-xl font-semibold tracking-tight text-white">
                Sign in to complete payment
              </DialogTitle>
              <DialogDescription className="text-sm leading-relaxed text-zinc-400">
                Your vehicle and payment option stay selected. After you sign in or create an account, we continue
                straight to Paystack—no need to choose again.
              </DialogDescription>
            </DialogHeader>
            <div className="mt-6 flex flex-col gap-3">
              <Link
                href={loginHref}
                className={cn(buttonVariants({ className: "h-11 w-full justify-center text-base font-medium" }))}
              >
                Sign in
              </Link>
              <Link
                href={registerHref}
                className={cn(
                  buttonVariants({
                    variant: "outline",
                    className:
                      "h-11 w-full justify-center border-white/15 bg-white/[0.02] text-base font-medium text-white hover:bg-white/[0.06]",
                  }),
                )}
              >
                Create account
              </Link>
              <button
                type="button"
                className="pt-1 text-center text-xs text-zinc-500 transition-colors hover:text-zinc-300"
                onClick={() => setAuthGateOpen(false)}
              >
                Not now
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={contractOpen} onOpenChange={setContractOpen}>
        <DialogContent className="border border-white/10 bg-[#0a0e14] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white">Sourcing contract</DialogTitle>
            <DialogDescription className="text-zinc-400">
              This order involves sourcing. Terms are best-effort and subject to supplier, shipping, and customs constraints.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm text-zinc-300">
            <p>Version: {legalRequirements.contractVersion}</p>
            <p>
              You confirm that specifications, pricing ranges, and timeline estimates are subject to final supplier and
              logistics confirmation.
            </p>
            <Button
              type="button"
              className="w-full"
              onClick={() => {
                setContractAccepted(true);
                setContractOpen(false);
                toast.success("Contract accepted.");
              }}
            >
              Accept contract and continue
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={riskOpen} onOpenChange={setRiskOpen}>
        <DialogContent className="border border-white/10 bg-[#0a0e14] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white">Risk acknowledgement</DialogTitle>
            <DialogDescription className="text-zinc-400">
              International and sourcing transactions carry external risks beyond direct platform control.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm text-zinc-300">
            <p>Version: {legalRequirements.riskVersion}</p>
            <ul className="list-disc space-y-1 pl-5 text-zinc-300">
              <li>Supplier stock and pricing can change before final confirmation.</li>
              <li>Shipping and customs timelines can be delayed by third-party processes.</li>
              <li>Exchange-rate movement may affect final settlement costs.</li>
            </ul>
            <Button
              type="button"
              className="w-full"
              onClick={() => {
                setRiskAccepted(true);
                setRiskOpen(false);
                toast.success("Risk acknowledgement recorded.");
              }}
            >
              I understand and accept
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
