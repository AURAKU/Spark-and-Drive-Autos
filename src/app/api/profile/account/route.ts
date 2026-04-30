import { NextResponse } from "next/server";
import { z } from "zod";

import { requireUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { sanitizePlainText } from "@/lib/sanitize";

const nameSchema = z.object({
  name: z.string().min(2).max(120),
});

const immutableAttemptSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
});

export async function PATCH(req: Request) {
  try {
    const session = await requireUser();
    const bodyRaw = await req.json().catch(() => ({}));
    const immutableAttempt = immutableAttemptSchema.safeParse(bodyRaw);
    if (!immutableAttempt.success) {
      return NextResponse.json({ error: "Invalid account update payload." }, { status: 400 });
    }
    if (
      typeof immutableAttempt.data.email === "string" ||
      typeof immutableAttempt.data.phone === "string"
    ) {
      return NextResponse.json(
        { error: "Email and phone are immutable after account creation. Only name can be updated here." },
        { status: 400 },
      );
    }
    const parsed = nameSchema.safeParse(bodyRaw);
    if (!parsed.success) {
      return NextResponse.json({ error: "Name must be between 2 and 120 characters." }, { status: 400 });
    }
    await prisma.user.update({
      where: { id: session.user.id },
      data: { name: sanitizePlainText(parsed.data.name, 120) },
      select: { id: true },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not update account." },
      { status: 400 },
    );
  }
}
