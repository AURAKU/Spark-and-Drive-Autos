import { NextResponse } from "next/server";
import { z } from "zod";

import { getRequestIp } from "@/lib/client-ip";
import { canAdminViewVerification, logVerificationAction } from "@/lib/identity-verification";
import { requireAdmin } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

const querySchema = z.object({
  kind: z.enum(["front", "back", "selfie"]),
});

type RouteContext = { params: Promise<{ verificationId: string }> };

export async function GET(req: Request, ctx: RouteContext) {
  const admin = await requireAdmin();
  const allowed = await canAdminViewVerification(admin.user.id);
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const url = new URL(req.url);
  const parsed = querySchema.safeParse({
    kind: url.searchParams.get("kind"),
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid document kind" }, { status: 400 });
  }
  const { verificationId } = await ctx.params;
  const verification = await prisma.userVerification.findUnique({
    where: { id: verificationId },
    select: {
      id: true,
      userId: true,
      documentFrontUrl: true,
      documentBackUrl: true,
      selfieUrl: true,
    },
  });
  if (!verification) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const target =
    parsed.data.kind === "front"
      ? verification.documentFrontUrl
      : parsed.data.kind === "back"
      ? verification.documentBackUrl
      : verification.selfieUrl;
  if (!target) {
    return NextResponse.json({ error: "Document not uploaded for this slot." }, { status: 404 });
  }

  await logVerificationAction({
    userId: verification.userId,
    verificationId: verification.id,
    actorId: admin.user.id,
    action: "VERIFICATION_DOCUMENT_VIEWED_BY_ADMIN",
    metadata: { kind: parsed.data.kind },
    ipAddress: getRequestIp(req),
    userAgent: req.headers.get("user-agent"),
  });
  return NextResponse.redirect(target, { status: 302 });
}
