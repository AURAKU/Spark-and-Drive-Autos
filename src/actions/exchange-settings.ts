"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth-helpers";
import { recomputeAllCarCachedGhsPrices, recomputeAllPartCachedGhsPrices } from "@/lib/car-price-cache";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  usdToRmb: z.coerce.number().positive(),
  rmbToGhs: z.coerce.number().positive(),
  usdToGhs: z.coerce.number().positive(),
});

export async function updateGlobalExchangeRates(_prev: unknown, formData: FormData) {
  let session: Awaited<ReturnType<typeof requireAdmin>>;
  try {
    session = await requireAdmin();
  } catch {
    return { error: "Unauthorized" };
  }

  const parsed = schema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: "Invalid rates", issues: parsed.error.flatten() };
  }

  const { usdToRmb, rmbToGhs, usdToGhs } = parsed.data;

  await prisma.globalCurrencySettings.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      usdToRmb,
      rmbToGhs,
      usdToGhs,
      updatedById: session.user.id,
    },
    update: {
      usdToRmb,
      rmbToGhs,
      usdToGhs,
      updatedById: session.user.id,
    },
  });

  await recomputeAllCarCachedGhsPrices();
  await recomputeAllPartCachedGhsPrices();

  revalidatePath("/admin/settings/currency");
  revalidatePath("/admin/cars");
  revalidatePath("/inventory");
  revalidatePath("/");
  revalidatePath("/dashboard");
  revalidatePath("/checkout");
  revalidatePath("/parts");
  const slugs = await prisma.car.findMany({ select: { slug: true } });
  for (const { slug } of slugs) {
    revalidatePath(`/cars/${slug}`);
  }
  const partSlugs = await prisma.part.findMany({ select: { slug: true } });
  for (const { slug } of partSlugs) {
    revalidatePath(`/parts/${slug}`);
  }
  return { ok: true };
}
