"use server";

import { Prisma } from "@prisma/client";
import { AvailabilityStatus, CarListingState } from "@prisma/client";
import { nanoid } from "nanoid";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth-helpers";
import { adminAmountToCanonicalRmb, getCarDisplayPrice, getGlobalCurrencySettings } from "@/lib/currency";
import { auditLog } from "@/lib/leads";
import { generateMotorcycleSeo } from "@/lib/motorcycle-seo";
import { resolveMotorcycleSpecRows, specsToPlainText } from "@/lib/motorcycle-specs";
import {
  deleteMotorcycleSafe,
  motorcycleCreateSchema,
  motorcycleUpdateSchema,
  restoreMotorcycleSoftDeleted,
} from "@/lib/motorcycles";
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

const listingStateSchema = z.object({
  id: z.string().cuid(),
  listingState: z.nativeEnum(CarListingState),
});

function buildTitle(d: { year: number; brand: string; model: string; variant?: string | null }) {
  return [d.year, d.brand, d.model, d.variant].filter(Boolean).join(" ");
}

async function syncSpecs(
  motorcycleId: string,
  specsInput: { specificationsJson?: string; specificationsText?: string },
) {
  const rows = resolveMotorcycleSpecRows(specsInput);
  await prisma.motorcycleSpecification.deleteMany({ where: { motorcycleId } });
  if (rows.length === 0) return;
  await prisma.motorcycleSpecification.createMany({
    data: rows.map((r, i) => ({
      motorcycleId,
      groupName: r.groupName?.trim() || null,
      label: r.label.trim(),
      value: r.value.trim(),
      unit: r.unit?.trim() || null,
      sortOrder: r.sortOrder ?? i,
      isPublic: r.isPublic !== false,
    })),
  });
}

function enrichedFields(d: z.infer<typeof motorcycleCreateSchema>) {
  return {
    cylinders: d.cylinders,
    gears: d.gears,
    clutchType: d.clutchType,
    absEquipped: d.absEquipped,
    tractionControl: d.tractionControl,
    lengthMm: d.lengthMm,
    widthMm: d.widthMm,
    heightMm: d.heightMm,
    wheelbaseMm: d.wheelbaseMm,
    groundClearanceMm: d.groundClearanceMm,
    frontTyre: d.frontTyre,
    rearTyre: d.rearTyre,
    frontBrake: d.frontBrake,
    rearBrake: d.rearBrake,
    frontSuspension: d.frontSuspension,
    rearSuspension: d.rearSuspension,
    manufactureDate: d.manufactureDate,
    previousOwners: d.previousOwners,
    registrationStatus: d.registrationStatus,
    knownIssues: d.knownIssues,
    serviceHistory: d.serviceHistory,
    sellingPoints: d.sellingPoints,
    adminNotes: d.adminNotes,
  };
}

