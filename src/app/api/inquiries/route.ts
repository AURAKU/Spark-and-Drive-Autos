import { InquiryType, MessageSenderType } from "@prisma/client";
import { randomUUID } from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { safeAuth } from "@/lib/safe-auth";
import { ensureLead } from "@/lib/leads";
import { prisma } from "@/lib/prisma";
import { rateLimitForm } from "@/lib/rate-limit";
import { sanitizePlainText } from "@/lib/sanitize";

const schema = z.object({
  carId: z.string().cuid().optional(),
  type: z.nativeEnum(InquiryType).default(InquiryType.GENERAL),
  message: z.string().min(10).max(8000),
  guestName: z.string().max(120).optional(),
  guestEmail: z.string().email().optional(),
  guestPhone: z.string().max(40).optional(),
});

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rl = await rateLimitForm(`inquiry:${ip}`);
  if (!rl.success) {
    return NextResponse.json({ error: "Too many submissions. Please wait." }, { status: 429 });
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

  const session = await safeAuth();
  const data = parsed.data;
  const message = sanitizePlainText(data.message, 8000);

  const userId = session?.user?.id ?? null;
  let guestName = data.guestName ? sanitizePlainText(data.guestName, 120) : null;
  let guestEmail = data.guestEmail?.toLowerCase() ?? null;
  let guestPhone = data.guestPhone ? sanitizePlainText(data.guestPhone, 40) : null;

  if (!userId) {
    if (!guestName || !guestEmail || !guestPhone) {
      return NextResponse.json(
        { error: "Name, email, and phone are required for guest inquiries." },
        { status: 400 }
      );
    }
  } else {
    guestName = null;
    guestEmail = null;
    guestPhone = null;
  }

  const cookieStore = await cookies();
  let guestToken = cookieStore.get("sda_guest")?.value;
  let newGuestCookie: string | null = null;

  if (!userId) {
    if (!guestToken) {
      guestToken = `gst_${randomUUID().replaceAll("-", "")}`;
      newGuestCookie = guestToken;
    }
  }

  const lead = userId ? await ensureLead({ customerId: userId, sourceChannel: "INQUIRY", title: "Inquiry" }) : null;

  const subject = `Inquiry: ${data.type.replaceAll("_", " ")}`;

  const result = await prisma.$transaction(async (tx) => {
    const inquiry = await tx.inquiry.create({
      data: {
        carId: data.carId,
        userId,
        guestName,
        guestEmail,
        guestPhone,
        type: data.type,
        message,
        status: "NEW",
        leadId: lead?.id,
      },
    });

    const thread = await tx.chatThread.create({
      data: {
        inquiryId: inquiry.id,
        customerId: userId,
        guestToken: userId ? null : guestToken,
        guestName: guestName ?? undefined,
        guestEmail: guestEmail ?? undefined,
        carId: data.carId,
        leadId: lead?.id,
        subject,
        lastMessageAt: new Date(),
        unreadForAdmin: 1,
      },
    });

    await tx.message.create({
      data: {
        chatId: thread.id,
        senderType: MessageSenderType.USER,
        senderUserId: userId,
        body: message,
        messageType: "TEXT",
      },
    });

    return { inquiry, thread };
  });

  const res = NextResponse.json({
    id: result.inquiry.id,
    threadId: result.thread.id,
  });

  if (newGuestCookie) {
    res.cookies.set("sda_guest", newGuestCookie, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
  }

  return res;
}
