import { hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getRequestIp } from "@/lib/client-ip";
import { ACCEPTANCE_CONTEXT, recordUserPolicyAcceptance } from "@/lib/legal-acceptance";
import { writeLegalAuditLog } from "@/lib/legal-audit";
import { POLICY_KEYS } from "@/lib/legal-enforcement";
import { prisma } from "@/lib/prisma";
import { isUniqueConstraintViolation } from "@/lib/prisma-unique";
import { normalizePhone } from "@/lib/phone";
import { rateLimitRegister } from "@/lib/rate-limit";
import { sanitizePlainText } from "@/lib/sanitize";
import { recordSecurityObservation } from "@/lib/security-observation";

const schema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email(),
  password: z.string().min(8).max(128),
  phone: z.string().max(40).optional(),
  country: z.string().max(80).optional(),
  acceptPlatformTerms: z.boolean().optional(),
});

export async function POST(req: Request) {
  const ip = getRequestIp(req);
  const userAgent = req.headers.get("user-agent");
  const rl = await rateLimitRegister(ip);
  if (!rl.success) {
    await recordSecurityObservation({
      severity: "HIGH",
      channel: "RATE_LIMIT",
      title: "Registration rate-limited (per IP)",
      ipAddress: ip,
      userAgent,
      path: "/api/auth/register",
    });
    return NextResponse.json({ error: "Too many attempts. Try again shortly." }, { status: 429 });
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

  const { name, email, password, phone, country, acceptPlatformTerms } = parsed.data;

  const activePlatformTerms = await prisma.policyVersion.findFirst({
    where: { policyKey: POLICY_KEYS.PLATFORM_TERMS_PRIVACY, isActive: true },
    orderBy: [{ effectiveAt: "desc" }, { createdAt: "desc" }],
    select: { id: true, version: true },
  });
  if (activePlatformTerms && acceptPlatformTerms !== true) {
    return NextResponse.json(
      { error: "Accept the active platform terms and privacy notice to create an account.", code: "TERMS_REQUIRED" },
      { status: 400 },
    );
  }

  const exists = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (exists) {
    await recordSecurityObservation({
      severity: "MEDIUM",
      channel: "API",
      title: "Registration attempt duplicate email",
      email: email.toLowerCase(),
      ipAddress: ip,
      userAgent,
      path: "/api/auth/register",
    });
    return NextResponse.json({ error: "Email already registered" }, { status: 409 });
  }
  const phoneNormalized = phone ? normalizePhone(phone) : null;
  if (phoneNormalized) {
    const phoneExists = await prisma.user.findUnique({
      where: { phone: phoneNormalized },
      select: { id: true },
    });
    if (phoneExists) {
      await recordSecurityObservation({
        severity: "MEDIUM",
        channel: "API",
        title: "Registration attempt duplicate phone",
        email: email.toLowerCase(),
        phone: phoneNormalized,
        ipAddress: ip,
        userAgent,
        path: "/api/auth/register",
      });
      return NextResponse.json({ error: "Phone already registered" }, { status: 409 });
    }
  }

  const passwordHash = await hash(password, 12);

  let user: { id: string };
  try {
    user = await prisma.user.create({
      data: {
        name: sanitizePlainText(name, 120),
        email: email.toLowerCase(),
        passwordHash,
        phone: phoneNormalized ? sanitizePlainText(phoneNormalized, 40) : null,
        country: country ? sanitizePlainText(country, 80) : null,
      },
      select: { id: true },
    });
  } catch (e) {
    if (isUniqueConstraintViolation(e)) {
      await recordSecurityObservation({
        severity: "MEDIUM",
        channel: "API",
        title: "Registration blocked (unique constraint / race)",
        email: email.toLowerCase(),
        ipAddress: ip,
        userAgent,
        path: "/api/auth/register",
      });
      return NextResponse.json(
        {
          error:
            "An account already exists with this email or phone number. Sign in instead, or use different contact details.",
        },
        { status: 409 },
      );
    }
    throw e;
  }

  if (activePlatformTerms && acceptPlatformTerms === true) {
    await recordUserPolicyAcceptance({
      userId: user.id,
      policyVersionId: activePlatformTerms.id,
      context: ACCEPTANCE_CONTEXT.REGISTRATION,
      ipAddress: ip,
      userAgent,
    });
    await writeLegalAuditLog({
      actorId: user.id,
      targetUserId: user.id,
      action: "USER_ACCEPTED_POLICY",
      entityType: "PolicyVersion",
      entityId: activePlatformTerms.id,
      metadata: { context: ACCEPTANCE_CONTEXT.REGISTRATION, version: activePlatformTerms.version },
      ipAddress: ip,
      userAgent,
    });
  }

  return NextResponse.json({ ok: true });
}