export async function createMotorcycle(_prev: unknown, formData: FormData) {
  try {
    const session = await requireAdmin();
    const raw = Object.fromEntries(formData.entries());
    const parsed = motorcycleCreateSchema.safeParse(raw);
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
    const specRows = resolveMotorcycleSpecRows({
      specificationsJson: d.specificationsJson,
      specificationsText: d.specificationsText,
    });
    const specificationsText = d.specificationsText?.trim() || specsToPlainText(specRows) || undefined;

    let supplierCostRmb: number | undefined;
    if (d.supplierCostAmount != null && d.supplierCostCurrency) {
      supplierCostRmb = adminAmountToCanonicalRmb(d.supplierCostAmount, d.supplierCostCurrency, settings);
    }

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
        location: d.location,
        vin: d.vin,
        frameNumber: d.frameNumber,
        engineNumber: d.engineNumber,
        engineCc: d.engineCc,
        condition: d.condition,
        sourceType: d.sourceType,
        availabilityStatus: d.availabilityStatus ?? AvailabilityStatus.AVAILABLE,
        inspectionStatus: d.inspectionStatus ?? "Good",
        estimatedDelivery: d.estimatedDelivery ?? "35–45 Days",
        accidentHistory: "None",
        reservationDepositPercent: new Prisma.Decimal(d.reservationDepositPercent),
        seaShippingFeeGhs:
          d.seaShippingFeeGhs != null ? new Prisma.Decimal(d.seaShippingFeeGhs) : null,
        basePriceAmount: new Prisma.Decimal(d.basePriceAmount),
        basePriceCurrency: d.basePriceCurrency,
        basePriceRmb: new Prisma.Decimal(basePriceRmb),
        supplierCostAmount:
          d.supplierCostAmount != null ? new Prisma.Decimal(d.supplierCostAmount) : null,
        supplierCostCurrency: d.supplierCostCurrency,
        supplierCostRmb: supplierCostRmb != null ? new Prisma.Decimal(supplierCostRmb) : null,
        supplierDealerName: d.supplierDealerName,
        supplierDealerPhone: d.supplierDealerPhone,
        supplierDealerReference: d.supplierDealerReference,
        supplierDealerNotes: d.supplierDealerNotes,
        price: new Prisma.Decimal(priceGhs),
        priceGhs: new Prisma.Decimal(priceGhs),
        currency: "GHS",
        listingState: d.listingState,
        featured: d.featured,
        featureTags: featureTags.length ? featureTags : Prisma.JsonNull,
        highlightTags: highlightTags.length ? highlightTags : Prisma.JsonNull,
        shortDescription: d.shortDescription ?? d.longDescription.slice(0, 500),
        longDescription: d.longDescription,
        specificationsText,
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
        ...enrichedFields(d),
        seoTitle: d.seoTitle ?? seo.seoTitle,
        seoDescription: d.seoDescription ?? seo.seoDescription,
        coverImageUrl: d.coverImageUrl,
        coverImagePublicId: d.coverImagePublicId,
        version: 1,
      },
    });

    await syncSpecs(motorcycle.id, {
      specificationsJson: d.specificationsJson,
      specificationsText,
    });

    if (d.coverImageUrl) {
      await prisma.motorcycleImage.create({
        data: {
          motorcycleId: motorcycle.id,
          url: d.coverImageUrl,
          publicId: d.coverImagePublicId,
          sortOrder: 0,
          isCover: true,
        },
      });
    }

    await auditLog(session.user.id, "motorcycle.create", "Motorcycle", motorcycle.id, {
      slug: motorcycle.slug,
    });

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
    const session = await requireAdmin();
    const raw = Object.fromEntries(formData.entries());
    const parsed = motorcycleUpdateSchema.safeParse(raw);
    if (!parsed.success) {
      return { error: "Invalid motorcycle data", issues: parsed.error.flatten() };
    }
    const d = parsed.data;
    const existing = await prisma.motorcycle.findUnique({ where: { id: d.id } });
    if (!existing) return { error: "Motorcycle not found." };
    if (existing.deletedAt) return { error: "This motorcycle is deleted. Restore it before editing." };

    if (d.expectedVersion != null && d.expectedVersion !== existing.version) {
      return {
        error:
          "This motorcycle was updated by another admin since you opened it. Refresh the page and try again to avoid overwriting their changes.",
        conflict: true,
        currentVersion: existing.version,
      };
    }

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
    const specRows = resolveMotorcycleSpecRows({
      specificationsJson: d.specificationsJson,
      specificationsText: d.specificationsText,
    });
    const specificationsText = d.specificationsText?.trim() || specsToPlainText(specRows) || null;

    let supplierCostRmb: number | null | undefined;
    if (d.supplierCostAmount != null && d.supplierCostCurrency) {
      supplierCostRmb = adminAmountToCanonicalRmb(d.supplierCostAmount, d.supplierCostCurrency, settings);
    } else if (d.supplierCostAmount == null) {
      supplierCostRmb = null;
    }

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
        location: d.location,
        vin: d.vin,
        frameNumber: d.frameNumber,
        engineNumber: d.engineNumber,
        engineCc: d.engineCc,
        condition: d.condition,
        sourceType: d.sourceType,
        availabilityStatus: d.availabilityStatus ?? existing.availabilityStatus,
        inspectionStatus: d.inspectionStatus ?? existing.inspectionStatus,
        estimatedDelivery: d.estimatedDelivery ?? existing.estimatedDelivery,
        reservationDepositPercent: new Prisma.Decimal(d.reservationDepositPercent),
        seaShippingFeeGhs:
          d.seaShippingFeeGhs != null ? new Prisma.Decimal(d.seaShippingFeeGhs) : null,
        basePriceAmount: new Prisma.Decimal(d.basePriceAmount),
        basePriceCurrency: d.basePriceCurrency,
        basePriceRmb: new Prisma.Decimal(basePriceRmb),
        supplierCostAmount:
          d.supplierCostAmount != null ? new Prisma.Decimal(d.supplierCostAmount) : null,
        supplierCostCurrency: d.supplierCostCurrency ?? null,
        supplierCostRmb: supplierCostRmb != null ? new Prisma.Decimal(supplierCostRmb) : null,
        supplierDealerName: d.supplierDealerName,
        supplierDealerPhone: d.supplierDealerPhone,
        supplierDealerReference: d.supplierDealerReference,
        supplierDealerNotes: d.supplierDealerNotes,
        price: new Prisma.Decimal(priceGhs),
        priceGhs: new Prisma.Decimal(priceGhs),
        listingState: d.listingState,
        featured: d.featured,
        featureTags: featureTags.length ? featureTags : Prisma.JsonNull,
        highlightTags: highlightTags.length ? highlightTags : Prisma.JsonNull,
        shortDescription: d.shortDescription ?? d.longDescription.slice(0, 500),
        longDescription: d.longDescription,
        specificationsText,
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
        ...enrichedFields(d),
        seoTitle: d.seoTitle ?? seo.seoTitle,
        seoDescription: d.seoDescription ?? seo.seoDescription,
        coverImageUrl: d.coverImageUrl ?? existing.coverImageUrl,
        coverImagePublicId: d.coverImagePublicId ?? existing.coverImagePublicId,
        version: { increment: 1 },
      },
    });

    await syncSpecs(motorcycle.id, {
      specificationsJson: d.specificationsJson,
      specificationsText: specificationsText ?? undefined,
    });

    await auditLog(session.user.id, "motorcycle.update", "Motorcycle", motorcycle.id, {
      slug: motorcycle.slug,
      version: motorcycle.version,
    });

    revalidatePath("/motorcycles");
    revalidatePath(`/motorcycles/${motorcycle.slug}`);
    revalidatePath("/admin/motorcycles");
    revalidatePath(`/admin/motorcycles/${motorcycle.id}`);
    revalidatePath(`/admin/motorcycles/${motorcycle.id}/edit`);
    return { ok: true, id: motorcycle.id, version: motorcycle.version };
  } catch (e) {
    console.error("[updateMotorcycle]", e);
    return { error: e instanceof Error ? e.message : "Could not update motorcycle." };
  }
}

