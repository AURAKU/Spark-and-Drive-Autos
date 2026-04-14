import { NextResponse } from "next/server";
import { z } from "zod";
import { nanoid } from "nanoid";

import { requireAdmin } from "@/lib/auth-helpers";
import { getCarDisplayPrice, getGlobalCurrencySettings } from "@/lib/currency";
import {
  parseCsvText,
  rowToRecord,
  pickEngine,
  pickSource,
  pickAvailability,
  pickCarListing,
  pickPartListing,
  pickPartStock,
  pickPartOrigin,
  parseBool,
  parseDecimal,
  parseIntSafe,
  slugifyBase,
  uniqueSlug,
} from "@/lib/inventory-bulk";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  entity: z.enum(["CARS", "PARTS"]),
  csv: z.string().min(1).max(12_000_000),
});

function nonEmpty(s: string | undefined): string | undefined {
  const t = (s ?? "").trim();
  return t.length ? t : undefined;
}

export async function POST(req: Request) {
  let session: Awaited<ReturnType<typeof requireAdmin>>;
  try {
    session = await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
  }

  const job = await prisma.importJob.create({
    data: {
      entity: parsed.data.entity,
      status: "RUNNING",
      createdById: session.user.id,
      sourceFile: "bulk-csv-upload",
      startedAt: new Date(),
    },
  });

  const { header, rows } = parseCsvText(parsed.data.csv);
  if (header.length === 0 || rows.length === 0) {
    await prisma.importJob.update({
      where: { id: job.id },
      data: { status: "FAILED", finishedAt: new Date(), summary: "No data rows after header" },
    });
    return NextResponse.json({ error: "CSV has no data rows" }, { status: 400 });
  }

  const fxSettings = await getGlobalCurrencySettings();
  let okCount = 0;
  let failCount = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const record = rowToRecord(header, row);
    try {
      if (parsed.data.entity === "PARTS") {
        await importPartRow(record, fxSettings);
      } else {
        await importCarRow(record, fxSettings);
      }
      okCount++;
      await prisma.importRowResult.create({
        data: { importJobId: job.id, rowNumber: i + 2, ok: true },
      });
    } catch (e) {
      failCount++;
      await prisma.importRowResult.create({
        data: {
          importJobId: job.id,
          rowNumber: i + 2,
          ok: false,
          message: e instanceof Error ? e.message : "Import failed",
          payload: record,
        },
      });
    }
  }

  await prisma.importJob.update({
    where: { id: job.id },
    data: {
      status: failCount > 0 && okCount === 0 ? "FAILED" : "COMPLETED",
      finishedAt: new Date(),
      summary: `Imported ${okCount}, failed ${failCount}`,
    },
  });

  return NextResponse.json({ ok: true, importJobId: job.id, imported: okCount, failed: failCount });
}

async function importPartRow(record: Record<string, string>, fx: Awaited<ReturnType<typeof getGlobalCurrencySettings>>) {
  const title = nonEmpty(record.title);
  if (!title) throw new Error("title is required");

  const baseRmb = parseDecimal(record.basePriceRmb) ?? 0;
  const priceGhs =
    parseDecimal(record.priceGhs) ?? getCarDisplayPrice(baseRmb, "GHS", fx);
  const id = nonEmpty(record.id);
  const slugIn = nonEmpty(record.slug);

  const data = {
    title,
    shortDescription: nonEmpty(record.shortDescription) ?? null,
    description: nonEmpty(record.description) ?? null,
    category: nonEmpty(record.category) ?? "General",
    origin: pickPartOrigin(record.origin),
    basePriceRmb: baseRmb,
    priceGhs,
    stockQty: parseIntSafe(record.stockQty, 0),
    stockStatus: pickPartStock(record.stockStatus),
    stockStatusLocked: parseBool(record.stockStatusLocked, false),
    listingState: pickPartListing(record.listingState),
    sku: nonEmpty(record.sku) ?? null,
    featured: parseBool(record.featured, false),
    supplierCostRmb: parseDecimal(record.supplierCostRmb),
    coverImageUrl: nonEmpty(record.coverImageUrl) ?? null,
  };

  if (id && z.string().cuid().safeParse(id).success) {
    const existing = await prisma.part.findUnique({ where: { id } });
    if (existing) {
      let nextSlug = existing.slug;
      if (slugIn && slugIn !== existing.slug) {
        const clash = await prisma.part.findUnique({ where: { slug: slugIn } });
        if (clash && clash.id !== id) throw new Error(`slug already in use: ${slugIn}`);
        nextSlug = slugIn;
      }
      await prisma.part.update({
        where: { id },
        data: { ...data, slug: nextSlug },
      });
      return;
    }
  }

  let slug = slugIn ?? "";
  if (!slug) {
    slug = uniqueSlug(slugifyBase(title), nanoid(6).toLowerCase());
  } else {
    const taken = await prisma.part.findUnique({ where: { slug } });
    if (taken) slug = uniqueSlug(slugifyBase(title), nanoid(6).toLowerCase());
  }

  await prisma.part.create({
    data: {
      slug,
      ...data,
    },
  });
}

