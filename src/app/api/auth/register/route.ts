import { hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getRequestIp } from "@/lib/client-ip";
import { prisma } from "@/lib/prisma";
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

  const { name, email, password, phone, country } = parsed.data;
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
    const phoneExists = await prisma.user.findFirst({
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
  await prisma.user.create({
    data: {
      name: sanitizePlainText(name, 120),
      email: email.toLowerCase(),
      passwordHash,
      phone: phoneNormalized ? sanitizePlainText(phoneNormalized, 40) : null,
      country: country ? sanitizePlainText(country, 80) : null,
    },
  });

  return NextResponse.json({ ok: true });
}
