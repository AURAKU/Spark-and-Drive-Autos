import Link from "next/link";

import { PageHeading } from "@/components/typography/page-headings";
import { BrowseCarsCtaLink } from "@/components/storefront/storefront-cta-links";
import { notFound } from "next/navigation";

import { ManualCheckoutClient } from "./manual-checkout-client";
import { getVehicleCheckoutAmountGhs } from "@/lib/checkout-amount";
import { customerCheckoutBlockedMessage, getCarCheckoutIneligibleReason } from "@/lib/checkout-eligibility";
import { getGlobalCurrencySettings } from "@/lib/currency";
import { getUserLegalStatusRows } from "@/lib/legal-profile";
import { prisma } from "@/lib/prisma";
import { safeAuth } from "@/lib/safe-auth";

import type { PaymentType } from "@prisma/client";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ carId?: string; type?: string }>;

export default async function ManualCheckoutPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const carId = typeof sp.carId === "string" ? sp.carId : "";
  if (!carId) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16">
        <p className="text-sm text-zinc-400">Add a vehicle from checkout first.</p>
        <BrowseCarsCtaLink className="mt-4 inline-flex" href="/inventory" size="compact" />
      </div>
    );
  }

  const paymentType = (sp.type === "RESERVATION_DEPOSIT" ? "RESERVATION_DEPOSIT" : "FULL") as PaymentType;

  const car = await prisma.car.findFirst({
    where: { id: carId },
    select: {
      id: true,
      title: true,
      basePriceRmb: true,
      currency: true,
      listingState: true,
      availabilityStatus: true,
      sourceType: true,
      reservationDepositPercent: true,
    },
  });
  if (!car) notFound();

  const ineligible = getCarCheckoutIneligibleReason(car);
  if (ineligible) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16">
        <PageHeading variant="dashboard" className="!text-xl">
          Offline checkout unavailable
        </PageHeading>
        <p className="mt-2 text-sm font-medium text-white">{car.title}</p>
        <p className="mt-4 text-sm leading-relaxed text-amber-100/90">{customerCheckoutBlockedMessage(ineligible)}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <BrowseCarsCtaLink href="/inventory" size="compact" />
          <Link href="/contact" className="inline-flex h-10 items-center rounded-lg border border-white/15 px-4 text-sm text-white hover:bg-white/5">
            Contact support
          </Link>
        </div>
      </div>
    );
  }

  const fx = await getGlobalCurrencySettings();
  const pct = car.reservationDepositPercent != null ? Number(car.reservationDepositPercent) : null;
  const amountGhs = getVehicleCheckoutAmountGhs(Number(car.basePriceRmb), paymentType, fx, pct);

  const session = await safeAuth();
  let profileLegalComplete = false;
  if (session?.user?.id) {
    const legalRows = await getUserLegalStatusRows(session.user.id);
    profileLegalComplete = legalRows.length === 0 || legalRows.every((r) => r.accepted);
  }

  return (
    <ManualCheckoutClient
      carId={car.id}
      paymentType={paymentType}
      vehicleTitle={car.title}
      amountGhs={amountGhs}
      currency={car.currency}
      profileLegalComplete={profileLegalComplete}
    />
  );
}
