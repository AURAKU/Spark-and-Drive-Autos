import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { nanoid } from "nanoid";

import { requireAdmin } from "@/lib/auth-helpers";
import {
  adminAmountToCanonicalRmb,
  getCarDisplayPrice,
  getGlobalCurrencySettings,
  type DisplayCurrency,
} from "@/lib/currency";
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

/** CSV currency cell — only explicit ISO-style codes (RMB → CNY). */
function parseBulkDisplayCurrency(raw: string | undefined): DisplayCurrency | undefined {
  const t = (raw ?? "").trim().toUpperCase();
  if (!t) return undefined;
  if (t === "RMB" || t === "CNY") return "CNY";
  if (t === "USD") return "USD";
  if (t === "GHS") return "GHS";
  return undefined;
}

type CarListPricingResolved = {
  basePriceRmb: number;
  basePriceAmount: Prisma.Decimal;
  basePriceCurrency: string;
  supplierCostRmb: Prisma.Decimal | null;
  supplierCostAmount: Prisma.Decimal | null;
  supplierCostCurrency: string | null;
};

function resolveCarListPricingForImport(
  record: Record<string, string>,
  fx: Awaited<ReturnType<typeof getGlobalCurrencySettings>>,
  existing: {
    basePriceRmb: unknown;
    basePriceAmount: unknown;
    basePriceCurrency: string;
    supplierCostRmb: unknown | null;
    supplierCostAmount: unknown | null;
    supplierCostCurrency: string | null;
  } | null,
): CarListPricingResolved {
  const baseAmt = parseDecimal(record.basePriceAmount);
  const baseCur = parseBulkDisplayCurrency(record.basePriceCurrency);
  const rmbCol = parseDecimal(record.basePriceRmb);

  let basePriceRmb: number;
  let baseAmount: number;
  let baseCurrency: DisplayCurrency;

  if (baseAmt != null) {
    const cur: DisplayCurrency = baseCur ?? "GHS";
    baseAmount = baseAmt;
    baseCurrency = cur;
    basePriceRmb = adminAmountToCanonicalRmb(baseAmt, cur, fx);
  } else if (rmbCol != null) {
    basePriceRmb = rmbCol;
    baseAmount = rmbCol;
    baseCurrency = "CNY";
  } else if (existing) {
    basePriceRmb = Number(existing.basePriceRmb);
    baseAmount = Number(existing.basePriceAmount);
    baseCurrency = (existing.basePriceCurrency as DisplayCurrency) || "CNY";
  } else {
    basePriceRmb = 0;
    baseAmount = 0;
    baseCurrency = "GHS";
  }

  const supAmt = parseDecimal(record.supplierCostAmount);
  const supCur = parseBulkDisplayCurrency(record.supplierCostCurrency);
  const supRmbCol = parseDecimal(record.supplierCostRmb);

  let supplierCostRmb: Prisma.Decimal | null = null;
  let supplierCostAmount: Prisma.Decimal | null = null;
  let supplierCostCurrency: string | null = null;

  if (supAmt != null && supAmt > 0) {
    const cur: DisplayCurrency = supCur ?? "CNY";
    const rmb = adminAmountToCanonicalRmb(supAmt, cur, fx);
    supplierCostRmb = new Prisma.Decimal(rmb);
    supplierCostAmount = new Prisma.Decimal(supAmt);
    supplierCostCurrency = cur;
  } else if (supRmbCol != null) {
    supplierCostRmb = new Prisma.Decimal(supRmbCol);
    supplierCostAmount = new Prisma.Decimal(supRmbCol);
    supplierCostCurrency = "CNY";
  } else if (existing && existing.supplierCostRmb != null) {
    supplierCostRmb = new Prisma.Decimal(Number(existing.supplierCostRmb));
    supplierCostAmount =
      existing.supplierCostAmount != null ? new Prisma.Decimal(Number(existing.supplierCostAmount)) : null;
    supplierCostCurrency = existing.supplierCostCurrency;
  }

  return {
    basePriceRmb,
    basePriceAmount: new Prisma.Decimal(baseAmount),
    basePriceCurrency: baseCurrency,
    supplierCostRmb,
    supplierCostAmount,
    supplierCostCurrency,
  };
}

