"use server";

import { Prisma } from "@prisma/client";
import {
  AvailabilityStatus,
  CarListingState,
  EngineType,
  MotorcycleType,
  SourceType,
} from "@prisma/client";
import { nanoid } from "nanoid";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth-helpers";
import { adminAmountToCanonicalRmb, getCarDisplayPrice, getGlobalCurrencySettings } from "@/lib/currency";
import { generateMotorcycleSeo } from "@/lib/motorcycle-seo";
import { parseSpecificationsText } from "@/lib/motorcycle-spec-parser";
import { prisma } from "@/lib/prisma";

function slugify(title: string) {
  const base = title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
  return `${base}-${nanoid(6).toLowerCase()}`;
}

function parseTagList(raw: unknown): string[] {
  if (typeof raw === "string" && raw.trim()) {
    return raw.split(",").map((s) => s.trim()).filter(Boolean);
  }
  if (Array.isArray(raw)) return raw.filter((x): x is string => typeof x === "string");
  return [];
}

const optionalStr = (max: number) =>
  z.preprocess((v) => (v === "" || v === undefined ? undefined : v), z.string().max(max).optional());

const vehicleCurrencySchema = z.enum(["GHS", "USD", "CNY"]);

const motorcycleSchema = z.object({
  brand: z.string().min(1).max(80),
  model: z.string().min(1).max(80),
  year: z.coerce.number().int().min(1980).max(2035),
  basePriceAmount: z.coerce.number().positive(),
  basePriceCurrency: vehicleCurrencySchema,
  engineType: z.nativeEnum(EngineType),
  motorcycleType: z.nativeEnum(MotorcycleType),
  mileage: z.coerce.number().int().nonnegative(),
  condition: z.string().min(1).max(120),
  sourceType: z.nativeEnum(SourceType),
  longDescription: z.string().min(10).max(20000),
  variant: optionalStr(120),
  transmission: optionalStr(80),
  driveType: optionalStr(80),
  color: optionalStr(80),
  vin: optionalStr(32),
  frameNumber: optionalStr(64),
  engineNumber: optionalStr(64),
  engineCc: z.preprocess((v) => {
    if (v === "" || v === undefined) return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  }, z.number().int().positive().optional()),
  inspectionStatus: optionalStr(120),
  estimatedDelivery: optionalStr(120),
  reservationDepositPercent: z.preprocess((v) => {
    if (v === "" || v === undefined) return 80;
    const n = Number(v);
    return Number.isFinite(n) ? n : 80;
  }, z.number().gt(0).lte(100)),
  seaShippingFeeGhs: z.preprocess((v) => {
    if (v === "" || v === undefined) return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  }, z.number().nonnegative().optional()),
  specificationsText: optionalStr(20000),
  featureTags: z.string().optional(),
  highlightTags: z.string().optional(),
  warranty: optionalStr(500),
  batteryCapacity: optionalStr(80),
  motorPower: optionalStr(80),
  electricRange: optionalStr(80),
  chargingTime: optionalStr(80),
  topSpeedKmh: z.preprocess((v) => {
    if (v === "" || v === undefined) return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  }, z.number().int().positive().optional()),
  horsepower: z.preprocess((v) => {
    if (v === "" || v === undefined) return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  }, z.number().int().positive().optional()),
  torque: optionalStr(80),
  coolingType: optionalStr(80),
  fuelTankCapacity: optionalStr(80),
  weightKg: z.preprocess((v) => {
    if (v === "" || v === undefined) return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  }, z.number().int().positive().optional()),
  seatHeight: z.preprocess((v) => {
    if (v === "" || v === undefined) return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  }, z.number().int().positive().optional()),
  wheelSize: optionalStr(40),
  tyreSize: optionalStr(40),
  listingState: z.nativeEnum(CarListingState).default(CarListingState.DRAFT),
  featured: z.preprocess((v) => v === "on" || v === "true", z.boolean()).optional().default(false),
  coverImageUrl: z.preprocess(
    (v) => (v === "" ? undefined : v),
    z.union([z.string().url(), z.undefined()]).optional(),
  ),
  coverImagePublicId: optionalStr(200),
});

