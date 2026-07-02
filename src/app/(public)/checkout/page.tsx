import { PaymentType } from "@prisma/client";
import { cookies } from "next/headers";
import { Suspense } from "react";

import { CheckoutClient } from "./checkout-client";
import type { VehiclePricePreview } from "@/lib/currency";
import { getCarDisplayPrice, getGlobalCurrencySettings, parseDisplayCurrency } from "@/lib/currency";
import { globalReservationDepositPercentFromSettings, resolveReservationDepositPercent } from "@/lib/checkout-amount";
import {
  computeDepositCheckoutSnapshot,
  getVehicleSettlementAmountGhs,
} from "@/lib/vehicle-deposit-pricing";
import { customerCheckoutBlockedMessage, getCarCheckoutIneligibleReason } from "@/lib/checkout-eligibility";
import { hasAcceptedContract } from "@/lib/legal-backend-helpers";
import { getCheckoutLegalVersions, requiresRiskAcknowledgement, requiresSourcingContract } from "@/lib/legal-enforcement";
import { POLICY_KEYS } from "@/lib/legal-enforcement";
import { hasUserAccepted } from "@/lib/legal-versioning";
import { getUserLegalStatusRows } from "@/lib/legal-profile";
import { prisma } from "@/lib/prisma";
import { safeAuth } from "@/lib/safe-auth";

export const dynamic = "force-dynamic";

const vehicleSelect = {
  title: true,
  basePriceRmb: true,
  basePriceAmount: true,
  basePriceCurrency: true,
  priceGhs: true,
  priceUsd: true,
  priceCny: true,
  sourceType: true,
  seaShippingFeeGhs: true,
  listingState: true,
  availabilityStatus: true,
  reservationDepositPercent: true,
} as const;

type VehicleRow = {
  title: string;
  basePriceRmb: unknown;
  basePriceAmount?: unknown;
  basePriceCurrency?: string | null;
  priceGhs?: unknown;
  priceUsd?: unknown;
  priceCny?: unknown;
  sourceType: import("@prisma/client").SourceType;
  seaShippingFeeGhs?: unknown;
  listingState: import("@prisma/client").CarListingState;
  availabilityStatus: import("@prisma/client").AvailabilityStatus;
  reservationDepositPercent?: unknown;
};

async function buildCheckoutSummary(params: {
  vehicle: VehicleRow;
  paymentType: PaymentType;
  displayCurrency: ReturnType<typeof parseDisplayCurrency>;
  sessionUserId: string | undefined;
  legalVersions: Awaited<ReturnType<typeof getCheckoutLegalVersions>>;
}): Promise<{
  checkoutSummary: VehiclePricePreview | null;
  checkoutBlock: { message: string; title: string } | null;
  legal: {
    requiresContract: boolean;
    requiresRisk: boolean;
    profileLegalComplete: boolean;
    agreementAccepted: boolean;
    contractAccepted: boolean;
    riskAccepted: boolean;
  };
}> {
  const { vehicle, paymentType, displayCurrency, sessionUserId, legalVersions } = params;
  const ineligible = getCarCheckoutIneligibleReason(vehicle);
  if (ineligible) {
    return {
      checkoutSummary: null,
      checkoutBlock: { title: vehicle.title, message: customerCheckoutBlockedMessage(ineligible) },
      legal: {
        requiresContract: false,
        requiresRisk: false,
        profileLegalComplete: false,
        agreementAccepted: false,
        contractAccepted: false,
        riskAccepted: false,
      },
    };
  }

  const fx = await getGlobalCurrencySettings();
  const base = Number(vehicle.basePriceRmb);
  const pctStored = vehicle.reservationDepositPercent != null ? Number(vehicle.reservationDepositPercent) : null;
  const settlementRow = getVehicleSettlementAmountGhs(vehicle, paymentType, fx, pctStored);
  if (!settlementRow || settlementRow.settlementGhs <= 0) {
    return {
      checkoutSummary: null,
      checkoutBlock: {
        title: vehicle.title,
        message:
          "This vehicle does not have a valid list price for online checkout. Please contact support or choose another listing.",
      },
      legal: {
        requiresContract: false,
        requiresRisk: false,
        profileLegalComplete: false,
        agreementAccepted: false,
        contractAccepted: false,
        riskAccepted: false,
      },
    };
  }

  const globalPct = globalReservationDepositPercentFromSettings(fx);
  const depositSnap =
    paymentType === PaymentType.RESERVATION_DEPOSIT
      ? computeDepositCheckoutSnapshot(vehicle, fx, pctStored, globalPct)
      : null;
  const settlementGhs = settlementRow.settlementGhs;
  const reservationDepositPercentApplied =
    paymentType === PaymentType.RESERVATION_DEPOSIT
      ? depositSnap?.depositPercentApplied ?? resolveReservationDepositPercent(pctStored, globalPct)
      : 0;
  const requiresContract = requiresSourcingContract(vehicle.sourceType);
  const requiresRisk = requiresRiskAcknowledgement(vehicle.sourceType);

  let profileLegalComplete = false;
  let agreementAccepted = false;
  let contractAccepted = false;
  let riskAccepted = false;

  if (sessionUserId) {
    const legalRows = await getUserLegalStatusRows(sessionUserId);
    profileLegalComplete = legalRows.length === 0 || legalRows.every((r) => r.accepted);
    if (profileLegalComplete) {
      agreementAccepted = true;
      contractAccepted = true;
      riskAccepted = true;
    } else {
      agreementAccepted = await hasUserAccepted(
        sessionUserId,
        POLICY_KEYS.CHECKOUT_AGREEMENT,
        legalVersions.agreementVersion,
      );
      if (requiresContract) {
        contractAccepted = await hasAcceptedContract(sessionUserId, "VEHICLE_PARTS_SOURCING_CONTRACT");
      }
      if (requiresRisk) {
        riskAccepted = await hasUserAccepted(
          sessionUserId,
          POLICY_KEYS.SOURCING_RISK_ACKNOWLEDGEMENT,
          legalVersions.riskVersion,
        );
      }
    }
  }

  return {
    checkoutSummary: {
      title: vehicle.title,
      basePriceRmb: base,
      displayAmount: getCarDisplayPrice(base, displayCurrency, fx),
      displayCurrency,
      sourceType: vehicle.sourceType,
      seaShippingFeeGhs: vehicle.seaShippingFeeGhs != null ? Number(vehicle.seaShippingFeeGhs) : null,
      settlementGhs,
      fullGhs: settlementRow.fullListGhs,
      reservationDepositPercentApplied,
      rmbToGhsDivisor: Number(fx.rmbToGhs),
      paymentType: paymentType === PaymentType.RESERVATION_DEPOSIT ? "RESERVATION_DEPOSIT" : "FULL",
    },
    checkoutBlock: null,
    legal: {
      requiresContract,
      requiresRisk,
      profileLegalComplete,
      agreementAccepted,
      contractAccepted,
      riskAccepted,
    },
  };
}

