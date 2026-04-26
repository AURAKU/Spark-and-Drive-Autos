import { NotificationType } from "@prisma/client";
import { NextResponse } from "next/server";
import { nanoid } from "nanoid";

import { getRequestIp } from "@/lib/client-ip";
import { ACCEPTANCE_CONTEXT, recordUserPolicyAcceptance } from "@/lib/legal-acceptance";
import { assertPartsFinderActivationLegal, POLICY_KEYS } from "@/lib/legal-enforcement";
import { upsertPartsFinderMembershipForActivation } from "@/lib/parts-finder/activate-membership";
import { partsFinderActivateBodySchema } from "@/lib/parts-finder/activation-legal-body";
import { getPartsFinderAccessSnapshot, PartsFinderAccessError, requirePartsFinderActivationAccess } from "@/lib/parts-finder/access";
import { getPartsFinderActivationSnapshot, getPartsFinderChargeQuote } from "@/lib/parts-finder/pricing";
import { applyWalletLedgerEntry } from "@/lib/wallet-ledger";

import { prisma } from "@/lib/prisma";
import { requireVerification } from "@/lib/identity-verification";
import { PolicyAcceptanceRequiredError, requirePolicyAcceptance } from "@/lib/legal-versioning";

/**
 * One-step activation: debit wallet (GHS), record successful payment, activate membership.
 */
