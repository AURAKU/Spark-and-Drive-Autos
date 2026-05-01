"use server";

import { PartListingState, PartOrigin, PartStockStatus, Prisma } from "@prisma/client";
import { nanoid } from "nanoid";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth-helpers";
import { linesToList, mergePartMetaWithOptions } from "@/lib/part-variant-options";
import { detectLikelyPartDuplicates } from "@/lib/duplicate-detection";
import { adminAmountToCanonicalRmb, getGlobalCurrencySettings, parseDisplayCurrency } from "@/lib/currency";
import { resolvePartListPriceFromAdminInput } from "@/lib/parts-pricing";
import { auditLog } from "@/lib/leads";
import { ensureChinaPreOrderDeliveryOptions } from "@/lib/part-china-preorder-delivery";
import { maybeNotifyAdminsGhanaLowStock } from "@/lib/ghana-low-stock";
import { derivePartStockFromQty } from "@/lib/part-stock";
import { prisma } from "@/lib/prisma";

function slugify(title: string) {
  const base = title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
  return `${base}-${nanoid(6).toLowerCase()}`;
}

function parseTagsJson(raw: unknown): Prisma.InputJsonValue {
  if (typeof raw !== "string" || !raw.trim()) return [];
  const arr = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return arr;
}

const optionalStr = (max: number) =>
  z.preprocess((v) => (v === "" || v === undefined ? undefined : v), z.string().max(max).optional());

const partBaseSchema = z.object({
  title: z.string().min(2).max(200),
  shortDescription: optionalStr(500),
  description: optionalStr(20000),
  category: z.string().max(120).optional(),
  categoryId: z.preprocess((v) => (v === "" || v == null ? undefined : v), z.string().cuid().optional()),
  origin: z.nativeEnum(PartOrigin).default(PartOrigin.GHANA),
  sku: optionalStr(120),
  partNumber: optionalStr(120),
  oemNumber: optionalStr(120),
  compatibleMake: optionalStr(80),
  compatibleModel: optionalStr(80),
  compatibleYearNote: optionalStr(80),
  brand: optionalStr(80),
  condition: optionalStr(120),
  warehouseLocation: optionalStr(200),
  countryOfOrigin: optionalStr(80),
  internalNotes: optionalStr(20000),
  sellingPriceAmount: z.preprocess((v) => {
    if (v === "" || v === undefined) return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  }, z.number().nonnegative()),
  sellingPriceCurrency: z.preprocess(
    (v) => parseDisplayCurrency(v === "" || v == null ? undefined : typeof v === "string" ? v : undefined),
    z.enum(["GHS", "USD", "CNY"]),
  ),
  supplierCostAmount: z.preprocess((v) => {
    if (v === "" || v === undefined) return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  }, z.number().nonnegative().optional()),
  supplierCostCurrency: z.preprocess(
    (v) => parseDisplayCurrency(v === "" || v == null ? undefined : typeof v === "string" ? v : undefined),
    z.enum(["GHS", "USD", "CNY"]),
  ),
  stockQty: z.coerce.number().int().min(0),
  stockStatus: z.nativeEnum(PartStockStatus),
  stockStatusLocked: z.preprocess((v) => v === "on" || v === "true", z.boolean()).optional().default(false),
  listingState: z.nativeEnum(PartListingState),
  tags: optionalStr(2000),
  featured: z.preprocess((v) => v === "on" || v === "true", z.boolean()).optional().default(false),
  coverImageUrl: z.preprocess(
    (v) => (v === "" ? undefined : v),
    z.union([z.string().url(), z.undefined()]).optional()
  ),
  coverImagePublicId: optionalStr(200),
  supplierDistributorRef: optionalStr(5000),
  supplierDistributorPhone: optionalStr(40),
  /** One option per line — shown to customers as choices when non-empty. */
  optionColors: optionalStr(20000),
  optionSizes: optionalStr(20000),
});

const partBaseSchemaWithOriginPricing = partBaseSchema.superRefine((data, ctx) => {
  if (data.sellingPriceAmount === undefined || data.sellingPriceAmount === null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Selling price amount is required",
      path: ["sellingPriceAmount"],
    });
  }
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

const updateSchema = partBaseSchemaWithOriginPricing.extend({
  id: z.string().cuid(),
  slug: updateSlugSchema,
});

export type PartActionState = {
  ok?: boolean;
  id?: string;
  warning?: string;
  error?: string;
  issues?: { fieldErrors: Record<string, string[] | undefined>; formErrors: string[] };
} | null;