async function CheckoutWithData({
  searchParams,
}: {
  searchParams: Promise<{ carId?: string; motorcycleId?: string; type?: string }>;
}) {
  const sp = await searchParams;
  const carId = sp.carId ?? null;
  const motorcycleId = sp.motorcycleId ?? null;
  const paymentType: PaymentType =
    sp.type === "RESERVATION_DEPOSIT" ? PaymentType.RESERVATION_DEPOSIT : PaymentType.FULL;
  const cookieStore = await cookies();
  const displayCurrency = parseDisplayCurrency(cookieStore.get("sda_currency")?.value);
  const session = await safeAuth();
  const legalVersions = await getCheckoutLegalVersions();

  let checkoutSummary: VehiclePricePreview | null = null;
  let checkoutBlock: { message: string; title: string } | null = null;
  let requiresContract = false;
  let requiresRisk = false;
  let profileLegalComplete = false;
  let agreementAccepted = false;
  let contractAccepted = false;
  let riskAccepted = false;

  if (carId) {
    const car = await prisma.car.findFirst({ where: { id: carId }, select: vehicleSelect });
    if (car) {
      const built = await buildCheckoutSummary({
        vehicle: car,
        paymentType,
        displayCurrency,
        sessionUserId: session?.user?.id,
        legalVersions,
      });
      checkoutSummary = built.checkoutSummary;
      checkoutBlock = built.checkoutBlock;
      requiresContract = built.legal.requiresContract;
      requiresRisk = built.legal.requiresRisk;
      profileLegalComplete = built.legal.profileLegalComplete;
      agreementAccepted = built.legal.agreementAccepted;
      contractAccepted = built.legal.contractAccepted;
      riskAccepted = built.legal.riskAccepted;
    }
  } else if (motorcycleId) {
    const motorcycle = await prisma.motorcycle.findFirst({ where: { id: motorcycleId }, select: vehicleSelect });
    if (motorcycle) {
      const built = await buildCheckoutSummary({
        vehicle: motorcycle,
        paymentType,
        displayCurrency,
        sessionUserId: session?.user?.id,
        legalVersions,
      });
      checkoutSummary = built.checkoutSummary;
      checkoutBlock = built.checkoutBlock;
      requiresContract = built.legal.requiresContract;
      requiresRisk = built.legal.requiresRisk;
      profileLegalComplete = built.legal.profileLegalComplete;
      agreementAccepted = built.legal.agreementAccepted;
      contractAccepted = built.legal.contractAccepted;
      riskAccepted = built.legal.riskAccepted;
    }
  }

  return (
    <CheckoutClient
      vehicleKind={carId ? "car" : motorcycleId ? "motorcycle" : null}
      vehicleId={carId ?? motorcycleId}
      checkoutSummary={checkoutSummary}
      checkoutBlock={checkoutBlock}
      legalRequirements={{
        agreementVersion: legalVersions.agreementVersion,
        contractVersion: legalVersions.contractVersion,
        riskVersion: legalVersions.riskVersion,
        requiresContract,
        requiresRisk,
        profileLegalComplete,
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
  searchParams: Promise<{ carId?: string; motorcycleId?: string; type?: string }>;
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
