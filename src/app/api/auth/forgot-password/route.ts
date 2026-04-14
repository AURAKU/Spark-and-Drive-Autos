import { createHash, randomBytes } from "crypto";

import { NextResponse } from "next/server";
import { z } from "zod";

import { getRequestIp } from "@/lib/client-ip";
import { normalizePhone } from "@/lib/phone";
import { prisma } from "@/lib/prisma";
import { rateLimitForm } from "@/lib/rate-limit";
import { recordSecurityObservation } from "@/lib/security-observation";

const schema = z.object({
  identifier: z.string().min(3).max(160),
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
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const identifier = parsed.data.identifier.trim();
  const user = identifier.includes("@")
    ? await prisma.user.findUnique({
        where: { email: identifier.toLowerCase() },
        select: { id: true, email: true, passwordHash: true },
      })
    : await prisma.user.findFirst({
        where: { phone: normalizePhone(identifier) },
        select: { id: true, email: true, passwordHash: true },
      });

  // Always return success to avoid account enumeration.
  const generic = {
    ok: true,
    message: "If an account exists, reset instructions have been prepared.",
  } as const;

  if (!user?.passwordHash) {
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

  if (process.env.NODE_ENV !== "production") {
    return NextResponse.json({
      ...generic,
      devResetUrl: `/reset-password?token=${raw}`,
    });
  }

  return NextResponse.json(generic);
}