export async function POST(req: Request) {
  const ip = getRequestIp(req);
  const userAgent = req.headers.get("user-agent");
  try {
    let bodyRaw: unknown = {};
    try {
      bodyRaw = await req.json();
    } catch {
      bodyRaw = {};
    }
    const bodyParsed = partsFinderActivateBodySchema.safeParse(bodyRaw);
    if (!bodyParsed.success) {
      return NextResponse.json(
        { ok: false, error: "Accept the latest platform terms and Parts Finder disclaimer, then try again." },
        { status: 400 },
      );
    }
    const body = bodyParsed.data;

    const legalOk = await assertPartsFinderActivationLegal({
      platformTermsVersion: body.platformTermsVersion,
      partsFinderDisclaimerVersion: body.partsFinderDisclaimerVersion,
    });
    if (!legalOk.ok) {
      return NextResponse.json(
        { ok: false, error: "Legal notices on this page are out of date. Refresh and accept again.", code: legalOk.code },
        { status: 409 },
      );
    }

    const { session } = await requirePartsFinderActivationAccess();
    const userId = session.user.id;
    try {
      await requirePolicyAcceptance({
        userId,
        policyKey: POLICY_KEYS.PARTS_FINDER_DISCLAIMER,
        context: "PAYMENT",
        ipAddress: ip,
        userAgent,
      });
    } catch (error) {
      if (error instanceof PolicyAcceptanceRequiredError) {
        return NextResponse.json(
          {
            ok: false,
            error: "You need to review and accept our updated terms before continuing.",
            code: "REQUIRE_ACCEPTANCE",
            policyKey: error.policyKey,
            version: error.version,
            title: error.title,
            effectiveDate: error.effectiveDate,
            context: error.context,
          },
          { status: 409 },
        );
      }
      throw error;
    }
    const access = await getPartsFinderAccessSnapshot();
    if (access.state === "ACTIVE") {
      return NextResponse.json({ ok: false, error: "Parts Finder membership is already active." }, { status: 400 });
    }
    if (access.state === "PENDING_PAYMENT") {
      return NextResponse.json(
        { ok: false, error: "A membership payment is already processing. Wait for confirmation or contact support." },
        { status: 409 },
      );
    }

    const snapshot = await getPartsFinderActivationSnapshot();
    const charge = getPartsFinderChargeQuote(access, snapshot);
    const amount = Number((charge.priceMinor / 100).toFixed(2));
    try {
      await requireVerification({
        userId,
        context: "HIGH_VALUE_PAYMENT",
        amountGhs: amount,
        ipAddress: ip,
        userAgent,
      });
    } catch (error) {
      if (error instanceof Error && error.message === "IDENTITY_VERIFICATION_REQUIRED") {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Identity verification is required before this wallet activation flow can continue. Visit Dashboard → Verification.",
            code: "IDENTITY_VERIFICATION_REQUIRED",
          },
          { status: 409 },
        );
      }
      throw error;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ ok: false, error: "Membership price is not configured." }, { status: 500 });
    }

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { walletBalance: true } });
    if (!user || Number(user.walletBalance) < amount) {
      return NextResponse.json(
        { ok: false, error: "Insufficient wallet balance. Add funds in parts checkout or use card payment." },
        { status: 400 },
      );
    }

    const [platformPv, discPv] = await Promise.all([
      prisma.policyVersion.findFirst({
        where: { policyKey: POLICY_KEYS.PLATFORM_TERMS_PRIVACY, isActive: true },
        orderBy: [{ effectiveAt: "desc" }, { createdAt: "desc" }],
      }),
      prisma.policyVersion.findFirst({
        where: { policyKey: POLICY_KEYS.PARTS_FINDER_DISCLAIMER, isActive: true },
        orderBy: [{ effectiveAt: "desc" }, { createdAt: "desc" }],
      }),
    ]);
    if (!platformPv || !discPv) {
      return NextResponse.json(
        {
          ok: false,
          error: "Required legal policies are not published yet. Please contact support or try again later.",
        },
        { status: 503 },
      );
    }

    await prisma.$transaction(async (tx) => {
      await recordUserPolicyAcceptance({
        userId,
        policyVersionId: platformPv.id,
        context: ACCEPTANCE_CONTEXT.PARTS_FINDER_ACTIVATION,
        ipAddress: ip,
        userAgent,
        tx,
      });
      await recordUserPolicyAcceptance({
        userId,
        policyVersionId: discPv.id,
        context: ACCEPTANCE_CONTEXT.PARTS_FINDER_ACTIVATION,
        ipAddress: ip,
        userAgent,
        tx,
      });
    });

    const reference = `SDA-PF-WAL-${nanoid(12).toUpperCase()}`;

    const payment = await prisma.$transaction(async (tx) => {
      await applyWalletLedgerEntry(
        {
          userId,
          reference,
          amount,
          currency: snapshot.currency,
          provider: "MANUAL",
          method: "BANK_GHS_COMPANY",
          direction: "DEBIT",
          purpose: "ADJUSTMENT",
          paidAt: new Date(),
          actorUserId: userId,
          providerPayload: {
            partsFinderWalletActivation: true,
            chargeKind: charge.kind,
            priceMinor: charge.priceMinor,
          },
        },
        tx,
      );

      const p = await tx.payment.create({
        data: {
          userId,
          provider: "MANUAL",
          settlementMethod: "PAYSTACK",
          providerReference: `PAY-${reference}`,
          amount,
          currency: snapshot.currency,
          status: "SUCCESS",
          paymentType: "PARTS_FINDER_MEMBERSHIP",
          paidAt: new Date(),
          idempotencyKey: reference,
          methodDetails: { source: "WALLET", flow: "PARTS_FINDER_ACTIVATE" },
        },
        select: { id: true, createdAt: true, amount: true, currency: true, status: true },
      });

      await upsertPartsFinderMembershipForActivation(
        userId,
        p,
        { source: "wallet", providerReference: `PAY-${reference}` },
        tx,
      );

      await tx.notification.create({
        data: {
          userId,
          type: NotificationType.SYSTEM,
          title: "Parts Finder membership active",
          body: `We deducted ${amount} ${snapshot.currency} from your wallet. Advanced search and refined results are unlocked.`,
          href: "/parts-finder/search",
        },
      });

      return p;
    });

    return NextResponse.json({
      ok: true,
      payment,
      membershipState: "ACTIVE" as const,
      redirectTo: "/parts-finder/search",
    });
  } catch (error) {
    if (error instanceof PartsFinderAccessError) {
      return NextResponse.json(
        { ok: false, error: error.message, code: error.code, redirectTo: error.redirectTo },
        { status: error.status },
      );
    }
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Wallet activation failed." },
      { status: 400 },
    );
  }
}
