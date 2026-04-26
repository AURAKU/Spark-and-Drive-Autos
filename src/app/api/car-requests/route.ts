import { CarRequestSourcePref, EngineType } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { ACCEPTANCE_CONTEXT, recordUserContractAcceptance, recordUserPolicyAcceptance } from "@/lib/legal-acceptance";
import { createUserLegalAcceptanceGuard } from "@/lib/legal-acceptance-guard";
import { requireContract, requirePolicy } from "@/lib/legal/guards";
import { assertSourcingRequestLegal, getActiveRiskPolicyRow, getActiveSourcingContractRow, POLICY_KEYS } from "@/lib/legal-enforcement";
import { writeLegalAuditLog } from "@/lib/legal-audit";
import { getUserRiskTags } from "@/lib/legal-risk-controls";
import { logRiskEvent } from "@/lib/risk-engine";
import { safeAuth } from "@/lib/safe-auth";
import { ensureLead } from "@/lib/leads";
import { prisma } from "@/lib/prisma";
import { rateLimitForm } from "@/lib/rate-limit";
import { sanitizePlainText } from "@/lib/sanitize";
import { requireVerification } from "@/lib/identity-verification";
import { PolicyAcceptanceRequiredError, requirePolicyAcceptance } from "@/lib/legal-versioning";

