import { createHash, randomBytes } from "crypto";

import { NextResponse } from "next/server";
import { z } from "zod";

import { getRequestIp } from "@/lib/client-ip";
import { sendPasswordResetEmail } from "@/lib/password-reset-email";
import { prisma } from "@/lib/prisma";
import { rateLimitForm } from "@/lib/rate-limit";
import { recordSecurityObservation } from "@/lib/security-observation";

const schema = z.object({
  identifier: z.string().trim().toLowerCase().email("Enter a valid email address."),
});

function tokenHash(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export async function POST(req: Request) {
  const ip = getRequestIp(req);
  const userAgent = req.headers.get("user-agent");
  const rl = await rateLimitForm(`pwdreset:${ip}`);
  if (!rl.success) {
    await recordSecurityObservation({
      severity: "MEDIUM",
      channel: "RATE_LIMIT",
      title: "Password reset rate-limited (per IP)",
      ipAddress: ip,
      userAgent,
      path: "/api/auth/forgot-password",
    });
    return NextResponse.json({ error: "Too many attempts. Please wait and try again." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const message = issue?.code === "too_small" ? "Enter your email address." : "Enter a valid email address.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.identifier },
    select: { id: true, email: true, passwordHash: true },
  });

  // Always return success to avoid account enumeration.
  const generic = {
    ok: true,
    message: "If an account exists, reset instructions have been sent.",
  } as const;

  if (!user?.passwordHash || !user.email) {
    return NextResponse.json(generic);
  }

  const raw = randomBytes(32).toString("hex");
  const hash = tokenHash(raw);
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

  await prisma.$transaction([
    prisma.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } }),
    prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hash,
        expiresAt,
      },
    }),
  ]);

  const includeDevLink = process.env.NODE_ENV !== "production" && process.env.RESET_PASSWORD_SHOW_DEV_LINK === "1";
  if (includeDevLink) {
    return NextResponse.json({
      ...generic,
      devResetUrl: `/reset-password?token=${raw}`,
    });
  }

  try {
    await sendPasswordResetEmail({ toEmail: user.email, token: raw });
  } catch (error) {
    console.error("[auth][forgot-password] Failed to send reset email", {
      userId: user.id,
      email: user.email,
      path: "/api/auth/forgot-password",
      error: error instanceof Error ? error.message : "unknown_error",
    });
    await recordSecurityObservation({
      severity: "HIGH",
      channel: "AUTH",
      title: "Password reset email delivery failed",
      userId: user.id,
      email: user.email,
      ipAddress: ip,
      userAgent,
      path: "/api/auth/forgot-password",
      metadataJson: {
        error: error instanceof Error ? error.message : "unknown_error",
      },
    });
  }

  return NextResponse.json(generic);
}
