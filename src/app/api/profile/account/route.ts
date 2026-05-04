import { NextResponse } from "next/server";
import { z } from "zod";

import { requireUser } from "@/lib/auth-helpers";
import { isAccountPhoneBlank, isValidNormalizedPhoneDigits, normalizePhone } from "@/lib/phone";
import { prisma } from "@/lib/prisma";
import { isUniqueConstraintViolation } from "@/lib/prisma-unique";
import { sanitizePlainText } from "@/lib/sanitize";

const nameSchema = z.string().min(2).max(120);

export async function PATCH(req: Request) {
  try {
    const session = await requireUser();

    let body: Record<string, unknown>;
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    if (Object.prototype.hasOwnProperty.call(body, "email")) {
      return NextResponse.json({ error: "Email cannot be changed here." }, { status: 400 });
    }

    const wantsName = typeof body.name === "string";
    const wantsPhone = typeof body.phone === "string";

    if (!wantsName && !wantsPhone) {
      return NextResponse.json({ error: "Send name and/or phone to update." }, { status: 400 });
    }

    if (wantsName && !nameSchema.safeParse(body.name).success) {
      return NextResponse.json({ error: "Name must be between 2 and 120 characters." }, { status: 400 });
    }

    let phoneNormalized: string | undefined;
    if (wantsPhone) {
      const trimmed = (body.phone as string).trim();
      if (!trimmed) {
        return NextResponse.json({ error: "Enter a phone number or omit the phone field." }, { status: 400 });
      }
      phoneNormalized = normalizePhone(trimmed);
      if (!isValidNormalizedPhoneDigits(phoneNormalized)) {
        return NextResponse.json(
          { error: "Enter a valid phone number (include country code; 9–15 digits)." },
          { status: 400 },
        );
      }
    }

    const current = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { phone: true },
    });
    if (!current) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    if (wantsPhone && !isAccountPhoneBlank(current.phone)) {
      return NextResponse.json(
        { error: "Phone is already saved on this account and cannot be changed here." },
        { status: 409 },
      );
    }

    const data: { name?: string; phone?: string } = {};
    if (wantsName) {
      data.name = sanitizePlainText(body.name as string, 120);
    }
    if (wantsPhone && phoneNormalized) {
      data.phone = phoneNormalized;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
    }

    try {
      await prisma.user.update({
        where: { id: session.user.id },
        data,
        select: { id: true },
      });
    } catch (e) {
      if (isUniqueConstraintViolation(e)) {
        return NextResponse.json(
          { error: "This phone number is already registered to another account." },
          { status: 409 },
        );
      }
      throw e;
    }

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
