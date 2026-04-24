"use server";

import { Prisma } from "@prisma/client";
import { AvailabilityStatus, CarListingState, EngineType, SourceType } from "@prisma/client";
import { nanoid } from "nanoid";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth-helpers";
import { detectLikelyCarDuplicates } from "@/lib/duplicate-detection";
import { auditLog } from "@/lib/leads";
import { getCarDisplayPrice, getGlobalCurrencySettings } from "@/lib/currency";
import { prisma } from "@/lib/prisma";
import { carHasSuccessfulFullVehiclePayment } from "@/lib/sold-vehicle";

function slugify(title: string) {
  const base = title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
  return `${base}-${nanoid(6).toLowerCase()}`;
}

function parseTagsFromForm(raw: unknown): Prisma.InputJsonValue | undefined {
  if (typeof raw !== "string" || !raw.trim()) return undefined;
  const arr = raw.split(",").map((s) => s.trim()).filter(Boolean);
  return arr.length ? arr : undefined;
}

function parseSpecificationsFromForm(raw: unknown): Prisma.InputJsonValue | undefined | "INVALID" {
  if (typeof raw !== "string" || !raw.trim()) return undefined;
  try {
    const v = JSON.parse(raw) as unknown;
    if (v === null) return "INVALID";
    if (typeof v !== "object") return "INVALID";
    return v as Prisma.InputJsonValue;
  } catch {
    return "INVALID";
  }
}

const optionalStr = (max: number) =>
  z.preprocess((v) => (v === "" || v === undefined ? undefined : v), z.string().max(max).optional());

const carSchema = z.object({
  title: z.string().min(3).max(200),
  brand: z.string().min(1).max(80),
  model: z.string().min(1).max(80),
  year: z.coerce.number().int().min(1980).max(2035),
  trim: optionalStr(120),
  bodyType: optionalStr(80),
  engineType: z.nativeEnum(EngineType),
  transmission: optionalStr(80),
  drivetrain: optionalStr(80),
  mileage: z.preprocess((v) => {
    if (v === "" || v === undefined) return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  }, z.number().int().nonnegative().optional()),
  colorExterior: optionalStr(80),
  colorInterior: optionalStr(80),
  vin: optionalStr(32),
  condition: optionalStr(120),
  engineDetails: optionalStr(8000),
  inspectionStatus: optionalStr(120),
  estimatedDelivery: optionalStr(120),
  seaShippingFeeGhs: z.preprocess((v) => {
    if (v === "" || v === undefined) return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  }, z.number().nonnegative().optional()),
  accidentHistory: optionalStr(8000),
  sourceType: z.nativeEnum(SourceType),
  availabilityStatus: z.nativeEnum(AvailabilityStatus),
  basePriceRmb: z.coerce.number().nonnegative(),
  supplierCostRmb: z.preprocess((v) => {
    if (v === "" || v === undefined) return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  }, z.number().nonnegative().optional()),
  listingState: z.nativeEnum(CarListingState),
  location: optionalStr(120),
  shortDescription: optionalStr(500),
  longDescription: optionalStr(20000),
  featured: z.preprocess((v) => v === "on" || v === "true", z.boolean()).optional().default(false),
  coverImageUrl: z.preprocess(
    (v) => (v === "" ? undefined : v),
    z.union([z.string().url(), z.undefined()]).optional()
  ),
  coverImagePublicId: optionalStr(200),
});

const updateSlugSchema = z.preprocess(
  (v) => (v === "" || v === undefined ? undefined : v),
  z
    .string()
    .min(3)
    .max(200)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug: lowercase letters, numbers, hyphens only")
    .optional()
);

const updateSchema = carSchema.extend({
  id: z.string().cuid(),
  slug: updateSlugSchema,
});