const updateSchema = motorcycleSchema.extend({
  id: z.string().cuid(),
  slug: z.preprocess(
    (v) => (v === "" || v === undefined ? undefined : v),
    z.string().min(3).max(200).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
  ),
});

function buildTitle(d: { year: number; brand: string; model: string; variant?: string | null }) {
  return [d.year, d.brand, d.model, d.variant].filter(Boolean).join(" ");
}

async function syncSpecsFromText(motorcycleId: string, text: string | undefined) {
  await prisma.motorcycleSpecification.deleteMany({ where: { motorcycleId } });
  const rows = parseSpecificationsText(text);
  if (rows.length === 0) return;
  await prisma.motorcycleSpecification.createMany({
    data: rows.map((r) => ({
      motorcycleId,
      label: r.label,
      value: r.value,
      sortOrder: r.sortOrder,
    })),
  });
}

export async function createMotorcycle(_prev: unknown, formData: FormData) {
  try {
    await requireAdmin();
    const raw = Object.fromEntries(formData.entries());
    const parsed = motorcycleSchema.safeParse(raw);
    if (!parsed.success) {
      return { error: "Invalid motorcycle data", issues: parsed.error.flatten() };
    }
    const d = parsed.data;
    const settings = await getGlobalCurrencySettings();
    const basePriceRmb = adminAmountToCanonicalRmb(d.basePriceAmount, d.basePriceCurrency, settings);
    const priceGhs = getCarDisplayPrice(basePriceRmb, "GHS", settings);
    const title = buildTitle(d);
    const seo = generateMotorcycleSeo({
      year: d.year,
      brand: d.brand,
      model: d.model,
      variant: d.variant,
      sourceType: d.sourceType,
    });
    const featureTags = parseTagList(d.featureTags);
    const highlightTags = parseTagList(d.highlightTags);

    const motorcycle = await prisma.motorcycle.create({
      data: {
        slug: slugify(title),
        title,
        brand: d.brand,
        model: d.model,
        year: d.year,
        variant: d.variant,
        motorcycleType: d.motorcycleType,
        engineType: d.engineType,
        transmission: d.transmission,
        driveType: d.driveType,
        mileage: d.mileage,
        color: d.color,
        vin: d.vin,
        frameNumber: d.frameNumber,
        engineNumber: d.engineNumber,
        engineCc: d.engineCc,
        condition: d.condition,
        sourceType: d.sourceType,
        availabilityStatus: AvailabilityStatus.AVAILABLE,
        inspectionStatus: d.inspectionStatus ?? "Good",
        estimatedDelivery: d.estimatedDelivery ?? "35–45 Days",
        accidentHistory: "None",
        reservationDepositPercent: new Prisma.Decimal(d.reservationDepositPercent),
        seaShippingFeeGhs:
          d.seaShippingFeeGhs != null ? new Prisma.Decimal(d.seaShippingFeeGhs) : null,
        basePriceAmount: new Prisma.Decimal(d.basePriceAmount),
        basePriceCurrency: d.basePriceCurrency,
        basePriceRmb: new Prisma.Decimal(basePriceRmb),
        price: new Prisma.Decimal(priceGhs),
        priceGhs: new Prisma.Decimal(priceGhs),
        currency: "GHS",
        listingState: d.listingState,
        featured: d.featured,
        featureTags: featureTags.length ? featureTags : Prisma.JsonNull,
        highlightTags: highlightTags.length ? highlightTags : Prisma.JsonNull,
        shortDescription: d.longDescription.slice(0, 500),
        longDescription: d.longDescription,
        specificationsText: d.specificationsText,
        warranty: d.warranty,
        batteryCapacity: d.batteryCapacity,
        motorPower: d.motorPower,
        electricRange: d.electricRange,
        chargingTime: d.chargingTime,
        topSpeedKmh: d.topSpeedKmh,
        horsepower: d.horsepower,
        torque: d.torque,
        coolingType: d.coolingType,
        fuelTankCapacity: d.fuelTankCapacity,
        weightKg: d.weightKg,
        seatHeight: d.seatHeight,
        wheelSize: d.wheelSize,
        tyreSize: d.tyreSize,
        seoTitle: seo.seoTitle,
        seoDescription: seo.seoDescription,
        coverImageUrl: d.coverImageUrl,
        coverImagePublicId: d.coverImagePublicId,
      },
    });

    await syncSpecsFromText(motorcycle.id, d.specificationsText);

    revalidatePath("/motorcycles");
    revalidatePath("/admin/motorcycles");
    return { ok: true, id: motorcycle.id, slug: motorcycle.slug };
  } catch (e) {
    console.error("[createMotorcycle]", e);
    return { error: e instanceof Error ? e.message : "Could not create motorcycle." };
  }
}

