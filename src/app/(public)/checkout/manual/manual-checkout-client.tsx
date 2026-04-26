"use client";

import type { PaymentType } from "@prisma/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { PageHeading } from "@/components/typography/page-headings";
import { Button, buttonVariants } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getSettlementInstructions, settlementMethodLabel } from "@/lib/payment-settlement";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Offline vehicle checkout: bank, Alipay, or office cash only (no mobile-money receipt path). */
const MANUAL_OPTIONS = ["BANK_GHS_COMPANY", "ALIPAY_RMB", "CASH_OFFICE_GHS", "CASH_OFFICE_USD"] as const;

type ManualMethod = (typeof MANUAL_OPTIONS)[number];

type Props = {
  carId: string;
  paymentType: PaymentType;
  vehicleTitle: string;
  amountGhs: number;
  currency: string;
};

export function ManualCheckoutClient({ carId, paymentType, vehicleTitle, amountGhs, currency }: Props) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [method, setMethod] = useState<ManualMethod>("BANK_GHS_COMPANY");
  const [loading, setLoading] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);

  const returnUrl = useMemo(() => {
    const q = new URLSearchParams({ carId, type: paymentType });
    return `/checkout/manual?${q.toString()}`;
  }, [carId, paymentType]);

  const loginHref = `/login?callbackUrl=${encodeURIComponent(returnUrl)}`;
  const registerHref = `/register?callbackUrl=${encodeURIComponent(returnUrl)}`;

  const instructions = getSettlementInstructions(method);

  async function submit() {
    if (status !== "authenticated" || !session?.user) {
      setAuthOpen(true);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/payments/create-manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ carId, paymentType, settlementMethod: method }),
      });
      const data = (await res.json()) as { error?: string; redirectTo?: string };
      if (res.status === 401) {
        setAuthOpen(true);
        return;
      }
      if (!res.ok) throw new Error(data.error ?? "Could not create payment");
      toast.success("Payment record created", {
        description:
          "Pay using your chosen method, then open your payment page and upload a screenshot or receipt so we can verify and secure your vehicle.",
        duration: 8000,
      });
      router.push(data.redirectTo ?? "/dashboard/payments");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6 sm:py-16">
      <Link
        href={`/checkout?carId=${encodeURIComponent(carId)}&type=${encodeURIComponent(paymentType)}`}
        className="text-sm font-medium text-[var(--brand)] hover:underline"
      >
        ← Secured online payment
      </Link>
      <PageHeading variant="dashboard" className="mt-4 text-2xl sm:text-3xl">
        Arrange offline payment
      </PageHeading>
      <p className="mt-4 max-w-prose text-base leading-relaxed text-zinc-400 sm:text-lg">
        Choose how you will pay (bank transfer, Alipay transfer, or cash). We create a payment record and you upload proof
        of payment from your dashboard. Secured online payment channels remain available from the previous step.
      </p>

      <div className="mt-8 space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-sm">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Vehicle</p>
        <p className="font-medium text-white">{vehicleTitle}</p>
        <p className="text-lg font-semibold text-[var(--brand)]">{formatMoney(amountGhs, currency)}</p>
        <p className="text-xs text-zinc-500">Type: {paymentType.replaceAll("_", " ")}</p>
      </div>

      <div className="mt-8 space-y-2">
        <Label htmlFor="method">Settlement method</Label>
        <select
          id="method"
          value={method}
          onChange={(e) => setMethod(e.target.value as ManualMethod)}
          className="mt-1 h-11 w-full rounded-lg border border-white/10 bg-black/40 px-3 text-sm text-white outline-none ring-[var(--brand)]/30 focus:ring-2"
        >
          {MANUAL_OPTIONS.map((m) => (
            <option key={m} value={m}>
              {settlementMethodLabel(m)}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-6 rounded-2xl border border-[var(--brand)]/20 bg-[var(--brand)]/[0.06] p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--brand)]">{instructions.title}</p>
        <ul className="mt-3 list-inside list-disc space-y-2 text-sm text-zinc-300">
          {instructions.lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </div>

      <Button className="mt-8 min-h-11 w-full sm:w-auto" type="button" disabled={loading || status === "loading"} onClick={() => void submit()}>
        {loading ? "Creating…" : "Create payment & go to dashboard"}
      </Button>

      <Dialog open={authOpen} onOpenChange={setAuthOpen}>
        <DialogContent className="border border-white/10 bg-[#0a0e14] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">Sign in required</DialogTitle>
            <DialogDescription className="text-zinc-400">
              We need your account to attach this payment to your order history.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <Link href={loginHref} className={cn(buttonVariants({ className: "w-full justify-center" }))}>
              Sign in
            </Link>
            <Link
              href={registerHref}
              className={cn(
                buttonVariants({
                  variant: "outline",
                  className: "w-full justify-center border-white/15",
                }),
              )}
            >
              Create Account
            </Link>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