function enhancePartPricingIssues(flat: {
  fieldErrors: Record<string, string[] | undefined>;
  formErrors: string[];
}): {
  fieldErrors: Record<string, string[] | undefined>;
  formErrors: string[];
} {
  const next = {
    fieldErrors: { ...flat.fieldErrors },
    formErrors: [...flat.formErrors],
  };
  const missingList = next.fieldErrors.sellingPriceAmount?.some((m: string) => m.includes("required")) ?? false;
  if (missingList) {
    next.formErrors.push("Enter a selling price amount and currency.");
  }
  return next;
}

export async function createPart(_prev: PartActionState, formData: FormData): Promise<PartActionState> {
  try {
    const session = await requireAdmin();
    const raw = Object.fromEntries(formData.entries());
    const parsed = partBaseSchemaWithOriginPricing.safeParse(raw);
    if (!parsed.success) {
      return { issues: enhancePartPricingIssues(parsed.error.flatten()) };
    }
    const d = parsed.data;
    const slug = slugify(d.title);
    const tags = parseTagsJson(d.tags);
    const optionLists = {
      colors: linesToList(d.optionColors),
      sizes: linesToList(d.optionSizes),
      types: [],
    };
    const nextMeta = mergePartMetaWithOptions(null, optionLists) as object;
    const settings = await getGlobalCurrencySettings();
    const { basePriceRmb: basePriceRmbNum, priceGhs: priceGhsNum } = resolvePartListPriceFromAdminInput(
      { sellingPriceAmount: d.sellingPriceAmount, sellingPriceCurrency: d.sellingPriceCurrency },
      settings,
    );
    const fx = {
      usdToRmb: Number(settings.usdToRmb),
      rmbToGhs: Number(settings.rmbToGhs),
      usdToGhs: Number(settings.usdToGhs),
    };
    const supplierCostRmbNum =
      d.supplierCostAmount != null && Number.isFinite(d.supplierCostAmount) && d.supplierCostAmount > 0
        ? adminAmountToCanonicalRmb(d.supplierCostAmount, d.supplierCostCurrency, fx)
        : null;
    const categoryRef =
      d.categoryId != null
        ? await prisma.partCategory.findUnique({ where: { id: d.categoryId }, select: { id: true, name: true } })
        : null;
    const categoryName = (categoryRef?.name ?? d.category ?? "General").trim();

    const stockStatus = d.stockStatusLocked ? d.stockStatus : derivePartStockFromQty(d.stockQty);

    const duplicates = await detectLikelyPartDuplicates(prisma, {
      title: d.title,
      sku: d.sku ?? undefined,
      category: categoryName,
      basePriceRmb: basePriceRmbNum,
    });

    const part = await prisma.part.create({
      data: {
        slug,
        title: d.title,
        shortDescription: d.shortDescription ?? null,
        description: d.description ?? null,
        category: categoryName,
        categoryId: categoryRef?.id ?? null,
        origin: d.origin,
        sku: d.sku ?? null,
        partNumber: d.partNumber?.trim() || null,
        oemNumber: d.oemNumber?.trim() || null,
        compatibleMake: d.compatibleMake?.trim() || null,
        compatibleModel: d.compatibleModel?.trim() || null,
        compatibleYearNote: d.compatibleYearNote?.trim() || null,
        brand: d.brand?.trim() || null,
        condition: d.condition?.trim() || null,
        warehouseLocation: d.warehouseLocation?.trim() || null,
        countryOfOrigin: d.countryOfOrigin?.trim() || null,
        internalNotes: d.internalNotes?.trim() || null,
        sellingPriceCurrency: d.sellingPriceCurrency,
        supplierCostCurrency: d.supplierCostCurrency,
        basePriceRmb: new Prisma.Decimal(basePriceRmbNum),
        supplierCostRmb:
          supplierCostRmbNum != null && Number.isFinite(supplierCostRmbNum)
            ? new Prisma.Decimal(supplierCostRmbNum)
            : null,
        priceGhs: new Prisma.Decimal(priceGhsNum),
        stockQty: d.stockQty,
        stockStatus,
        stockStatusLocked: d.stockStatusLocked,
        listingState: d.listingState,
        tags,
        featured: d.featured,
        coverImageUrl: d.coverImageUrl ?? null,
        coverImagePublicId: d.coverImagePublicId ?? null,
        metaJson: nextMeta,
        supplierDistributorRef: d.supplierDistributorRef?.trim() || null,
        supplierDistributorPhone: d.supplierDistributorPhone?.trim() || null,
      },
    });
    await ensureChinaPreOrderDeliveryOptions(part.id);
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
          entityType: "PART",
          entityId: part.id,
          score: duplicates[0].score,
          candidateId: duplicates[0].id,
          candidateScore: duplicates[0].score,
          summary,
        },
      });
    }
    await auditLog(session.user.id, "part.create", "Part", part.id, { slug: part.slug });
    void maybeNotifyAdminsGhanaLowStock({
      id: part.id,
      title: part.title,
      stockQty: part.stockQty,
      origin: part.origin,
      listingState: part.listingState,
      stockStatus: part.stockStatus,
    });
    revalidatePath("/admin/parts");
    revalidatePath("/parts");
    revalidatePath("/admin");
    revalidatePath("/admin/duplicates");
    return {
      ok: true,
      id: part.id,
      warning:
        duplicates.length > 0 ? `Possible duplicate detected (${duplicates.length}). Review in Admin > Duplicates.` : undefined,
    };
  } catch (e) {
    console.error("[createPart]", e);
    return { error: e instanceof Error ? e.message : "Could not create part" };
  }
}