function isRecordEffectivelyEmpty(record: Record<string, string>) {
  return Object.values(record).every((v) => (v ?? "").trim().length === 0);
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
    if (isRecordEffectivelyEmpty(record)) {
      okCount++;
      await prisma.importRowResult.create({
        data: { importJobId: job.id, rowNumber: i + 2, ok: true, message: "Skipped empty row" },
      });
      continue;
    }
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
  const baseRmb = parseDecimal(record.basePriceRmb) ?? null;
  const priceGhs = parseDecimal(record.priceGhs);
  const id = nonEmpty(record.id);
  const slugIn = nonEmpty(record.slug);

  if (id && z.string().cuid().safeParse(id).success) {
    const existing = await prisma.part.findUnique({ where: { id } });
    if (existing) {
      let nextSlug = existing.slug;
      if (slugIn && slugIn !== existing.slug) {
        const clash = await prisma.part.findUnique({ where: { slug: slugIn } });
        if (clash && clash.id !== id) throw new Error(`slug already in use: ${slugIn}`);
        nextSlug = slugIn;
      }
      const nextBaseRmb = baseRmb ?? Number(existing.basePriceRmb);
      const nextPriceGhs = priceGhs ?? getCarDisplayPrice(nextBaseRmb, "GHS", fx);
      await prisma.part.update({
        where: { id },
        data: {
          slug: nextSlug,
          ...(title ? { title } : {}),
          ...(record.shortDescription !== undefined ? { shortDescription: nonEmpty(record.shortDescription) ?? null } : {}),
          ...(record.description !== undefined ? { description: nonEmpty(record.description) ?? null } : {}),
          ...(record.category !== undefined ? { category: nonEmpty(record.category) ?? existing.category } : {}),
          ...(record.origin !== undefined && nonEmpty(record.origin) ? { origin: pickPartOrigin(record.origin) } : {}),
          ...(baseRmb != null ? { basePriceRmb: baseRmb } : {}),
          ...(priceGhs != null || baseRmb != null ? { priceGhs: nextPriceGhs } : {}),
          ...(record.stockQty !== undefined && nonEmpty(record.stockQty) ? { stockQty: parseIntSafe(record.stockQty, existing.stockQty) } : {}),
          ...(record.stockStatus !== undefined && nonEmpty(record.stockStatus) ? { stockStatus: pickPartStock(record.stockStatus) } : {}),
          ...(record.stockStatusLocked !== undefined && nonEmpty(record.stockStatusLocked) ? { stockStatusLocked: parseBool(record.stockStatusLocked, existing.stockStatusLocked) } : {}),
          ...(record.listingState !== undefined && nonEmpty(record.listingState) ? { listingState: pickPartListing(record.listingState) } : {}),
          ...(record.sku !== undefined ? { sku: nonEmpty(record.sku) ?? null } : {}),
          ...(record.featured !== undefined && nonEmpty(record.featured) ? { featured: parseBool(record.featured, existing.featured) } : {}),
          ...(record.supplierCostRmb !== undefined && parseDecimal(record.supplierCostRmb) != null ? { supplierCostRmb: parseDecimal(record.supplierCostRmb) } : {}),
          ...(record.coverImageUrl !== undefined ? { coverImageUrl: nonEmpty(record.coverImageUrl) ?? null } : {}),
        },
      });
      return;
    }
  }
  if (!title) throw new Error("title is required for new parts row");
  const finalBaseRmb = baseRmb ?? 0;
  const finalPriceGhs = priceGhs ?? getCarDisplayPrice(finalBaseRmb, "GHS", fx);

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
      title,
      shortDescription: nonEmpty(record.shortDescription) ?? null,
      description: nonEmpty(record.description) ?? null,
      category: nonEmpty(record.category) ?? "General",
      origin: pickPartOrigin(record.origin),
      basePriceRmb: finalBaseRmb,
      priceGhs: finalPriceGhs,
      stockQty: parseIntSafe(record.stockQty, 0),
      stockStatus: pickPartStock(record.stockStatus),
      stockStatusLocked: parseBool(record.stockStatusLocked, false),
      listingState: pickPartListing(record.listingState),
      sku: nonEmpty(record.sku) ?? null,
      featured: parseBool(record.featured, false),
      supplierCostRmb: parseDecimal(record.supplierCostRmb),
      coverImageUrl: nonEmpty(record.coverImageUrl) ?? null,
    },
  });
}

