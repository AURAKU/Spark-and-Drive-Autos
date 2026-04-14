"use server";

import { DeliveryMode, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth-helpers";
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

const templateSchema = z.object({
  mode: z.nativeEnum(DeliveryMode),
  name: z.string().min(2).max(120),
  etaLabel: z.string().min(2).max(120),
  feeGhs: z.coerce.number().nonnegative(),
  feeRmb: z.coerce.number().nonnegative(),
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
      feeGhs: formData.get("feeGhs"),
      feeRmb: formData.get("feeRmb"),
    });
    if (!parsed.success) {
      return { error: "Check all fields: names and ETA labels need at least 2 characters; fees must be numbers ≥ 0." };
    }
    const d = parsed.data;
    await prisma.deliveryOptionTemplate.upsert({
      where: { mode: d.mode },
      create: {
        mode: d.mode,
        name: d.name,
        etaLabel: d.etaLabel,
        feeGhs: new Prisma.Decimal(d.feeGhs),
        feeRmb: new Prisma.Decimal(d.feeRmb),
      },
      update: {
        name: d.name,
        etaLabel: d.etaLabel,
        feeGhs: new Prisma.Decimal(d.feeGhs),
        feeRmb: new Prisma.Decimal(d.feeRmb),
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