export async function updatePart(_prev: PartActionState, formData: FormData): Promise<PartActionState> {
  try {
    const session = await requireAdmin();
    const raw = Object.fromEntries(formData.entries());
    const parsed = updateSchema.safeParse(raw);
    if (!parsed.success) {
      return { issues: enhancePartPricingIssues(parsed.error.flatten()) };
    }
    const d = parsed.data;
    const existing = await prisma.part.findUnique({ where: { id: d.id } });
    if (!existing) return { error: "Part not found" };

    let nextSlug = existing.slug;
    if (d.slug && d.slug !== existing.slug) {
      const taken = await prisma.part.findUnique({ where: { slug: d.slug } });
      if (taken && taken.id !== existing.id) {
        return { error: "That URL slug is already in use" };
      }
      nextSlug = d.slug;
    }

    const tags = parseTagsJson(d.tags);
    const optionLists = {
      colors: linesToList(d.optionColors),
      sizes: linesToList(d.optionSizes),
      types: [],
    };
    const nextMeta = mergePartMetaWithOptions(existing.metaJson, optionLists) as object;
    const settings = await getGlobalCurrencySettings();
    const { basePriceRmb: basePriceRmbNum, priceGhs: priceGhsNum } = resolvePartListPriceFromAdminInput(
      { sellingPriceAmount: d.sellingPriceAmount, sellingPriceCurrency: d.sellingPriceCurrency },
      settings,
    );
    const fx = {
      usdToRmb: Number(settings.usdToRmb),
      rmbToGhs: Number(settings.rmbToGhs),
      usdToGhs: Number(settings.usdToGhs),
    };
    const supplierCostRmbNum =
      d.supplierCostAmount != null && Number.isFinite(d.supplierCostAmount) && d.supplierCostAmount > 0
        ? adminAmountToCanonicalRmb(d.supplierCostAmount, d.supplierCostCurrency, fx)
        : null;
    const categoryRef =
      d.categoryId != null
        ? await prisma.partCategory.findUnique({ where: { id: d.categoryId }, select: { id: true, name: true } })
        : null;
    const categoryName = (categoryRef?.name ?? d.category ?? existing.category).trim();
    const stockStatus = d.stockStatusLocked ? d.stockStatus : derivePartStockFromQty(d.stockQty);
    const duplicates = await detectLikelyPartDuplicates(prisma, {
      title: d.title,
      sku: d.sku ?? undefined,
      category: categoryName,
      basePriceRmb: basePriceRmbNum,
      excludeId: existing.id,
    });
    const part = await prisma.part.update({
      where: { id: d.id },
      data: {
        slug: nextSlug,
        title: d.title,
        shortDescription: d.shortDescription ?? null,
        description: d.description ?? null,
        category: categoryName,
        categoryId: categoryRef?.id ?? null,
        origin: d.origin,
        sku: d.sku ?? null,
        partNumber: d.partNumber?.trim() || null,
        oemNumber: d.oemNumber?.trim() || null,
        compatibleMake: d.compatibleMake?.trim() || null,
        compatibleModel: d.compatibleModel?.trim() || null,
        compatibleYearNote: d.compatibleYearNote?.trim() || null,
        brand: d.brand?.trim() || null,
        condition: d.condition?.trim() || null,
        warehouseLocation: d.warehouseLocation?.trim() || null,
        countryOfOrigin: d.countryOfOrigin?.trim() || null,
        internalNotes: d.internalNotes?.trim() || null,
        sellingPriceCurrency: d.sellingPriceCurrency,
        supplierCostCurrency: d.supplierCostCurrency,
        basePriceRmb: new Prisma.Decimal(basePriceRmbNum),
        supplierCostRmb:
          supplierCostRmbNum != null && Number.isFinite(supplierCostRmbNum)
            ? new Prisma.Decimal(supplierCostRmbNum)
            : null,
        priceGhs: new Prisma.Decimal(priceGhsNum),
        stockQty: d.stockQty,
        stockStatus,
        stockStatusLocked: d.stockStatusLocked,
        listingState: d.listingState,
        tags,
        featured: d.featured,
        coverImageUrl: d.coverImageUrl ?? null,
        coverImagePublicId: d.coverImagePublicId ?? null,
        metaJson: nextMeta,
        supplierDistributorRef: d.supplierDistributorRef?.trim() || null,
        supplierDistributorPhone: d.supplierDistributorPhone?.trim() || null,
      },
    });
    await ensureChinaPreOrderDeliveryOptions(part.id);
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
          entityType: "PART",
          entityId: part.id,
          score: duplicates[0].score,
          candidateId: duplicates[0].id,
          candidateScore: duplicates[0].score,
          summary,
        },
      });
    }
    await auditLog(session.user.id, "part.update", "Part", part.id, { slug: part.slug });
    void maybeNotifyAdminsGhanaLowStock({
      id: part.id,
      title: part.title,
      stockQty: part.stockQty,
      origin: part.origin,
      listingState: part.listingState,
      stockStatus: part.stockStatus,
    });
    revalidatePath("/admin/parts");
    revalidatePath("/parts");
    revalidatePath("/admin");
    revalidatePath(`/parts/${part.slug}`);
    if (existing.slug !== part.slug) {
      revalidatePath(`/parts/${existing.slug}`);
    }
    revalidatePath("/admin/duplicates");
    return {
      ok: true,
      id: part.id,
      warning:
        duplicates.length > 0 ? `Possible duplicate detected (${duplicates.length}). Review in Admin > Duplicates.` : undefined,
    };
  } catch (e) {
    console.error("[updatePart]", e);
    return { error: e instanceof Error ? e.message : "Could not update part" };
  }
}

