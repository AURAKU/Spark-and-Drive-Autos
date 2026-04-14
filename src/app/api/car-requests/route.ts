import { CarRequestSourcePref, EngineType } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { safeAuth } from "@/lib/safe-auth";
import { ensureLead } from "@/lib/leads";
import { prisma } from "@/lib/prisma";
import { rateLimitForm } from "@/lib/rate-limit";
import { sanitizePlainText } from "@/lib/sanitize";

const schema = z.object({
  guestName: z.string().min(2).max(120),
  guestEmail: z.string().email(),
  guestPhone: z.string().min(6).max(40),
  country: z.string().max(80).optional(),
  brand: z.string().min(1).max(80),
  model: z.string().min(1).max(80),
  yearFrom: z.number().int().min(1980).max(2035).optional(),
  yearTo: z.number().int().min(1980).max(2035).optional(),
  trim: z.string().max(120).optional(),
  engineType: z
    .union([z.nativeEnum(EngineType), z.literal(""), z.undefined()])
    .optional()
    .transform((v) => (v === "" ? undefined : v)),
  transmission: z.string().max(80).optional(),
  colorPreference: z.string().max(120).optional(),
  budgetMin: z.number().nonnegative().optional(),
  budgetMax: z.number().nonnegative().optional(),
  currency: z.string().max(8).optional(),
  destinationCountry: z.string().max(80).optional(),
  destinationCity: z.string().max(80).optional(),
  sourcePreference: z.nativeEnum(CarRequestSourcePref).default(CarRequestSourcePref.EITHER),
  notes: z.string().max(8000).optional(),
});

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rl = await rateLimitForm(`carreq:${ip}`);
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
  if (!session?.user?.id || !session.user.email) {
    return NextResponse.json({ error: "Sign in to submit a vehicle request." }, { status: 401 });
  }

  const d = parsed.data;
  const email = session.user.email.toLowerCase();

  const lead = await ensureLead({
    customerId: session.user.id,
    sourceChannel: "CAR_REQUEST",
    title: "Sourcing request",
  });

  const row = await prisma.carRequest.create({
    data: {
      userId: session.user.id,
      guestName: sanitizePlainText(d.guestName, 120),
      guestEmail: email,
      guestPhone: sanitizePlainText(d.guestPhone, 40),
      country: d.country ? sanitizePlainText(d.country, 80) : null,
      brand: sanitizePlainText(d.brand, 80),
      model: sanitizePlainText(d.model, 80),
      yearFrom: d.yearFrom,
      yearTo: d.yearTo,
      trim: d.trim ? sanitizePlainText(d.trim, 120) : null,
      engineType: d.engineType,
      transmission: d.transmission ? sanitizePlainText(d.transmission, 80) : null,
      colorPreference: d.colorPreference ? sanitizePlainText(d.colorPreference, 120) : null,
      budgetMin: d.budgetMin,
      budgetMax: d.budgetMax,
      currency: d.currency ?? "GHS",
      destinationCountry: d.destinationCountry ? sanitizePlainText(d.destinationCountry, 80) : null,
      destinationCity: d.destinationCity ? sanitizePlainText(d.destinationCity, 80) : null,
      sourcePreference: d.sourcePreference,
      notes: d.notes ? sanitizePlainText(d.notes, 8000) : null,
      leadId: lead?.id,
    },
  });

  return NextResponse.json({ id: row.id });
}
