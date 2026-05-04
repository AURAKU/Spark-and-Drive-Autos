import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { ACCEPTANCE_CONTEXT, recordUserPolicyAcceptance } from "@/lib/legal-acceptance";
import { ensurePartsFinderActivationPolicyVersions } from "@/lib/legal-ensure-parts-finder-policies";
import { assertPartsFinderActivationLegal, POLICY_KEYS } from "@/lib/legal-enforcement";
import { getDefaultPaymentProvider, getPaystackCallbackOrigin, getPaystackSecrets } from "@/lib/payment-provider-registry";
import { paystackInitialize } from "@/lib/paystack";
import { prisma } from "@/lib/prisma";
import { getPartsFinderAccessSnapshot, PartsFinderAccessError, requirePartsFinderActivationAccess } from "@/lib/parts-finder/access";
import { getPartsFinderActivationSnapshot, getPartsFinderChargeQuote } from "@/lib/parts-finder/pricing";
import { getRequestIp } from "@/lib/client-ip";
import { partsFinderActivateBodySchema } from "@/lib/parts-finder/activation-legal-body";
import { requireVerification } from "@/lib/identity-verification";
import { PolicyAcceptanceRequiredError, requirePolicyAcceptance } from "@/lib/legal-versioning";

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
    try {
      await requirePolicyAcceptance({
        userId: session.user.id,
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
      return NextResponse.json(
        {
          ok: false,
          code: "ALREADY_ACTIVE",
          error:
            "Your Parts Finder membership is already active. You can renew only after your current access window ends.",
          activeUntil: access.activeUntil,
        },
        { status: 409 },
      );
    }
    if (access.state === "PENDING_PAYMENT") {
      return NextResponse.json(
        {
          ok: false,
          code: "PENDING_PAYMENT",
          error: "A membership payment is still processing. Wait for confirmation, then refresh this page.",
        },
        { status: 409 },
      );
    }

    const ensured = await ensurePartsFinderActivationPolicyVersions({ actorUserId: session.user.id });
    if (!ensured.ok) {
      console.warn("[api/parts-finder/activate] policy ensure non-fatal:", ensured.reason, ensured.code ?? "");
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
          error:
            "Legal policies could not be loaded. Refresh the activation page or ask an admin to publish platform terms and the Parts Finder disclaimer under Admin → Legal.",
        },
        { status: 503 },
      );
    }

    await prisma.$transaction(async (tx) => {
      await recordUserPolicyAcceptance({
        userId: session.user.id,
        policyVersionId: platformPv.id,
        context: ACCEPTANCE_CONTEXT.PARTS_FINDER_ACTIVATION,
        ipAddress: ip,
        userAgent,
        tx,
      });
      await recordUserPolicyAcceptance({
        userId: session.user.id,
        policyVersionId: discPv.id,
        context: ACCEPTANCE_CONTEXT.PARTS_FINDER_ACTIVATION,
        ipAddress: ip,
        userAgent,
        tx,
      });
    });
    const snapshot = await getPartsFinderActivationSnapshot();
    const charge = getPartsFinderChargeQuote(access, snapshot);
    try {
      await requireVerification({
        userId: session.user.id,
        context: "HIGH_VALUE_PAYMENT",
        amountGhs: charge.priceMinor / 100,
        ipAddress: ip,
        userAgent,
      });
    } catch (error) {
      if (error instanceof Error && error.message === "IDENTITY_VERIFICATION_REQUIRED") {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Identity verification is required before this activation payment can continue. Visit Dashboard → Verification.",
            code: "IDENTITY_VERIFICATION_REQUIRED",
          },
          { status: 409 },
        );
      }
      throw error;
    }
    if (!session.user.email) {
      return NextResponse.json({ ok: false, error: "Account email missing." }, { status: 400 });
    }

    const selectedProvider = await getDefaultPaymentProvider();
    if (selectedProvider !== "PAYSTACK") {
      return NextResponse.json({ ok: false, error: "Only Paystack is supported for Parts Finder activation right now." }, { status: 409 });
    }
    const { secretKey } = await getPaystackSecrets();
    if (!secretKey) {
      return NextResponse.json({ ok: false, error: "Paystack is not configured for activation payments." }, { status: 500 });
    }

    const amount = charge.priceMinor / 100;
    const reference = `SDA-PF-ACT-${nanoid(10).toUpperCase()}`;
    const callbackOrigin = await getPaystackCallbackOrigin();
    const callbackUrl = `${callbackOrigin}/parts-finder/activate?reference=${encodeURIComponent(reference)}`;
    const payment = await prisma.payment.create({
      data: {
        userId: session.user.id,
        provider: "PAYSTACK",
        settlementMethod: "PAYSTACK",
        providerReference: reference,
        amount,
        currency: snapshot.currency,
        status: "PENDING",
        paymentType: "PARTS_FINDER_MEMBERSHIP",
        idempotencyKey: reference,
        methodDetails: {
          flow: "ACTIVATE",
          chargeKind: charge.kind,
          durationDays: charge.durationDays,
        },
      },
      select: { id: true, providerReference: true, amount: true, currency: true, status: true },
    });
    const init = await paystackInitialize({
      email: session.user.email,
      amountMinorUnits: charge.priceMinor,
      reference,
      currency: snapshot.currency,
      metadata: {
        paymentId: payment.id,
        flow: "PARTS_FINDER_ACTIVATE",
        userId: session.user.id,
      },
      callbackUrl,
      secretKey,
    });

    return NextResponse.json({ ok: true, snapshot, access, payment, authorizationUrl: init.authorization_url, reference: init.reference });
  } catch (error) {
    if (error instanceof PartsFinderAccessError) {
      return NextResponse.json(
        { ok: false, error: error.message, code: error.code, redirectTo: error.redirectTo },
        { status: error.status },
      );
    }
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Activation failed." }, { status: 400 });
  }
}