export async function deletePart(formData: FormData) {
  const session = await requireAdmin();
  const id = formData.get("id");
  if (typeof id !== "string" || !id) {
    throw new Error("Missing id");
  }
  const existing = await prisma.part.findUnique({ where: { id } });
  if (!existing) {
    throw new Error("Part not found");
  }
  const slug = existing.slug;
  await prisma.part.delete({ where: { id } });
  await auditLog(session.user.id, "part.delete", "Part", id, { slug });
  revalidatePath("/admin/parts");
  revalidatePath("/parts");
  revalidatePath("/admin");
  revalidatePath("/admin/duplicates");
  revalidatePath(`/parts/${slug}`);
  const nextRaw = formData.get("next");
  const next =
    typeof nextRaw === "string" && nextRaw.startsWith("/admin") && !nextRaw.startsWith("//")
      ? nextRaw
      : "/admin/parts";
  redirect(next);
}

const gallerySchema = z.object({
  partId: z.string().cuid(),
  url: z.string().url(),
  publicId: optionalStr(200),
});

export async function addPartGalleryImage(_prev: unknown, formData: FormData) {
  try {
    const session = await requireAdmin();
    const raw = Object.fromEntries(formData.entries());
    const parsed = gallerySchema.safeParse(raw);
    if (!parsed.success) {
      return { error: "Invalid image data" };
    }
    const { partId, url, publicId } = parsed.data;
    const part = await prisma.part.findUnique({ where: { id: partId } });
    if (!part) return { error: "Part not found" };
    const maxOrder = await prisma.partImage.aggregate({
      where: { partId },
      _max: { sortOrder: true },
    });
    const sortOrder = (maxOrder._max.sortOrder ?? -1) + 1;
    await prisma.partImage.create({
      data: { partId, url, publicId: publicId ?? null, sortOrder },
    });
    await auditLog(session.user.id, "part.image.add", "Part", partId, {});
    revalidatePath("/admin/parts");
    revalidatePath(`/parts/${part.slug}`);
    revalidatePath("/parts");
    return { ok: true };
  } catch (e) {
    console.error("[addPartGalleryImage]", e);
    return { error: e instanceof Error ? e.message : "Could not add image" };
  }
}

export async function deletePartGalleryImage(formData: FormData) {
  const session = await requireAdmin();
  const imageId = formData.get("imageId");
  const partId = formData.get("partId");
  if (typeof imageId !== "string" || typeof partId !== "string") {
    return { error: "Missing fields" };
  }
  const part = await prisma.part.findUnique({ where: { id: partId } });
  if (!part) return { error: "Part not found" };
  await prisma.partImage.deleteMany({ where: { id: imageId, partId } });
  await auditLog(session.user.id, "part.image.delete", "Part", partId, { imageId });
  revalidatePath("/admin/parts");
  revalidatePath(`/parts/${part.slug}`);
  revalidatePath("/parts");
  return { ok: true as const };
}
