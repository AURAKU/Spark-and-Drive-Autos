import Link from "next/link";

import { PageHeading } from "@/components/typography/page-headings";

import { transitionPaymentStatus } from "@/lib/payment-lifecycle";
import { getPaystackSecrets } from "@/lib/payment-provider-registry";
import { paystackVerify } from "@/lib/paystack";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ reference?: string }> };

export default async function CheckoutReturnPage(props: Props) {
  const sp = await props.searchParams;
  const reference = sp.reference;
  if (!reference) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-sm text-zinc-400">
        Missing transaction reference.{" "}
        <Link className="text-[var(--brand)]" href="/dashboard/payments">
          View payments
        </Link>
      </div>
    );
  }

  let verified = false;
  try {
    const { secretKey } = await getPaystackSecrets();
    const data = await paystackVerify(reference, secretKey || undefined);
    verified = data.status === "success";
    if (verified) {
      const payment = await prisma.payment.findFirst({ where: { providerReference: reference } });
      if (payment && payment.status !== "SUCCESS") {
        await transitionPaymentStatus(payment.id, {
          toStatus: "SUCCESS",
          source: "CHECKOUT_RETURN",
          note: "Verified via Paystack verify API on checkout return",
          receiptData: { reference, verified: true },
        });
      }
    }
  } catch {
    verified = false;
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-16">
      <PageHeading variant="dashboard">{verified ? "Payment verified" : "Verification pending"}</PageHeading>
      <p className="mt-3 text-sm text-zinc-400">
        Reference <span className="font-mono text-zinc-200">{reference}</span>.{" "}
        {verified
          ? "Your payment was verified server-side."
          : "If funds were deducted, webhook confirmation may still be processing."}
      </p>
      <div className="mt-8 flex gap-3">
        <Link className="rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-medium text-black" href="/dashboard/orders">
          View orders
        </Link>
        <Link className="rounded-lg border border-white/15 px-4 py-2 text-sm text-white" href="/dashboard/payments">
          Payment history
        </Link>
      </div>
    </div>
  );
}