export async function updateMotorcycle(_prev: unknown, formData: FormData) {
  try {
    await requireAdmin();
    const raw = Object.fromEntries(formData.entries());
    const parsed = updateSchema.safeParse(raw);
    if (!parsed.success) {
      return { error: "Invalid motorcycle data", issues: parsed.error.flatten() };
    }
    const d = parsed.data;
    const existing = await prisma.motorcycle.findUnique({ where: { id: d.id } });
    if (!existing) return { error: "Motorcycle not found." };

    const settings = await getGlobalCurrencySettings();
    const basePriceRmb = adminAmountToCanonicalRmb(d.basePriceAmount, d.basePriceCurrency, settings);
    const priceGhs = getCarDisplayPrice(basePriceRmb, "GHS", settings);
    const title = buildTitle(d);
    const seo = generateMotorcycleSeo({
      year: d.year,
      brand: d.brand,
      model: d.model,
      variant: d.variant,
      sourceType: d.sourceType,
    });
    const featureTags = parseTagList(d.featureTags);
    const highlightTags = parseTagList(d.highlightTags);

    const motorcycle = await prisma.motorcycle.update({
      where: { id: d.id },
      data: {
        slug: d.slug ?? existing.slug,
        title,
        brand: d.brand,
        model: d.model,
        year: d.year,
        variant: d.variant,
        motorcycleType: d.motorcycleType,
        engineType: d.engineType,
        transmission: d.transmission,
        driveType: d.driveType,
        mileage: d.mileage,
        color: d.color,
        vin: d.vin,
        frameNumber: d.frameNumber,
        engineNumber: d.engineNumber,
        engineCc: d.engineCc,
        condition: d.condition,
        sourceType: d.sourceType,
        inspectionStatus: d.inspectionStatus ?? existing.inspectionStatus,
        estimatedDelivery: d.estimatedDelivery ?? existing.estimatedDelivery,
        reservationDepositPercent: new Prisma.Decimal(d.reservationDepositPercent),
        seaShippingFeeGhs:
          d.seaShippingFeeGhs != null ? new Prisma.Decimal(d.seaShippingFeeGhs) : null,
        basePriceAmount: new Prisma.Decimal(d.basePriceAmount),
        basePriceCurrency: d.basePriceCurrency,
        basePriceRmb: new Prisma.Decimal(basePriceRmb),
        price: new Prisma.Decimal(priceGhs),
        priceGhs: new Prisma.Decimal(priceGhs),
        listingState: d.listingState,
        featured: d.featured,
        featureTags: featureTags.length ? featureTags : Prisma.JsonNull,
        highlightTags: highlightTags.length ? highlightTags : Prisma.JsonNull,
        shortDescription: d.longDescription.slice(0, 500),
        longDescription: d.longDescription,
        specificationsText: d.specificationsText,
        warranty: d.warranty,
        batteryCapacity: d.batteryCapacity,
        motorPower: d.motorPower,
        electricRange: d.electricRange,
        chargingTime: d.chargingTime,
        topSpeedKmh: d.topSpeedKmh,
        horsepower: d.horsepower,
        torque: d.torque,
        coolingType: d.coolingType,
        fuelTankCapacity: d.fuelTankCapacity,
        weightKg: d.weightKg,
        seatHeight: d.seatHeight,
        wheelSize: d.wheelSize,
        tyreSize: d.tyreSize,
        seoTitle: seo.seoTitle,
        seoDescription: seo.seoDescription,
        coverImageUrl: d.coverImageUrl,
        coverImagePublicId: d.coverImagePublicId,
      },
    });

    await syncSpecsFromText(motorcycle.id, d.specificationsText);

    revalidatePath("/motorcycles");
    revalidatePath(`/motorcycles/${motorcycle.slug}`);
    revalidatePath("/admin/motorcycles");
    revalidatePath(`/admin/motorcycles/${motorcycle.id}/edit`);
    return { ok: true, id: motorcycle.id };
  } catch (e) {
    console.error("[updateMotorcycle]", e);
    return { error: e instanceof Error ? e.message : "Could not update motorcycle." };
  }
}