export async function createCar(_prev: unknown, formData: FormData) {
  try {
    const session = await requireAdmin();
    const raw = Object.fromEntries(formData.entries());
    const parsed = carSchema.safeParse(raw);
    if (!parsed.success) {
      return { error: "Invalid vehicle data", issues: parsed.error.flatten() };
    }
    const tags = parseTagsFromForm(raw.tags);
    const spec = parseSpecificationsFromForm(raw.specifications);
    if (spec === "INVALID") {
      return { error: "Specifications must be valid JSON (object or array)" };
    }

    const d = parsed.data;
    const settings = await getGlobalCurrencySettings();
    const priceGhs = getCarDisplayPrice(d.basePriceRmb, "GHS", settings);
    const duplicates = await detectLikelyCarDuplicates(prisma, {
      title: d.title,
      brand: d.brand,
      model: d.model,
      year: d.year,
      vin: d.vin ?? undefined,
      basePriceRmb: d.basePriceRmb,
    });

    const car = await prisma.car.create({
      data: {
        slug: slugify(d.title),
        title: d.title,
        brand: d.brand,
        model: d.model,
        year: d.year,
        trim: d.trim,
        bodyType: d.bodyType,
        engineType: d.engineType,
        transmission: d.transmission,
        drivetrain: d.drivetrain,
        mileage: d.mileage,
        colorExterior: d.colorExterior,
        colorInterior: d.colorInterior,
        vin: d.vin,
        condition: d.condition,
        engineDetails: d.engineDetails,
        inspectionStatus: d.inspectionStatus,
        estimatedDelivery: d.estimatedDelivery,
        seaShippingFeeGhs:
          d.seaShippingFeeGhs != null && Number.isFinite(d.seaShippingFeeGhs)
            ? new Prisma.Decimal(d.seaShippingFeeGhs)
            : null,
        accidentHistory: d.accidentHistory,
        tags: tags === undefined ? Prisma.JsonNull : tags,
        specifications: spec === undefined ? Prisma.JsonNull : spec,
        sourceType: d.sourceType,
        availabilityStatus: d.availabilityStatus,
        basePriceRmb: d.basePriceRmb,
        supplierCostRmb:
          d.supplierCostRmb != null && Number.isFinite(d.supplierCostRmb)
            ? new Prisma.Decimal(d.supplierCostRmb)
            : null,
        price: priceGhs,
        currency: "GHS",
        location: d.location,
        shortDescription: d.shortDescription,
        longDescription: d.longDescription,
        listingState: d.listingState,
        featured: d.featured ?? false,
        coverImageUrl: d.coverImageUrl,
        coverImagePublicId: d.coverImagePublicId,
      },
    });
    await auditLog(session.user.id, "car.create", "Car", car.id, { slug: car.slug });
    if (duplicates.length > 0) {
      const summary =
        duplicates.length === 1
          ? `Match: ${duplicates[0].title} (${Math.round(duplicates[0].score * 100)}% confidence)`
          : `${duplicates.length} likely matches: ${duplicates
              .slice(0, 4)
              .map((d) => `${d.title} (${Math.round(d.score * 100)}%)`)
              .join(" · ")}${duplicates.length > 4 ? " …" : ""}`;
      await prisma.duplicateCheckEvent.create({
        data: {
          entityType: "CAR",
          entityId: car.id,
          score: duplicates[0].score,
          candidateId: duplicates[0].id,
          candidateScore: duplicates[0].score,
          summary,
        },
      });
    }
    revalidatePath("/inventory");
    revalidatePath("/admin/cars");
    revalidatePath("/admin");
    revalidatePath("/admin/duplicates");
    return {
      ok: true,
      id: car.id,
      warning:
        duplicates.length > 0 ? `Possible duplicate detected (${duplicates.length}). Review in Admin > Duplicates.` : undefined,
    };
  } catch (e) {
    if (e instanceof Error && (e.message === "UNAUTHORIZED" || e.message === "FORBIDDEN")) {
      return { error: "Not allowed" };
    }
    console.error("[createCar]", e);
    return { error: "Could not create listing" };
  }
}

