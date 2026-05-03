import { NextResponse } from "next/server";

import { getRequestIp } from "@/lib/client-ip";
import {
  acceptAllPendingLegalDocuments,
  isProfileLegalComplete,
  PROFILE_LEGAL_URL,
} from "@/lib/legal-compliance-central";
import { getUserLegalStatusRows } from "@/lib/legal-profile";
import { prisma } from "@/lib/prisma";
import { safeAuth } from "@/lib/safe-auth";

export async function GET() {
  const session = await safeAuth();
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "Sign in required." }, { status: 401 });
  }

  const userId = session.user.id;
  const [rows, user] = await Promise.all([
    getUserLegalStatusRows(userId),
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        legalAcceptedAt: true,
        legalAcceptedVersion: true,
      },
    }),
  ]);

  const pending = rows.filter((r) => !r.accepted);
  const legalAccepted = pending.length === 0;

  return NextResponse.json({
    ok: true,
    legalAccepted,
    profileUrl: PROFILE_LEGAL_URL,
    pendingCount: pending.length,
    missing: pending.map((r) => ({
      kind: r.kind,
      key: r.key,
      title: r.title,
      version: r.version,
    })),
    legalAcceptedAt: user?.legalAcceptedAt?.toISOString() ?? null,
    legalAcceptedVersion: user?.legalAcceptedVersion ?? null,
  });
}

export async function POST(req: Request) {
  const session = await safeAuth();
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "Sign in required." }, { status: 401 });
  }

  const userId = session.user.id;
  const ipAddress = getRequestIp(req);
  const userAgent = req.headers.get("user-agent");

  const body = await req.json().catch(() => null);
  const confirm = Boolean(body && typeof body === "object" && (body as { confirm?: unknown }).confirm === true);
  if (!confirm) {
    return NextResponse.json({ ok: false, error: "Send { \"confirm\": true } to record acceptance." }, { status: 400 });
  }

  const result = await acceptAllPendingLegalDocuments(userId, ipAddress, userAgent);

  return NextResponse.json({
    ok: true,
    legalAccepted: (await isProfileLegalComplete(userId)),
    acceptedPolicies: result.acceptedPolicies,
    acceptedContracts: result.acceptedContracts,
    remaining: result.remaining,
  });
}