export async function deleteMotorcycle(id: string) {
  try {
    await requireAdmin();
    const m = await prisma.motorcycle.findUnique({ where: { id }, select: { slug: true } });
    if (!m) return { error: "Not found." };
    await prisma.motorcycle.delete({ where: { id } });
    revalidatePath("/motorcycles");
    revalidatePath("/admin/motorcycles");
    return { ok: true };
  } catch {
    return { error: "Could not delete." };
  }
}

export async function duplicateMotorcycle(id: string) {
  try {
    await requireAdmin();
    const src = await prisma.motorcycle.findUnique({
      where: { id },
      include: { specs: true, images: true },
    });
    if (!src) return { error: "Not found." };

    const title = `${src.title} (Copy)`;
    const copy = await prisma.motorcycle.create({
      data: {
        slug: slugify(title),
        title,
        brand: src.brand,
        model: src.model,
        year: src.year,
        variant: src.variant,
        motorcycleType: src.motorcycleType,
        engineType: src.engineType,
        transmission: src.transmission,
        driveType: src.driveType,
        mileage: src.mileage,
        color: src.color,
        engineCc: src.engineCc,
        condition: src.condition,
        sourceType: src.sourceType,
        availabilityStatus: AvailabilityStatus.AVAILABLE,
        inspectionStatus: src.inspectionStatus,
        estimatedDelivery: src.estimatedDelivery,
        accidentHistory: src.accidentHistory,
        reservationDepositPercent: src.reservationDepositPercent,
        seaShippingFeeGhs: src.seaShippingFeeGhs,
        basePriceAmount: src.basePriceAmount,
        basePriceCurrency: src.basePriceCurrency,
        basePriceRmb: src.basePriceRmb,
        price: src.price,
        priceGhs: src.priceGhs,
        priceUsd: src.priceUsd,
        priceCny: src.priceCny,
        currency: src.currency,
        listingState: CarListingState.DRAFT,
        featured: false,
        featureTags: src.featureTags ?? Prisma.JsonNull,
        highlightTags: src.highlightTags ?? Prisma.JsonNull,
        shortDescription: src.shortDescription,
        longDescription: src.longDescription,
        specificationsText: src.specificationsText,
        seoTitle: src.seoTitle,
        seoDescription: src.seoDescription,
        coverImageUrl: src.coverImageUrl,
        coverImagePublicId: src.coverImagePublicId,
      },
    });

    if (src.specs.length > 0) {
      await prisma.motorcycleSpecification.createMany({
        data: src.specs.map((s) => ({
          motorcycleId: copy.id,
          label: s.label,
          value: s.value,
          sortOrder: s.sortOrder,
        })),
      });
    }

    revalidatePath("/admin/motorcycles");
    return { ok: true, id: copy.id };
  } catch {
    return { error: "Could not duplicate." };
  }
}
