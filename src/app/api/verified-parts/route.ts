import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await requireUser();
    const rows = await prisma.verifiedPartRequest.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      include: {
        payment: { select: { id: true, status: true, providerReference: true } },
      },
    });
    return NextResponse.json({ ok: true, requests: rows });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Unable to load requests." }, { status: 400 });
  }
}
