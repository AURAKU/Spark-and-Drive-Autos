import { createHash } from "crypto";

import { hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getRequestIp } from "@/lib/client-ip";
import { prisma } from "@/lib/prisma";
import { rateLimitForm } from "@/lib/rate-limit";
import { recordSecurityObservation } from "@/lib/security-observation";

const schema = z.object({
  token: z.string().min(32).max(256),
  password: z.string().min(8).max(128),
});

function tokenHash(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export async function POST(req: Request) {
  const ip = getRequestIp(req);
  const userAgent = req.headers.get("user-agent");
  const rl = await rateLimitForm(`pwdreset-confirm:${ip}`);
  if (!rl.success) {
    await recordSecurityObservation({
      severity: "HIGH",
      channel: "RATE_LIMIT",
      title: "Password reset confirm rate-limited",
      ipAddress: ip,
      userAgent,
      path: "/api/auth/reset-password",
      metadataJson: { scope: "pwdreset-confirm" },
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
    return NextResponse.json({ error: "Invalid request", issues: parsed.error.flatten() }, { status: 400 });
  }

  const hashToken = tokenHash(parsed.data.token);
  const now = new Date();
  const token = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken },
    select: { id: true, userId: true, expiresAt: true, usedAt: true },
  });

  if (!token || token.usedAt || token.expiresAt <= now) {
    await recordSecurityObservation({
      severity: "MEDIUM",
      channel: "AUTH",
      title: "Password reset rejected (invalid or expired token)",
      userId: token?.userId ?? null,
      ipAddress: ip,
      userAgent,
      path: "/api/auth/reset-password",
      metadataJson: {
        reason: !token ? "not_found" : token.usedAt ? "already_used" : "expired",
      },
    });
    return NextResponse.json({ error: "Reset link is invalid or expired." }, { status: 400 });
  }

  const passwordHash = await hash(parsed.data.password, 12);
  await prisma.$transaction([
    prisma.user.update({
      where: { id: token.userId },
      data: { passwordHash },
    }),
    prisma.passwordResetToken.update({
      where: { id: token.id },
      data: { usedAt: now },
    }),
    prisma.passwordResetToken.deleteMany({
      where: { userId: token.userId, id: { not: token.id } },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
