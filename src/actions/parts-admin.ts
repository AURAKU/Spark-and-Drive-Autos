"use server";

import { DeliveryFeeCurrency, DeliveryMode, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth-helpers";
import { getGlobalCurrencySettings } from "@/lib/currency";
import { storedFeesFromAdminInput } from "@/lib/delivery-template-fees";
import { ensureChinaPreOrderDeliveryOptions } from "@/lib/part-china-preorder-delivery";
import { prisma } from "@/lib/prisma";

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

const categorySchema = z.object({
  name: z.string().min(2).max(120),
});

export type PartsAdminFormState = { ok?: boolean; error?: string } | null;

export async function createPartCategoryAction(
  _prev: PartsAdminFormState,
  formData: FormData,
): Promise<PartsAdminFormState> {
  try {
    await requireAdmin();
    const parsed = categorySchema.safeParse({ name: formData.get("name") });
    if (!parsed.success) {
      return { error: "Category name must be between 2 and 120 characters." };
    }
    const name = parsed.data.name.trim();
    const slug = slugify(name);
    await prisma.partCategory.create({
      data: {
        name,
        slug,
      },
    });
    revalidatePath("/admin/parts/categories");
    revalidatePath("/admin/parts");
    revalidatePath("/parts");
    revalidatePath("/admin");
    return { ok: true };
  } catch (e) {
    const code = e && typeof e === "object" && "code" in e ? String((e as { code: string }).code) : "";
    if (code === "P2002") {
      return { error: "A category with this name or slug already exists." };
    }
    return { error: e instanceof Error ? e.message : "Could not create category." };
  }
}

const categoryIdSchema = z.object({
  id: z.string().cuid(),
});

/** Remove category if unused; otherwise deactivate so existing parts keep categoryId. */
export async function deletePartCategoryAction(
  _prev: PartsAdminFormState,
  formData: FormData,
): Promise<PartsAdminFormState> {
  try {
    await requireAdmin();
    const parsed = categoryIdSchema.safeParse({ id: formData.get("id") });
    if (!parsed.success) {
      return { error: "Invalid category." };
    }
    const linked = await prisma.part.count({ where: { categoryId: parsed.data.id } });
    if (linked > 0) {
      await prisma.partCategory.update({
        where: { id: parsed.data.id },
        data: { active: false },
      });
    } else {
      await prisma.partCategory.delete({ where: { id: parsed.data.id } });
    }
    revalidatePath("/admin/parts");
    revalidatePath("/parts");
    revalidatePath("/admin");
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not remove category." };
  }
}

export async function setPartCategoryActiveAction(
  _prev: PartsAdminFormState,
  formData: FormData,
): Promise<PartsAdminFormState> {
  try {
    await requireAdmin();
    const parsed = categoryIdSchema.safeParse({ id: formData.get("id") });
    if (!parsed.success) {
      return { error: "Invalid category." };
    }
    const active = formData.get("active") === "true";
    await prisma.partCategory.update({
      where: { id: parsed.data.id },
      data: { active },
    });
    revalidatePath("/admin/parts");
    revalidatePath("/admin/parts/categories");
    revalidatePath("/parts");
    revalidatePath("/admin");
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not update category." };
  }
}

const optionalNonNeg = z.preprocess(
  (v) => (v === "" || v === undefined || v === null ? undefined : v),
  z.coerce.number().nonnegative().optional(),
);

const templateSchema = z.object({
  mode: z.nativeEnum(DeliveryMode),
  name: z.string().min(2).max(120),
  etaLabel: z.string().min(2).max(120),
  feeAmount: z.coerce.number().nonnegative(),
  feeCurrency: z.nativeEnum(DeliveryFeeCurrency),
  weightKg: optionalNonNeg,
  volumeCbm: optionalNonNeg,
});

export async function upsertDeliveryTemplateAction(
  _prev: PartsAdminFormState,
  formData: FormData,
): Promise<PartsAdminFormState> {
  try {
    await requireAdmin();
    const parsed = templateSchema.safeParse({
      mode: formData.get("mode"),
      name: formData.get("name"),
      etaLabel: formData.get("etaLabel"),
      feeAmount: formData.get("feeAmount"),
      feeCurrency: formData.get("feeCurrency"),
      weightKg: formData.get("weightKg"),
      volumeCbm: formData.get("volumeCbm"),
    });
    if (!parsed.success) {
      return {
        error:
          "Check all fields: delivery type and estimated duration need at least 2 characters; fee must be a number ≥ 0.",
      };
    }
    const d = parsed.data;
    const settings = await getGlobalCurrencySettings();
    const { feeGhs, feeRmb } = storedFeesFromAdminInput(d.feeAmount, d.feeCurrency, settings);
    await prisma.deliveryOptionTemplate.upsert({
      where: { mode: d.mode },
      create: {
        mode: d.mode,
        name: d.name,
        etaLabel: d.etaLabel,
        feeGhs: new Prisma.Decimal(feeGhs),
        feeRmb: new Prisma.Decimal(feeRmb),
        feeCurrency: d.feeCurrency,
        weightKg: d.weightKg != null ? new Prisma.Decimal(d.weightKg) : null,
        volumeCbm: d.volumeCbm != null ? new Prisma.Decimal(d.volumeCbm) : null,
      },
      update: {
        name: d.name,
        etaLabel: d.etaLabel,
        feeGhs: new Prisma.Decimal(feeGhs),
        feeRmb: new Prisma.Decimal(feeRmb),
        feeCurrency: d.feeCurrency,
        weightKg: d.weightKg != null ? new Prisma.Decimal(d.weightKg) : null,
        volumeCbm: d.volumeCbm != null ? new Prisma.Decimal(d.volumeCbm) : null,
      },
    });
    revalidatePath("/admin/parts/delivery-options");
    revalidatePath("/admin/parts");
    revalidatePath("/parts");
    revalidatePath("/admin");
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not save delivery template." };
  }
}

const partIdOnlySchema = z.object({
  partId: z.string().cuid(),
});

/**
 * Links sea + both air delivery templates to a China pre-order (listed) part so customers can pay intl later.
 */
/** `action={...}` on a plain `<form>`; wraps {@link applyChinaPreOrderIntlOptionsAction}. */
export async function applyChinaPreOrderIntlFormAction(formData: FormData) {
  await applyChinaPreOrderIntlOptionsAction(null, formData);
}

export async function applyChinaPreOrderIntlOptionsAction(
  _prev: PartsAdminFormState,
  formData: FormData,
): Promise<PartsAdminFormState> {
  try {
    await requireAdmin();
    const parsed = partIdOnlySchema.safeParse({ partId: formData.get("partId") });
    if (!parsed.success) {
      return { error: "Invalid part." };
    }
    const part = await prisma.part.findUnique({
      where: { id: parsed.data.partId },
      select: { id: true, title: true, origin: true, stockStatus: true },
    });
    if (!part || part.origin !== "CHINA" || part.stockStatus !== "ON_REQUEST") {
      return { error: "Only China + pre-order (on request) parts can get international options from templates." };
    }
    await ensureChinaPreOrderDeliveryOptions(part.id);
    revalidatePath("/admin/parts");
    revalidatePath("/parts");
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not apply options." };
  }
}
