import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    await requireAdmin();
    const rows = await prisma.verifiedPartRequest.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { id: true, email: true, name: true } },
        payment: { select: { id: true, status: true, providerReference: true } },
        assignedAdmin: { select: { id: true, email: true, name: true } },
      },
      take: 300,
    });
    return NextResponse.json({ ok: true, requests: rows });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Unable to load requests." }, { status: 400 });
  }
}