export async function setMotorcycleListingState(id: string, listingState: CarListingState) {
  try {
    const session = await requireAdmin();
    const parsed = listingStateSchema.safeParse({ id, listingState });
    if (!parsed.success) return { error: "Invalid listing state." };
    const m = await prisma.motorcycle.findUnique({
      where: { id: parsed.data.id },
      select: { slug: true, deletedAt: true },
    });
    if (!m) return { error: "Not found." };
    if (m.deletedAt) return { error: "Restore the motorcycle before changing listing state." };
    await prisma.motorcycle.update({
      where: { id: parsed.data.id },
      data: {
        listingState: parsed.data.listingState,
        archivedAt: parsed.data.listingState === CarListingState.HIDDEN ? new Date() : null,
        version: { increment: 1 },
      },
    });
    await auditLog(session.user.id, "motorcycle.listingState", "Motorcycle", parsed.data.id, {
      listingState: parsed.data.listingState,
      slug: m.slug,
    });
    revalidatePath("/motorcycles");
    revalidatePath(`/motorcycles/${m.slug}`);
    revalidatePath("/admin/motorcycles");
    revalidatePath(`/admin/motorcycles/${parsed.data.id}`);
    revalidatePath(`/admin/motorcycles/${parsed.data.id}/edit`);
    return { ok: true };
  } catch {
    return { error: "Could not update listing state." };
  }
}

export async function archiveMotorcycle(id: string) {
  return setMotorcycleListingState(id, CarListingState.HIDDEN);
}

export async function publishMotorcycle(id: string) {
  return setMotorcycleListingState(id, CarListingState.PUBLISHED);
}

export async function unpublishMotorcycle(id: string) {
  return setMotorcycleListingState(id, CarListingState.DRAFT);
}

export async function deleteMotorcycle(id: string) {
  try {
    const session = await requireAdmin();
    const result = await deleteMotorcycleSafe({ id, actorId: session.user.id });
    if ("error" in result) return { error: result.error };
    revalidatePath("/motorcycles");
    revalidatePath("/admin/motorcycles");
    return { ok: true, mode: result.mode };
  } catch {
    return { error: "Could not delete." };
  }
}

export async function restoreMotorcycle(id: string) {
  try {
    const session = await requireAdmin();
    const result = await restoreMotorcycleSoftDeleted({ id, actorId: session.user.id });
    if ("error" in result) return { error: result.error };
    revalidatePath("/admin/motorcycles");
    revalidatePath(`/admin/motorcycles/${id}`);
    revalidatePath(`/admin/motorcycles/${id}/edit`);
    return { ok: true };
  } catch {
    return { error: "Could not restore." };
  }
}