export async function updateCar(_prev: unknown, formData: FormData) {
  try {
    const session = await requireAdmin();
    const raw = Object.fromEntries(formData.entries());
    const parsed = updateSchema.safeParse(raw);
    if (!parsed.success) {
      return { error: "Invalid vehicle data", issues: parsed.error.flatten() };
    }
    const tags = parseTagsFromForm(raw.tags);
    const spec = parseSpecificationsFromForm(raw.specifications);
    if (spec === "INVALID") {
      return { error: "Specifications must be valid JSON (object or array)" };
    }

    const d = parsed.data;
    const existing = await prisma.car.findUnique({ where: { id: d.id } });
    if (!existing) return { error: "Vehicle not found" };

    const inventoryOverride =
      raw.inventoryOverride === "on" || raw.inventoryOverride === "true" || raw.inventoryOverride === "1";
    const hadFullVehiclePayment = await carHasSuccessfulFullVehiclePayment(existing.id);
    const wantsNotSoldInventory =
      d.listingState !== CarListingState.SOLD || d.availabilityStatus !== AvailabilityStatus.SOLD;
    if (hadFullVehiclePayment && wantsNotSoldInventory && !inventoryOverride) {
      return {
        error:
          "This vehicle has a successful full payment on record. It must stay sold in inventory unless you confirm an administrative override below.",
      };
    }
    const loggedInventoryOverride = Boolean(hadFullVehiclePayment && wantsNotSoldInventory && inventoryOverride);

    let nextSlug = existing.slug;
    if (d.slug && d.slug !== existing.slug) {
      const taken = await prisma.car.findUnique({ where: { slug: d.slug } });
      if (taken && taken.id !== existing.id) {
        return { error: "That URL slug is already in use" };
      }
      nextSlug = d.slug;
    }

    const settings = await getGlobalCurrencySettings();
    const priceGhs = getCarDisplayPrice(d.basePriceRmb, "GHS", settings);
    const duplicates = await detectLikelyCarDuplicates(prisma, {
      title: d.title,
      brand: d.brand,
      model: d.model,
      year: d.year,
      vin: d.vin ?? undefined,
      basePriceRmb: d.basePriceRmb,
      excludeId: existing.id,
    });

    const car = await prisma.car.update({
      where: { id: d.id },
      data: {
        slug: nextSlug,
        title: d.title,
        brand: d.brand,
        model: d.model,
        year: d.year,
        trim: d.trim,
        bodyType: d.bodyType,
        engineType: d.engineType,
        transmission: d.transmission,
        drivetrain: d.drivetrain,
        mileage: d.mileage,
        colorExterior: d.colorExterior,
        colorInterior: d.colorInterior,
        vin: d.vin,
        condition: d.condition,
        engineDetails: d.engineDetails,
        inspectionStatus: d.inspectionStatus,
        estimatedDelivery: d.estimatedDelivery,
        seaShippingFeeGhs:
          d.seaShippingFeeGhs != null && Number.isFinite(d.seaShippingFeeGhs)
            ? new Prisma.Decimal(d.seaShippingFeeGhs)
            : null,
        accidentHistory: d.accidentHistory,
        tags: tags === undefined ? Prisma.JsonNull : tags,
        specifications: spec === undefined ? Prisma.JsonNull : spec,
        sourceType: d.sourceType,
        availabilityStatus: d.availabilityStatus,
        basePriceRmb: d.basePriceRmb,
        supplierCostRmb:
          d.supplierCostRmb != null && Number.isFinite(d.supplierCostRmb)
            ? new Prisma.Decimal(d.supplierCostRmb)
            : null,
        price: priceGhs,
        currency: "GHS",
        location: d.location,
        shortDescription: d.shortDescription,
        longDescription: d.longDescription,
        listingState: d.listingState,
        featured: d.featured ?? false,
        coverImageUrl: d.coverImageUrl,
        coverImagePublicId: d.coverImagePublicId,
      },
    });
    await auditLog(session.user.id, "car.update", "Car", car.id, {
      slug: car.slug,
      ...(loggedInventoryOverride ? { inventoryOverride: true } : {}),
    });
    if (duplicates.length > 0) {
      const summary =
        duplicates.length === 1
          ? `Match: ${duplicates[0].title} (${Math.round(duplicates[0].score * 100)}% confidence)`
          : `${duplicates.length} likely matches: ${duplicates
              .slice(0, 4)
              .map((d) => `${d.title} (${Math.round(d.score * 100)}%)`)
              .join(" · ")}${duplicates.length > 4 ? " …" : ""}`;
      await prisma.duplicateCheckEvent.create({
        data: {
          entityType: "CAR",
          entityId: car.id,
          score: duplicates[0].score,
          candidateId: duplicates[0].id,
          candidateScore: duplicates[0].score,
          summary,
        },
      });
    }
    revalidatePath("/inventory");
    revalidatePath("/admin/cars");
    revalidatePath("/admin");
    revalidatePath("/admin/duplicates");
    revalidatePath(`/cars/${car.slug}`);
    if (existing.slug !== car.slug) {
      revalidatePath(`/cars/${existing.slug}`);
    }
    revalidatePath(`/admin/cars/${car.id}/edit`);
    return {
      ok: true,
      id: car.id,
      warning:
        duplicates.length > 0 ? `Possible duplicate detected (${duplicates.length}). Review in Admin > Duplicates.` : undefined,
    };
  } catch (e) {
    if (e instanceof Error && (e.message === "UNAUTHORIZED" || e.message === "FORBIDDEN")) {
      return { error: "Not allowed" };
    }
    console.error("[updateCar]", e);
    return { error: "Could not update listing" };
  }
}

export async function deleteCar(carId: string) {
  try {
    const session = await requireAdmin();
    const car = await prisma.car.findUnique({ where: { id: carId } });
    if (!car) return { error: "Not found" };
    const slug = car.slug;
    await prisma.car.delete({ where: { id: carId } });
    await auditLog(session.user.id, "car.delete", "Car", carId, { slug });
    revalidatePath("/inventory");
    revalidatePath("/admin/cars");
    revalidatePath("/admin");
    revalidatePath("/admin/duplicates");
    revalidatePath(`/cars/${slug}`);
    return { ok: true };
  } catch (e) {
    if (e instanceof Error && (e.message === "UNAUTHORIZED" || e.message === "FORBIDDEN")) {
      return { error: "Not allowed" };
    }
    return { error: "Could not delete" };
  }
}