const schema = z.object({
  guestName: z.string().min(2).max(120),
  guestEmail: z.string().email(),
  guestPhone: z.string().min(6).max(40),
  country: z.string().max(80).optional(),
  brand: z.string().min(1).max(80),
  model: z.string().min(1).max(80),
  yearFrom: z.number().int().min(1980).max(2035).optional(),
  yearTo: z.number().int().min(1980).max(2035).optional(),
  trim: z.string().max(120).optional(),
  engineType: z
    .union([z.nativeEnum(EngineType), z.literal(""), z.undefined()])
    .optional()
    .transform((v) => (v === "" ? undefined : v)),
  transmission: z.string().max(80).optional(),
  colorPreference: z.string().max(120).optional(),
  budgetMin: z.number().nonnegative().optional(),
  budgetMax: z.number().nonnegative().optional(),
  currency: z.string().max(8).optional(),
  destinationCountry: z.string().max(80).optional(),
  destinationCity: z.string().max(80).optional(),
  sourcePreference: z.nativeEnum(CarRequestSourcePref).default(CarRequestSourcePref.EITHER),
  notes: z.string().max(8000).optional(),
  sourcingRiskAccepted: z.boolean(),
  sourcingContractAccepted: z.boolean(),
  sourcingRiskVersion: z.string().min(1).max(40),
  sourcingContractVersion: z.string().min(1).max(40),
});

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const userAgent = req.headers.get("user-agent");
  const rl = await rateLimitForm(`carreq:${ip}`);
  if (!rl.success) {
    return NextResponse.json({ error: "Too many submissions. Please wait." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
  }

  const session = await safeAuth();
  if (!session?.user?.id || !session.user.email) {
    return NextResponse.json({ error: "Sign in to submit a vehicle request." }, { status: 401 });
  }
  const legalGuard = await createUserLegalAcceptanceGuard(session.user.id);
  const hasPlatformTerms = await legalGuard.hasAccepted(POLICY_KEYS.PLATFORM_TERMS_PRIVACY);
  if (!hasPlatformTerms) {
    return NextResponse.json(
      { error: "Accept the latest platform terms and privacy policy before submitting sourcing requests." },
      { status: 409 },
    );
  }
  const risk = await getUserRiskTags(session.user.id);
  if (risk.includes("FRAUD_RISK_REVIEW") || risk.includes("MANUAL_REVIEW_REQUIRED")) {
    await logRiskEvent({
      userId: session.user.id,
      type: "blocked_sourcing_request_manual_review_required",
      severity: "high",
      meta: { route: "/api/car-requests" },
    });
    return NextResponse.json(
      { error: "Your account is under manual review. Contact support before submitting sourcing requests.", code: "MANUAL_REVIEW_REQUIRED" },
      { status: 423 },
    );
  }
  try {
    await requireVerification({
      userId: session.user.id,
      context: "SOURCING_DEPOSIT",
      ipAddress: ip === "unknown" ? null : ip,
      userAgent,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "IDENTITY_VERIFICATION_REQUIRED") {
      return NextResponse.json(
        {
          error:
            "Identity verification is required before submitting sourcing requests. Visit Dashboard → Verification and upload a valid Ghana Card or ID.",
          code: "IDENTITY_VERIFICATION_REQUIRED",
        },
        { status: 409 },
      );
    }
    throw error;
  }

  const d = parsed.data;
  const email = session.user.email.toLowerCase();

  if (!d.sourcingRiskAccepted || !d.sourcingContractAccepted) {
    return NextResponse.json(
      { error: "Accept the sourcing risk acknowledgement and sourcing contract to submit a request." },
      { status: 400 },
    );
  }
  try {
    await requirePolicyAcceptance({
      userId: session.user.id,
      policyKey: POLICY_KEYS.SOURCING_RISK_ACKNOWLEDGEMENT,
      context: "SOURCING",
      ipAddress: ip === "unknown" ? null : ip,
      userAgent,
    });
    await requirePolicyAcceptance({
      userId: session.user.id,
      policyKey: POLICY_KEYS.VEHICLE_SOURCING_CONTRACT,
      context: "SOURCING",
      ipAddress: ip === "unknown" ? null : ip,
      userAgent,
    });
  } catch (error) {
    if (error instanceof PolicyAcceptanceRequiredError) {
      return NextResponse.json(
        {
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

  try {
    await requirePolicy(session.user.id, POLICY_KEYS.SOURCING_RISK_ACKNOWLEDGEMENT);
    await requireContract(session.user.id, "VEHICLE_PARTS_SOURCING_CONTRACT");
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "POLICY_NOT_ACCEPTED") {
      return NextResponse.json({ error: "Sourcing risk acknowledgement must be accepted before submission." }, { status: 409 });
    }
    if (msg === "CONTRACT_NOT_ACCEPTED") {
      return NextResponse.json({ error: "Sourcing agreement must be accepted before submission." }, { status: 409 });
    }
    return NextResponse.json({ error: "Required legal acceptance is missing." }, { status: 409 });
  }

  const legalOk = await assertSourcingRequestLegal({
    riskAckVersion: d.sourcingRiskVersion,
    contractVersion: d.sourcingContractVersion,
  });
  if (!legalOk.ok) {
    return NextResponse.json(
      { error: "Sourcing terms on this page are out of date. Refresh and accept the latest versions.", code: legalOk.code },
      { status: 409 },
    );
  }

  const [riskPv, contractRow] = await Promise.all([getActiveRiskPolicyRow(), getActiveSourcingContractRow()]);
  if (!riskPv || !contractRow) {
    return NextResponse.json(
      { error: "Sourcing legal documents are not fully published yet. Please try again later." },
      { status: 503 },
    );
  }

  const lead = await ensureLead({
    customerId: session.user.id,
    sourceChannel: "CAR_REQUEST",
    title: "Sourcing request",
  });

  const row = await prisma.$transaction(async (tx) => {
    const cr = await tx.carRequest.create({
      data: {
        userId: session.user.id,
        guestName: sanitizePlainText(d.guestName, 120),
        guestEmail: email,
        guestPhone: sanitizePlainText(d.guestPhone, 40),
        country: d.country ? sanitizePlainText(d.country, 80) : null,
        brand: sanitizePlainText(d.brand, 80),
        model: sanitizePlainText(d.model, 80),
        yearFrom: d.yearFrom,
        yearTo: d.yearTo,
        trim: d.trim ? sanitizePlainText(d.trim, 120) : null,
        engineType: d.engineType,
        transmission: d.transmission ? sanitizePlainText(d.transmission, 80) : null,
        colorPreference: d.colorPreference ? sanitizePlainText(d.colorPreference, 120) : null,
        budgetMin: d.budgetMin,
        budgetMax: d.budgetMax,
        currency: d.currency ?? "GHS",
        destinationCountry: d.destinationCountry ? sanitizePlainText(d.destinationCountry, 80) : null,
        destinationCity: d.destinationCity ? sanitizePlainText(d.destinationCity, 80) : null,
        sourcePreference: d.sourcePreference,
        notes: d.notes ? sanitizePlainText(d.notes, 8000) : null,
        leadId: lead?.id,
      },
    });

    await recordUserPolicyAcceptance({
      userId: session.user.id,
      policyVersionId: riskPv.id,
      context: ACCEPTANCE_CONTEXT.SOURCING_REQUEST,
      ipAddress: ip === "unknown" ? null : ip,
      userAgent,
      tx,
    });
    await recordUserContractAcceptance({
      userId: session.user.id,
      contractId: contractRow.id,
      contractVersion: d.sourcingContractVersion,
      context: "SOURCING_REQUEST",
      ipAddress: ip === "unknown" ? null : ip,
      userAgent,
      tx,
    });

    return cr;
  });

  await writeLegalAuditLog({
    actorId: session.user.id,
    targetUserId: session.user.id,
    action: "SOURCING_REQUEST_SUBMITTED",
    entityType: "CarRequest",
    entityId: row.id,
    metadata: {
      sourcingRiskVersion: d.sourcingRiskVersion,
      sourcingContractVersion: d.sourcingContractVersion,
    },
    ipAddress: ip === "unknown" ? null : ip,
    userAgent,
  });

  return NextResponse.json({ id: row.id });
}