async function importCarRow(record: Record<string, string>, fx: Awaited<ReturnType<typeof getGlobalCurrencySettings>>) {
  const title = nonEmpty(record.title);
  const priceOverride = parseDecimal(record.price);
  const id = nonEmpty(record.id);
  const slugIn = nonEmpty(record.slug);

  const pricingKeysPresent =
    record.basePriceAmount !== undefined ||
    record.basePriceCurrency !== undefined ||
    record.basePriceRmb !== undefined ||
    record.supplierCostAmount !== undefined ||
    record.supplierCostCurrency !== undefined ||
    record.supplierCostRmb !== undefined;

  if (id && z.string().cuid().safeParse(id).success) {
    const existing = await prisma.car.findUnique({ where: { id } });
    if (existing) {
      const pricing = resolveCarListPricingForImport(record, fx, {
        basePriceRmb: existing.basePriceRmb,
        basePriceAmount: existing.basePriceAmount,
        basePriceCurrency: existing.basePriceCurrency,
        supplierCostRmb: existing.supplierCostRmb,
        supplierCostAmount: existing.supplierCostAmount,
        supplierCostCurrency: existing.supplierCostCurrency,
      });
      const nextPrice =
        priceOverride ?? getCarDisplayPrice(pricing.basePriceRmb, "GHS", fx);

      let nextSlug = existing.slug;
      if (slugIn && slugIn !== existing.slug) {
        const clash = await prisma.car.findUnique({ where: { slug: slugIn } });
        if (clash && clash.id !== id) throw new Error(`slug already in use: ${slugIn}`);
        nextSlug = slugIn;
      }

      await prisma.car.update({
        where: { id },
        data: {
          slug: nextSlug,
          ...(title ? { title } : {}),
          ...(record.brand !== undefined && nonEmpty(record.brand) ? { brand: nonEmpty(record.brand)! } : {}),
          ...(record.model !== undefined && nonEmpty(record.model) ? { model: nonEmpty(record.model)! } : {}),
          ...(record.year !== undefined && nonEmpty(record.year) ? { year: parseIntSafe(record.year, existing.year) } : {}),
          ...(record.trim !== undefined ? { trim: nonEmpty(record.trim) ?? null } : {}),
          ...(record.engineType !== undefined && nonEmpty(record.engineType) ? { engineType: pickEngine(record.engineType) } : {}),
          ...(record.transmission !== undefined ? { transmission: nonEmpty(record.transmission) ?? null } : {}),
          ...(record.sourceType !== undefined && nonEmpty(record.sourceType) ? { sourceType: pickSource(record.sourceType) } : {}),
          ...(record.availabilityStatus !== undefined && nonEmpty(record.availabilityStatus) ? { availabilityStatus: pickAvailability(record.availabilityStatus) } : {}),
          ...(pricingKeysPresent || priceOverride != null
            ? {
                basePriceAmount: pricing.basePriceAmount,
                basePriceCurrency: pricing.basePriceCurrency,
                basePriceRmb: new Prisma.Decimal(pricing.basePriceRmb),
                supplierCostRmb: pricing.supplierCostRmb,
                supplierCostAmount: pricing.supplierCostAmount,
                supplierCostCurrency: pricing.supplierCostCurrency,
                price: nextPrice,
              }
            : {}),
          ...(record.currency !== undefined && nonEmpty(record.currency) ? { currency: nonEmpty(record.currency)! } : {}),
          ...(record.listingState !== undefined && nonEmpty(record.listingState) ? { listingState: pickCarListing(record.listingState) } : {}),
          ...(record.featured !== undefined && nonEmpty(record.featured) ? { featured: parseBool(record.featured, existing.featured) } : {}),
          ...(record.mileage !== undefined && parseDecimal(record.mileage) != null ? { mileage: Math.round(parseDecimal(record.mileage)!) } : {}),
          ...(record.colorExterior !== undefined ? { colorExterior: nonEmpty(record.colorExterior) ?? null } : {}),
          ...(record.location !== undefined ? { location: nonEmpty(record.location) ?? null } : {}),
          ...(record.shortDescription !== undefined ? { shortDescription: nonEmpty(record.shortDescription) ?? null } : {}),
          ...(record.seaShippingFeeGhs !== undefined && parseDecimal(record.seaShippingFeeGhs) != null ? { seaShippingFeeGhs: parseDecimal(record.seaShippingFeeGhs) } : {}),
          ...(record.coverImageUrl !== undefined ? { coverImageUrl: nonEmpty(record.coverImageUrl) ?? null } : {}),
        },
      });
      return;
    }
  }
  if (!title) throw new Error("title is required for new cars row");
  const pricing = resolveCarListPricingForImport(record, fx, null);
  const finalPrice = priceOverride ?? getCarDisplayPrice(pricing.basePriceRmb, "GHS", fx);

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
      title,
      brand: nonEmpty(record.brand) ?? "Unknown",
      model: nonEmpty(record.model) ?? "Unknown",
      year: parseIntSafe(record.year, new Date().getFullYear()),
      trim: nonEmpty(record.trim) ?? null,
      engineType: pickEngine(record.engineType),
      transmission: nonEmpty(record.transmission) ?? null,
      sourceType: pickSource(record.sourceType),
      availabilityStatus: pickAvailability(record.availabilityStatus),
      basePriceAmount: pricing.basePriceAmount,
      basePriceCurrency: pricing.basePriceCurrency,
      basePriceRmb: new Prisma.Decimal(pricing.basePriceRmb),
      supplierCostRmb: pricing.supplierCostRmb,
      supplierCostAmount: pricing.supplierCostAmount,
      supplierCostCurrency: pricing.supplierCostCurrency,
      price: finalPrice,
      currency: nonEmpty(record.currency) ?? "GHS",
      listingState: pickCarListing(record.listingState),
      featured: parseBool(record.featured, false),
      mileage: parseDecimal(record.mileage) != null ? Math.round(parseDecimal(record.mileage)!) : null,
      colorExterior: nonEmpty(record.colorExterior) ?? null,
      location: nonEmpty(record.location) ?? null,
      shortDescription: nonEmpty(record.shortDescription) ?? null,
      seaShippingFeeGhs: parseDecimal(record.seaShippingFeeGhs),
      coverImageUrl: nonEmpty(record.coverImageUrl) ?? null,
    },
  });
}
