import { NextResponse } from "next/server";

import { isAdminRole } from "@/auth";
import { safeAuth } from "@/lib/safe-auth";
import { prisma } from "@/lib/prisma";

export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await safeAuth();
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "Sign in required." }, { status: 401 });
  }
  const { id } = await context.params;
  const isAdmin = isAdminRole(session.user.role);
  const row = await prisma.verifiedPartRequest.findFirst({
    where: isAdmin ? { id } : { id, userId: session.user.id },
    include: {
      payment: true,
      receipt: true,
      userVehicle: true,
      partsFinderSearch: { select: { sessionId: true, id: true } },
      user: { select: { id: true, email: true, name: true } },
      assignedAdmin: { select: { id: true, email: true, name: true } },
    },
  });
  if (!row) {
    return NextResponse.json({ ok: false, error: "Request not found." }, { status: 404 });
  }
  await prisma.auditLog.create({
    data: {
      actorId: session.user.id,
      action: isAdmin ? "verified_part_request.admin_viewed" : "verified_part_request.user_viewed",
      entityType: "VerifiedPartRequest",
      entityId: row.id,
    },
  });
  return NextResponse.json({ ok: true, request: row });
}
