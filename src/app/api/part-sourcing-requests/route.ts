import { NextResponse } from "next/server";
import { z } from "zod";

import { ensureLead } from "@/lib/leads";
import { isAllowedPartSourcingImageUrl } from "@/lib/part-sourcing-image-url";
import { prisma } from "@/lib/prisma";
import { rateLimitForm } from "@/lib/rate-limit";
import { sanitizePlainText } from "@/lib/sanitize";
import { safeAuth } from "@/lib/safe-auth";

const MAX_IMAGES = 8;

const optionalTrim = (max: number) =>
  z
    .union([z.string(), z.null(), z.undefined()])
    .transform((v) => {
      if (v == null) return null;
      const t = String(v).trim();
      return t.length ? t.slice(0, max) : null;
    });

const schema = z.object({
  summaryTitle: optionalTrim(200),
  description: z.string().trim().min(10).max(8000),
  vehicleMake: optionalTrim(80),
  vehicleModel: optionalTrim(80),
  vehicleYear: z.number().int().min(1950).max(2035).optional().nullable(),
  partNumber: optionalTrim(120),
  quantity: z.number().int().min(1).max(999).optional().default(1),
  urgency: z.enum(["normal", "soon", "urgent"]).optional().default("normal"),
  deliveryCity: optionalTrim(120),
  imageUrls: z.array(z.string().url()).max(MAX_IMAGES).optional().default([]),
});

export async function POST(req: Request) {
  const session = await safeAuth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in to submit a parts request." }, { status: 401 });
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rl = await rateLimitForm(`partsreq:${session.user.id}:${ip}`);
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

  const d = parsed.data;
  const urls = d.imageUrls ?? [];
  for (const url of urls) {
    if (!isAllowedPartSourcingImageUrl(url)) {
      return NextResponse.json({ error: "One or more image links are invalid." }, { status: 400 });
    }
  }

  const lead = await ensureLead({
    customerId: session.user.id,
    sourceChannel: "PARTS_SOURCING_REQUEST",
    title: "Parts / accessories sourcing",
  });

  const urgencyLabel =
    d.urgency === "urgent" ? "Urgent" : d.urgency === "soon" ? "Within a few weeks" : "Normal";

  const row = await prisma.partSourcingRequest.create({
    data: {
      userId: session.user.id,
      summaryTitle: d.summaryTitle ? sanitizePlainText(d.summaryTitle, 200) : null,
      description: sanitizePlainText(d.description, 8000),
      vehicleMake: d.vehicleMake ? sanitizePlainText(d.vehicleMake, 80) : null,
      vehicleModel: d.vehicleModel ? sanitizePlainText(d.vehicleModel, 80) : null,
      vehicleYear: d.vehicleYear ?? null,
      partNumber: d.partNumber ? sanitizePlainText(d.partNumber, 120) : null,
      quantity: d.quantity ?? 1,
      urgency: urgencyLabel,
      deliveryCity: d.deliveryCity ? sanitizePlainText(d.deliveryCity, 120) : null,
      imageUrls: urls,
      leadId: lead?.id,
    },
  });

  return NextResponse.json({ id: row.id });
}