export async function duplicateMotorcycle(id: string) {
  try {
    const session = await requireAdmin();
    const src = await prisma.motorcycle.findUnique({
      where: { id },
      include: {
        specs: true,
        images: { orderBy: { sortOrder: "asc" } },
        videos: { orderBy: { sortOrder: "asc" } },
      },
    });
    if (!src) return { error: "Not found." };
    if (src.deletedAt) return { error: "Cannot duplicate a deleted motorcycle." };

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
        location: src.location,
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
        supplierCostAmount: src.supplierCostAmount,
        supplierCostCurrency: src.supplierCostCurrency,
        supplierCostRmb: src.supplierCostRmb,
        supplierDealerName: src.supplierDealerName,
        supplierDealerPhone: src.supplierDealerPhone,
        supplierDealerReference: src.supplierDealerReference,
        supplierDealerNotes: src.supplierDealerNotes,
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
        warranty: src.warranty,
        batteryCapacity: src.batteryCapacity,
        motorPower: src.motorPower,
        electricRange: src.electricRange,
        chargingTime: src.chargingTime,
        topSpeedKmh: src.topSpeedKmh,
        horsepower: src.horsepower,
        torque: src.torque,
        coolingType: src.coolingType,
        fuelTankCapacity: src.fuelTankCapacity,
        weightKg: src.weightKg,
        seatHeight: src.seatHeight,
        wheelSize: src.wheelSize,
        tyreSize: src.tyreSize,
        cylinders: src.cylinders,
        gears: src.gears,
        clutchType: src.clutchType,
        absEquipped: src.absEquipped,
        tractionControl: src.tractionControl,
        lengthMm: src.lengthMm,
        widthMm: src.widthMm,
        heightMm: src.heightMm,
        wheelbaseMm: src.wheelbaseMm,
        groundClearanceMm: src.groundClearanceMm,
        frontTyre: src.frontTyre,
        rearTyre: src.rearTyre,
        frontBrake: src.frontBrake,
        rearBrake: src.rearBrake,
        frontSuspension: src.frontSuspension,
        rearSuspension: src.rearSuspension,
        manufactureDate: src.manufactureDate,
        previousOwners: src.previousOwners,
        registrationStatus: src.registrationStatus,
        knownIssues: src.knownIssues,
        serviceHistory: src.serviceHistory,
        sellingPoints: src.sellingPoints,
        adminNotes: src.adminNotes,
        seoTitle: src.seoTitle,
        seoDescription: src.seoDescription,
        coverImageUrl: src.coverImageUrl,
        coverImagePublicId: src.coverImagePublicId,
        version: 1,
      },
    });

    if (src.specs.length > 0) {
      await prisma.motorcycleSpecification.createMany({
        data: src.specs.map((s) => ({
          motorcycleId: copy.id,
          groupName: s.groupName,
          label: s.label,
          value: s.value,
          unit: s.unit,
          sortOrder: s.sortOrder,
          isPublic: s.isPublic,
        })),
      });
    }
    if (src.images.length > 0) {
      await prisma.motorcycleImage.createMany({
        data: src.images.map((img) => ({
          motorcycleId: copy.id,
          url: img.url,
          publicId: img.publicId,
          sortOrder: img.sortOrder,
          altText: img.altText,
          caption: img.caption,
          width: img.width,
          height: img.height,
          isCover: img.isCover,
        })),
      });
    }
    if (src.videos.length > 0) {
      await prisma.motorcycleVideo.createMany({
        data: src.videos.map((v) => ({
          motorcycleId: copy.id,
          url: v.url,
          publicId: v.publicId,
          sortOrder: v.sortOrder,
          durationSec: v.durationSec,
          thumbnailUrl: v.thumbnailUrl,
          mimeType: v.mimeType,
          caption: v.caption,
          width: v.width,
          height: v.height,
          fileSizeBytes: v.fileSizeBytes,
          isFeatured: v.isFeatured,
        })),
      });
    }

    await auditLog(session.user.id, "motorcycle.duplicate", "Motorcycle", copy.id, {
      fromId: id,
      slug: copy.slug,
    });

    revalidatePath("/admin/motorcycles");
    return { ok: true, id: copy.id };
  } catch {
    return { error: "Could not duplicate." };
  }
}
