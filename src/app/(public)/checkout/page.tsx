import { PaymentType } from "@prisma/client";
import { cookies } from "next/headers";
import { Suspense } from "react";

import { CheckoutClient } from "./checkout-client";
import type { VehiclePricePreview } from "@/lib/currency";
import { getCarDisplayPrice, getGlobalCurrencySettings, parseDisplayCurrency } from "@/lib/currency";
import { getVehicleCheckoutAmountGhs } from "@/lib/checkout-amount";
import { customerCheckoutBlockedMessage, getCarCheckoutIneligibleReason } from "@/lib/checkout-eligibility";
import { hasAcceptedContract } from "@/lib/legal-backend-helpers";
import { getCheckoutLegalVersions, requiresRiskAcknowledgement, requiresSourcingContract } from "@/lib/legal-enforcement";
import { POLICY_KEYS } from "@/lib/legal-enforcement";
import { hasUserAccepted } from "@/lib/legal-versioning";
import { prisma } from "@/lib/prisma";
import { safeAuth } from "@/lib/safe-auth";

export const dynamic = "force-dynamic";

async function CheckoutWithData({ searchParams }: { searchParams: Promise<{ carId?: string; type?: string }> }) {
  const sp = await searchParams;
  const carId = sp.carId ?? null;
  const paymentType: PaymentType =
    sp.type === "RESERVATION_DEPOSIT" ? PaymentType.RESERVATION_DEPOSIT : PaymentType.FULL;
  const cookieStore = await cookies();
  const displayCurrency = parseDisplayCurrency(cookieStore.get("sda_currency")?.value);
  const session = await safeAuth();

  let checkoutSummary: VehiclePricePreview | null = null;
  let checkoutBlock: { message: string; title: string } | null = null;
  const legalVersions = await getCheckoutLegalVersions();
  let agreementAccepted = false;
  let contractAccepted = false;
  let riskAccepted = false;
  let requiresContract = false;
  let requiresRisk = false;
  if (carId) {
    const car = await prisma.car.findFirst({
      where: { id: carId },
      select: {
        title: true,
        basePriceRmb: true,
        sourceType: true,
        seaShippingFeeGhs: true,
        listingState: true,
        availabilityStatus: true,
      },
    });
    if (car) {
      const ineligible = getCarCheckoutIneligibleReason(car);
      if (ineligible) {
        checkoutBlock = {
          title: car.title,
          message: customerCheckoutBlockedMessage(ineligible),
        };
      } else {
        const fx = await getGlobalCurrencySettings();
        const base = Number(car.basePriceRmb);
        const fullGhs = getCarDisplayPrice(base, "GHS", fx);
        const settlementGhs = getVehicleCheckoutAmountGhs(base, paymentType, fx);
        requiresContract = requiresSourcingContract(car.sourceType);
        requiresRisk = requiresRiskAcknowledgement(car.sourceType);
        if (session?.user?.id) {
          agreementAccepted = await hasUserAccepted(
            session.user.id,
            POLICY_KEYS.CHECKOUT_AGREEMENT,
            legalVersions.agreementVersion,
          );
          if (requiresContract) {
            contractAccepted = await hasAcceptedContract(session.user.id, "VEHICLE_PARTS_SOURCING_CONTRACT");
          }
          if (requiresRisk) {
            riskAccepted = await hasUserAccepted(
              session.user.id,
              POLICY_KEYS.SOURCING_RISK_ACKNOWLEDGEMENT,
              legalVersions.riskVersion,
            );
          }
        }
        checkoutSummary = {
          title: car.title,
          basePriceRmb: base,
          displayAmount: getCarDisplayPrice(base, displayCurrency, fx),
          displayCurrency,
          sourceType: car.sourceType,
          seaShippingFeeGhs: car.seaShippingFeeGhs != null ? Number(car.seaShippingFeeGhs) : null,
          settlementGhs,
          fullGhs,
          rmbToGhsDivisor: Number(fx.rmbToGhs),
          paymentType: paymentType === PaymentType.RESERVATION_DEPOSIT ? "RESERVATION_DEPOSIT" : "FULL",
        };
      }
    }
  }

  return (
    <CheckoutClient
      checkoutSummary={checkoutSummary}
      checkoutBlock={checkoutBlock}
      legalRequirements={{
        agreementVersion: legalVersions.agreementVersion,
        contractVersion: legalVersions.contractVersion,
        riskVersion: legalVersions.riskVersion,
        requiresContract,
        requiresRisk,
        agreementAccepted,
        contractAccepted,
        riskAccepted,
      }}
    />
  );
}

export default function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ carId?: string; type?: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-xl px-4 py-16 text-sm text-zinc-400">Preparing checkout…</div>
      }
    >
      <CheckoutWithData searchParams={searchParams} />
    </Suspense>
  );
}