async function importCarRow(record: Record<string, string>, fx: Awaited<ReturnType<typeof getGlobalCurrencySettings>>) {
  const title = nonEmpty(record.title);
  if (!title) throw new Error("title is required");

  const baseRmb = parseDecimal(record.basePriceRmb) ?? 0;
  const priceOverride = parseDecimal(record.price);
  const priceGhs = priceOverride ?? getCarDisplayPrice(baseRmb, "GHS", fx);
  const id = nonEmpty(record.id);
  const slugIn = nonEmpty(record.slug);

  const data = {
    title,
    brand: nonEmpty(record.brand) ?? "Unknown",
    model: nonEmpty(record.model) ?? "Unknown",
    year: parseIntSafe(record.year, new Date().getFullYear()),
    trim: nonEmpty(record.trim) ?? null,
    engineType: pickEngine(record.engineType),
    transmission: nonEmpty(record.transmission) ?? null,
    sourceType: pickSource(record.sourceType),
    availabilityStatus: pickAvailability(record.availabilityStatus),
    basePriceRmb: baseRmb,
    price: priceGhs,
    currency: nonEmpty(record.currency) ?? "GHS",
    listingState: pickCarListing(record.listingState),
    featured: parseBool(record.featured, false),
    mileage: parseDecimal(record.mileage) != null ? Math.round(parseDecimal(record.mileage)!) : null,
    colorExterior: nonEmpty(record.colorExterior) ?? null,
    location: nonEmpty(record.location) ?? null,
    shortDescription: nonEmpty(record.shortDescription) ?? null,
    seaShippingFeeGhs: parseDecimal(record.seaShippingFeeGhs),
    supplierCostRmb: parseDecimal(record.supplierCostRmb),
    coverImageUrl: nonEmpty(record.coverImageUrl) ?? null,
  };

  if (id && z.string().cuid().safeParse(id).success) {
    const existing = await prisma.car.findUnique({ where: { id } });
    if (existing) {
      let nextSlug = existing.slug;
      if (slugIn && slugIn !== existing.slug) {
        const clash = await prisma.car.findUnique({ where: { slug: slugIn } });
        if (clash && clash.id !== id) throw new Error(`slug already in use: ${slugIn}`);
        nextSlug = slugIn;
      }
      await prisma.car.update({
        where: { id },
        data: { ...data, slug: nextSlug },
      });
      return;
    }
  }

  let slug = slugIn ?? "";
  if (!slug) {
    slug = uniqueSlug(slugifyBase(title), nanoid(6).toLowerCase());
  } else {
    const taken = await prisma.car.findUnique({ where: { slug } });
    if (taken) slug = uniqueSlug(slugifyBase(title), nanoid(6).toLowerCase());
  }

  await prisma.car.create({
    data: {
      slug,
      ...data,
    },
  });
}
