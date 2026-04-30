import { VerificationDocumentType } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getRequestIp } from "@/lib/client-ip";
import {
  ALLOWED_VERIFICATION_DOCUMENT_TYPES,
  ID_VERIFICATION_CONSENT_TEXT,
  logVerificationAction,
  submitVerification,
} from "@/lib/identity-verification";
import { isTrustedPaymentProofUrl } from "@/lib/payment-proof-url";
import { rateLimitForm } from "@/lib/rate-limit";
import { safeAuth } from "@/lib/safe-auth";
import { sanitizePlainText } from "@/lib/sanitize";
import { PolicyAcceptanceRequiredError, requirePolicyAcceptance } from "@/lib/legal-versioning";
import { POLICY_KEYS } from "@/lib/legal-enforcement";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  documentType: z.nativeEnum(VerificationDocumentType),
  reason: z.string().min(4).max(300).optional(),
  documentFrontUrl: z.string().url(),
  documentBackUrl: z.string().url().optional(),
  selfieUrl: z.string().url().optional(),
  consentAccepted: z.boolean(),
});

export async function POST(req: Request) {
  const ip = getRequestIp(req);
  const userAgent = req.headers.get("user-agent");
  const rl = await rateLimitForm(`verification-submit:${ip}`);
  if (!rl.success) {
    return NextResponse.json({ error: "Too many verification submissions. Please try again shortly." }, { status: 429 });
  }

  const session = await safeAuth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request payload", issues: parsed.error.flatten() }, { status: 400 });
  }
  if (!ALLOWED_VERIFICATION_DOCUMENT_TYPES.includes(parsed.data.documentType)) {
    return NextResponse.json(
      { error: "Unsupported document type. Use Ghana Card, Passport, or Driver License only." },
      { status: 400 },
    );
  }

  if (!parsed.data.consentAccepted) {
    return NextResponse.json({ error: "Consent is required before document upload." }, { status: 400 });
  }
  if (!isTrustedPaymentProofUrl(parsed.data.documentFrontUrl)) {
    return NextResponse.json({ error: "Invalid front document URL." }, { status: 400 });
  }
  if (parsed.data.documentBackUrl && !isTrustedPaymentProofUrl(parsed.data.documentBackUrl)) {
    return NextResponse.json({ error: "Invalid back document URL." }, { status: 400 });
  }
  if (parsed.data.selfieUrl && !isTrustedPaymentProofUrl(parsed.data.selfieUrl)) {
    return NextResponse.json({ error: "Invalid selfie URL." }, { status: 400 });
  }

  const latest = await prisma.userVerification.findFirst({
    where: { userId: session.user.id },
    orderBy: [{ submittedAt: "desc" }, { createdAt: "desc" }],
    select: { id: true, status: true },
  });
  if (latest && ["PENDING", "UNDER_REVIEW", "VERIFIED", "REQUIRED"].includes(latest.status)) {
    return NextResponse.json(
      {
        error:
          latest.status === "VERIFIED"
            ? "Your identity is already verified. No new submission is required."
            : "Your current verification is already submitted and awaiting admin review.",
      },
      { status: 409 },
    );
  }
  try {
    await requirePolicyAcceptance({
      userId: session.user.id,
      policyKey: POLICY_KEYS.IDENTITY_VERIFICATION_CONSENT,
      context: "VERIFICATION",
      ipAddress: ip,
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

  const verification = await submitVerification({
    userId: session.user.id,
    documentType: parsed.data.documentType,
    reason: parsed.data.reason ? sanitizePlainText(parsed.data.reason, 300) : null,
    documentFrontUrl: parsed.data.documentFrontUrl,
    documentBackUrl: parsed.data.documentBackUrl ?? null,
    selfieUrl: parsed.data.selfieUrl ?? null,
    consentAccepted: true,
    ipAddress: ip,
    userAgent,
  });

  await logVerificationAction({
    userId: session.user.id,
    verificationId: verification.id,
    action: "CONSENT_ACCEPTED_FOR_VERIFICATION",
    metadata: { consentText: ID_VERIFICATION_CONSENT_TEXT },
    ipAddress: ip,
    userAgent,
  });

  return NextResponse.json({ ok: true, verificationId: verification.id, status: verification.status });
}
