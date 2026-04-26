"use client";

import { Lock } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { CheckoutBlockedDialog } from "@/components/checkout/checkout-blocked-dialog";
import { PaymentReviewNotice } from "@/components/legal/payment-review-notice";
import { PageHeading } from "@/components/typography/page-headings";
import { BrowseCarsCtaLink } from "@/components/storefront/storefront-cta-links";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  clearCheckoutIntent,
  persistCheckoutIntent,
  readCheckoutIntent,
  type CheckoutIntent,
} from "@/lib/checkout-intent";
import { formatConverted, type VehiclePricePreview } from "@/lib/currency";
import { cn } from "@/lib/utils";

type PaystackInitResponse = {
  error?: string;
  code?: string;
  authorizationUrl?: string;
  /** Same value stored on the payment and sent to Paystack (e.g. SDA-XXXXXXXXXXXX). */
  reference?: string;
  message?: string;
};

/** Safe parse — API must always return JSON, but empty/HTML bodies avoid `Unexpected end of JSON input`. */
async function readPaymentInitJson(res: Response): Promise<PaystackInitResponse | null> {
  const text = await res.text();
  if (!text.trim()) return null;
  try {
    return JSON.parse(text) as PaystackInitResponse;
  } catch {
    return null;
  }
}

function titleForCheckoutConflict(code: string | undefined, vehicleTitle: string | undefined): string {
  switch (code) {
    case "VEHICLE_SOLD":
    case "ALREADY_PURCHASED":
      return "This vehicle is already sold";
    case "VEHICLE_RESERVED":
      return "This vehicle is reserved";
    case "IN_TRANSIT_NOT_FOR_CHECKOUT":
      return "Not available for online payment yet";
    case "NOT_PUBLISHED":
      return "Listing is not available";
    case "SERIALIZATION_RETRY":
      return "Please try again in a moment";
    default:
      return vehicleTitle ? `Payment cannot continue: ${vehicleTitle}` : "Payment cannot continue";
  }
}

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
  const [apiConflict, setApiConflict] = useState<{
    title: string;
    message: string;
  } | null>(null);
  /** Shown after init succeeds; user must see payment reference before redirect to Paystack. */
  const [paystackHandoff, setPaystackHandoff] = useState<{ authorizationUrl: string; reference: string } | null>(null);

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

  const allAgreementsAccepted =
    agreementAccepted &&
    (!legalRequirements.requiresContract || contractAccepted) &&
    (!legalRequirements.requiresRisk || riskAccepted);

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
      const data = await readPaymentInitJson(res);
      if (data == null) {
        toast.error("No response from the payment service. Check your connection and try again.");
        return;
      }
      if (res.status === 401 && data.code === "AUTH_REQUIRED") {
        setAuthGateOpen(true);
        toast.message("Sign in to continue", { description: "Please sign in to complete your secure payment." });
        return;
      }
      if (res.status === 409) {
        setApiConflict({
          title: titleForCheckoutConflict(data.code, checkoutSummary?.title),
          message: data.error ?? "This vehicle is no longer available for this checkout. Please choose another or contact us.",
        });
        return;
      }
      if (!res.ok) {
        toast.error(data.error ?? data.message ?? "Unable to start payment");
        return;
      }
      const payUrl = data.authorizationUrl;
      if (!payUrl || typeof payUrl !== "string") {
        toast.error("Payment link was not returned. Please try again or contact support.");
        return;
      }
      const reference = data.reference?.trim();
      if (reference) {
        setPaystackHandoff({ authorizationUrl: payUrl, reference });
      } else {
        clearCheckoutIntent();
        window.location.href = payUrl;
      }
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
    checkoutSummary?.title,
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
      toast.error("You must accept the sourcing contract to proceed.");
      return;
    }
    if (legalRequirements.requiresRisk && !riskAccepted) {
      toast.error("You must accept the risk acknowledgement to proceed.");
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
    toast.success("Welcome back", { description: "Continuing to secure checkout…" });
    if (
      !agreementAccepted ||
      (legalRequirements.requiresContract && !contractAccepted) ||
      (legalRequirements.requiresRisk && !riskAccepted)
    ) {
      toast.message("Complete agreements", {
        description: "Select every required checkbox, then tap Proceed to Payment.",
      });
      return;
    }
    void initiatePayment();
  }, [
    checkoutBlock,
    status,
    session,
    carId,
    type,
    sp,
    router,
    initiatePayment,
    agreementAccepted,
    contractAccepted,
    riskAccepted,
    legalRequirements.requiresContract,
    legalRequirements.requiresRisk,
  ]);

  if (!carId) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
        <p className="text-base leading-relaxed text-zinc-400">
          Start checkout from a vehicle listing, or we&apos;ll restore your last selection when possible.
        </p>
        <BrowseCarsCtaLink className="mt-6" href="/inventory" size="default" />
      </div>
    );
  }

  const cnyToGhsRate =
    checkoutSummary && Number.isFinite(checkoutSummary.rmbToGhsDivisor) && checkoutSummary.rmbToGhsDivisor > 0
      ? 1 / checkoutSummary.rmbToGhsDivisor
      : null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6 sm:py-16">
      <PageHeading variant="dashboard" className="text-3xl font-semibold tracking-tight sm:text-4xl">
        Complete your purchase
      </PageHeading>
      <p className="mt-4 max-w-prose text-base leading-relaxed text-zinc-400 sm:text-lg">
        Review your order summary below. Payment is processed securely in{" "}
        <span className="font-medium text-zinc-200">Ghana cedis (GHS)</span> using the current forex exchange rates
        maintained by Spark and Drive Autos.
      </p>
      <div className="mt-4">
        <PaymentReviewNotice />
      </div>

      {status === "unauthenticated" && (
        <p className="mt-8 rounded-2xl border border-white/[0.1] bg-gradient-to-br from-white/[0.07] to-transparent px-6 py-5 text-base leading-relaxed text-zinc-200">
          You can explore the site freely. To complete payment, sign in or Create Account so we can issue your receipt
          and keep your order details in one place.
        </p>
      )}

      {status === "authenticated" && (
        <div className="mt-10 space-y-1">
          <p className="text-sm font-medium text-zinc-500">Signed in as</p>
          <p className="text-base text-zinc-100">{session?.user?.email}</p>
        </div>
      )}

      {!checkoutBlock ? (
        <>
          <div className="mt-10 space-y-6 rounded-3xl border border-white/10 bg-white/[0.04] p-6 text-zinc-200 shadow-[0_0_0_1px_rgba(255,255,255,0.04)_inset] sm:p-8">
            {checkoutSummary ? (
              <div className="space-y-6">
                <div>
                  <p className="text-sm font-medium text-zinc-500">Vehicle</p>
                  <p className="mt-2 text-xl font-semibold leading-snug text-white sm:text-2xl">{checkoutSummary.title}</p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/25 p-5 sm:p-6">
                  <p className="text-sm font-medium text-zinc-400">Amount due (Ghana cedis)</p>
                  <p className="mt-3 text-3xl font-bold tracking-tight text-[var(--brand)] sm:text-4xl">
                    {formatConverted(checkoutSummary.settlementGhs, "GHS")}
                  </p>
                  {checkoutSummary.paymentType === "RESERVATION_DEPOSIT" ? (
                    <p className="mt-4 text-base leading-relaxed text-zinc-400">
                      Reservation deposit toward this vehicle. Estimated full total in Ghana cedis:{" "}
                      <span className="font-semibold text-zinc-200">
                        {formatConverted(checkoutSummary.fullGhs, "GHS")}
                      </span>
                      . Balance and timing follow your order documentation.
                    </p>
                  ) : null}

                  {checkoutSummary.displayCurrency !== "GHS" ? (
                    <p className="mt-4 text-base text-zinc-400">
                      Reference in your preferred view:{" "}
                      <span className="font-semibold text-zinc-200">
                        {formatConverted(checkoutSummary.displayAmount, checkoutSummary.displayCurrency)}
                      </span>
                      . Checkout is settled in GHS as shown above.
                    </p>
                  ) : null}

                  <div className="mt-6 space-y-2 border-t border-white/10 pt-6 text-base leading-relaxed text-zinc-400">
                    <p>
                      <span className="text-zinc-500">List price reference (China): </span>
                      <span className="font-semibold text-zinc-200">
                        {formatConverted(checkoutSummary.basePriceRmb, "CNY")}
                      </span>
                    </p>
                    {cnyToGhsRate != null ? (
                      <p className="text-base text-zinc-400">
                        Applied conversion (current live rate):{" "}
                        <span className="font-semibold text-zinc-200">
                          1 CNY ≈ GHS{" "}
                          {cnyToGhsRate.toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                        </span>
                        . Vehicle subtotal in cedis is derived from today&apos;s current forex exchange rates.
                      </p>
                    ) : null}
                  </div>
                </div>

                {checkoutSummary.seaShippingFeeGhs != null && checkoutSummary.seaShippingFeeGhs > 0 ? (
                  <div className="rounded-2xl border border-cyan-500/30 bg-cyan-500/[0.08] px-5 py-4 text-base leading-relaxed text-cyan-50/95">
                    <p className="text-sm font-semibold text-cyan-100">Sea freight (estimate)</p>
                    <p className="mt-2 text-cyan-50/90">
                      Indicative sea shipping for this listing:{" "}
                      <span className="font-semibold text-white">
                        {formatConverted(checkoutSummary.seaShippingFeeGhs, "GHS")}
                      </span>
                      . The amount due above remains the unit cost of the vehicle only; freight is confirmed separately with
                      operations and invoiced according to your agreement.
                    </p>
                  </div>
                ) : (
                  <p className="text-base leading-relaxed text-zinc-500">
                    No sea-freight estimate is shown for this listing. The amount due above is the unit cost of the vehicle
                    only—it does not include shipment fees. If ocean delivery applies, your coordinator will confirm
                    freight costs with you directly.
                  </p>
                )}

                <p className="text-base text-zinc-400">
                  Payment option:{" "}
                  <span className="font-semibold text-zinc-100">
                    {type === "RESERVATION_DEPOSIT" ? "Reservation deposit" : "Full payment"}
                  </span>
                </p>
              </div>
            ) : null}
            <div className="space-y-4">
              <p className="text-sm font-medium text-zinc-400">Required agreements</p>
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-sm leading-relaxed text-zinc-300 sm:p-5">
                <p className="font-medium text-zinc-200">Before payment, by proceeding you confirm that:</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-zinc-300">
                  <li>Payment is subject to verification.</li>
                  <li>Orders are not confirmed until verified.</li>
                  <li>Certain transactions may be non-refundable.</li>
                </ul>
              </div>
              <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border/70 bg-background/80 p-4 sm:p-5 dark:border-white/15 dark:bg-white/[0.05]">
                <input
                  id="checkout-agreement"
                  type="checkbox"
                  checked={agreementAccepted}
                  onChange={(e) => setAgreementAccepted(e.target.checked)}
                  className="mt-1 size-4 shrink-0 rounded border-white/20 accent-[var(--brand)]"
                />
                <span className="text-sm leading-relaxed text-foreground dark:text-zinc-100 sm:text-base">
                  I agree to the{" "}
                  <span className="rounded-md bg-[var(--brand)]/12 px-1.5 py-0.5 font-semibold text-[var(--brand)] dark:bg-[var(--brand)]/20">
                    Checkout Agreement
                  </span>
                  . Version {legalRequirements.agreementVersion}.
                </span>
              </label>
              {legalRequirements.requiresContract ? (
                <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border/70 bg-background/80 p-4 sm:p-5 dark:border-white/15 dark:bg-white/[0.05]">
                  <input
                    id="checkout-contract"
                    type="checkbox"
                    checked={contractAccepted}
                    onChange={(e) => setContractAccepted(e.target.checked)}
                    className="mt-1 size-4 shrink-0 rounded border-white/20 accent-[var(--brand)]"
                  />
                  <span className="text-sm leading-relaxed text-foreground dark:text-zinc-100 sm:text-base">
                    I have read and accept the{" "}
                    <span className="rounded-md bg-[var(--brand)]/12 px-1.5 py-0.5 font-semibold text-[var(--brand)] dark:bg-[var(--brand)]/20">
                      sourcing contract
                    </span>{" "}
                    for this order. Version{" "}
                    {legalRequirements.contractVersion}.{" "}
                    <button
                      type="button"
                      className="font-semibold text-[var(--brand)] underline-offset-2 hover:underline"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setContractOpen(true);
                      }}
                    >
                      View contract
                    </button>
                  </span>
                </label>
              ) : null}
              {legalRequirements.requiresRisk ? (
                <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border/70 bg-background/80 p-4 sm:p-5 dark:border-white/15 dark:bg-white/[0.05]">
                  <input
                    id="checkout-risk"
                    type="checkbox"
                    checked={riskAccepted}
                    onChange={(e) => setRiskAccepted(e.target.checked)}
                    className="mt-1 size-4 shrink-0 rounded border-white/20 accent-[var(--brand)]"
                  />
                  <span className="text-sm leading-relaxed text-foreground dark:text-zinc-100 sm:text-base">
                    I have read and accept the{" "}
                    <span className="rounded-md bg-[var(--brand)]/12 px-1.5 py-0.5 font-semibold text-[var(--brand)] dark:bg-[var(--brand)]/20">
                      risk acknowledgement
                    </span>{" "}
                    for this order. Version {legalRequirements.riskVersion}.{" "}
                    <button
                      type="button"
                      className="font-semibold text-[var(--brand)] underline-offset-2 hover:underline"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setRiskOpen(true);
                      }}
                    >
                      View risk acknowledgement
                    </button>
                  </span>
                </label>
              ) : null}
            </div>
          </div>

          <div className="mt-8">
            <Button
              className="min-h-12 w-full px-8 text-base font-semibold sm:w-auto sm:min-w-[240px]"
              type="button"
              disabled={loading || status === "loading" || !allAgreementsAccepted}
              title={
                !allAgreementsAccepted
                  ? "Select all required agreements above before proceeding to payment."
                  : undefined
              }
              onClick={() => void pay()}
            >
              {loading ? "Redirecting…" : "Proceed to Payment"}
            </Button>
            {!allAgreementsAccepted ? (
              <p className="mt-2 text-sm text-amber-200/90 sm:text-base">
                Select every required checkbox above to unlock payment.
              </p>
            ) : null}
            <p className="mt-3 text-sm text-zinc-500 sm:text-base">
              Bank transfer or mobile money, subject to availability through our payment partner.
            </p>
          </div>
        </>
      ) : null}

      {carId && !checkoutBlock ? (
        <p className="mt-8 text-base leading-relaxed text-zinc-500">
          Prefer bank transfer, Alipay transfer, mobile money, or cash at our designated office?{" "}
          <Link
            href={`/checkout/manual?carId=${encodeURIComponent(carId)}&type=${encodeURIComponent(type)}`}
            className="font-semibold text-[var(--brand)] hover:underline"
          >
            Arrange an offline payment
          </Link>
          —we&apos;ll track your proof on the same order timeline.
        </p>
      ) : null}

      {checkoutBlock ? (
        <CheckoutBlockedDialog
          open
          onOpenChange={() => {}}
          allowDismiss={false}
          title={checkoutBlock.title}
          message={checkoutBlock.message}
        />
      ) : null}

      {apiConflict != null ? (
        <CheckoutBlockedDialog
          open
          onOpenChange={(o) => {
            if (!o) setApiConflict(null);
          }}
          allowDismiss
          eyebrow="Payment cannot continue"
          title={apiConflict.title}
          message={apiConflict.message}
        />
      ) : null}

      <Dialog
        open={paystackHandoff != null}
        onOpenChange={(o) => {
          if (!o) {
            if (paystackHandoff) {
              toast.message("Payment reference", {
                description: `${paystackHandoff.reference} — finish paying from Dashboard → Payments anytime.`,
                duration: 12_000,
              });
            }
            setPaystackHandoff(null);
          }
        }}
      >
        <DialogContent className="border border-white/10 bg-[#0a0e14] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">Ready for secure payment</DialogTitle>
            <DialogDescription className="text-zinc-400">
              You will be sent to our payment page (Paystack). Save this number — it is your payment reference for this
              order.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-xl border border-[var(--brand)]/30 bg-[var(--brand)]/10 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--brand)]">Payment reference number</p>
              <p className="mt-2 break-all font-mono text-base font-semibold text-white sm:text-lg">{paystackHandoff?.reference}</p>
            </div>
            <p className="text-sm leading-relaxed text-zinc-500">
              It appears on your receipt and helps us match your payment if you contact support.
            </p>
            <Button
              className="h-11 w-full"
              type="button"
              onClick={() => {
                if (!paystackHandoff) return;
                const { authorizationUrl } = paystackHandoff;
                setPaystackHandoff(null);
                clearCheckoutIntent();
                window.location.href = authorizationUrl;
              }}
            >
              Continue to payment page
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={authGateOpen} onOpenChange={setAuthGateOpen}>
        <DialogContent className="overflow-hidden border border-white/10 bg-[#0a0e14] p-0 shadow-2xl sm:max-w-md">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--brand)]/50 to-transparent" />
          <div className="px-6 pb-6 pt-8">
            <div className="mb-5 flex size-12 items-center justify-center rounded-2xl border border-[var(--brand)]/25 bg-[var(--brand)]/10">
              <Lock className="size-6 text-[var(--brand)]" aria-hidden />
            </div>
            <DialogHeader className="space-y-3 text-left">
              <DialogTitle className="text-xl font-semibold tracking-tight text-white sm:text-2xl">
                Sign in to continue
              </DialogTitle>
              <DialogDescription className="text-base leading-relaxed text-zinc-400">
                Your vehicle and payment selection are saved. After you sign in or register, you can proceed to secure
                checkout without starting over.
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
                Create Account
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
            <p className="text-xs text-zinc-500">
              Close this window and tick the sourcing contract checkbox on the checkout form to confirm your agreement.
            </p>
            <Button type="button" className="w-full" variant="secondary" onClick={() => setContractOpen(false)}>
              Close
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
            <p className="text-xs text-zinc-500">
              Close this window and tick the risk acknowledgement checkbox on the checkout form to confirm your agreement.
            </p>
            <Button type="button" className="w-full" variant="secondary" onClick={() => setRiskOpen(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
