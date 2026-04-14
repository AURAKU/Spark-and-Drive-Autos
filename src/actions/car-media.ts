"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

const urlIn = z.object({
  url: z.string().url(),
  publicId: z.string().min(1).max(500).optional().nullable(),
});

function revalidateCarPaths(carId: string, slug: string) {
  revalidatePath(`/admin/cars/${carId}/edit`);
  revalidatePath(`/cars/${slug}`);
  revalidatePath("/inventory");
  revalidatePath("/admin/cars");
}

export async function addCarImage(carId: string, input: z.infer<typeof urlIn>) {
  try {
    await requireAdmin();
  } catch {
    return { error: "Not allowed" };
  }
  const parsed = urlIn.safeParse(input);
  if (!parsed.success) return { error: "Invalid image data" };
  const car = await prisma.car.findUnique({ where: { id: carId } });
  if (!car) return { error: "Vehicle not found" };

  const max = await prisma.carImage.aggregate({
    where: { carId },
    _max: { sortOrder: true },
  });
  const sortOrder = (max._max.sortOrder ?? -1) + 1;

  await prisma.carImage.create({
    data: {
      carId,
      url: parsed.data.url,
      publicId: parsed.data.publicId ?? undefined,
      sortOrder,
    },
  });
  revalidateCarPaths(carId, car.slug);
  return { ok: true };
}

export async function addCarVideo(carId: string, input: z.infer<typeof urlIn> & { thumbnailUrl?: string | null }) {
  try {
    await requireAdmin();
  } catch {
    return { error: "Not allowed" };
  }
  const parsed = urlIn
    .extend({
      thumbnailUrl: z.string().url().optional().nullable(),
    })
    .safeParse(input);
  if (!parsed.success) return { error: "Invalid video data" };
  const car = await prisma.car.findUnique({ where: { id: carId } });
  if (!car) return { error: "Vehicle not found" };

  const max = await prisma.carVideo.aggregate({
    where: { carId },
    _max: { sortOrder: true },
  });
  const sortOrder = (max._max.sortOrder ?? -1) + 1;

  await prisma.carVideo.create({
    data: {
      carId,
      url: parsed.data.url,
      publicId: parsed.data.publicId ?? undefined,
      thumbnailUrl: parsed.data.thumbnailUrl ?? undefined,
      sortOrder,
    },
  });
  revalidateCarPaths(carId, car.slug);
  return { ok: true };
}

export async function deleteCarImage(imageId: string) {
  try {
    await requireAdmin();
  } catch {
    return { error: "Not allowed" };
  }
  const img = await prisma.carImage.findUnique({
    where: { id: imageId },
    include: { car: true },
  });
  if (!img) return { error: "Not found" };

  await prisma.carImage.delete({ where: { id: imageId } });

  if (img.car.coverImageUrl === img.url) {
    await prisma.car.update({
      where: { id: img.carId },
      data: { coverImageUrl: null, coverImagePublicId: null },
    });
  }

  revalidateCarPaths(img.carId, img.car.slug);
  return { ok: true };
}

export async function deleteCarVideo(videoId: string) {
  try {
    await requireAdmin();
  } catch {
    return { error: "Not allowed" };
  }
  const row = await prisma.carVideo.findUnique({
    where: { id: videoId },
    include: { car: true },
  });
  if (!row) return { error: "Not found" };
  await prisma.carVideo.delete({ where: { id: videoId } });
  revalidateCarPaths(row.carId, row.car.slug);
  return { ok: true };
}

export async function reorderCarImages(carId: string, orderedIds: string[]) {
  try {
    await requireAdmin();
  } catch {
    return { error: "Not allowed" };
  }
  const car = await prisma.car.findUnique({ where: { id: carId } });
  if (!car) return { error: "Vehicle not found" };
  const images = await prisma.carImage.findMany({ where: { carId }, select: { id: true } });
  if (orderedIds.length !== images.length) return { error: "Invalid order" };
  const set = new Set(images.map((i) => i.id));
  for (const id of orderedIds) {
    if (!set.has(id)) return { error: "Invalid order" };
  }
  await prisma.$transaction(
    orderedIds.map((id, sortOrder) => prisma.carImage.update({ where: { id }, data: { sortOrder } }))
  );
  revalidateCarPaths(carId, car.slug);
  return { ok: true };
}

export async function reorderCarVideos(carId: string, orderedIds: string[]) {
  try {
    await requireAdmin();
  } catch {
    return { error: "Not allowed" };
  }
  const car = await prisma.car.findUnique({ where: { id: carId } });
  if (!car) return { error: "Vehicle not found" };
  const rows = await prisma.carVideo.findMany({ where: { carId }, select: { id: true } });
  if (orderedIds.length !== rows.length) return { error: "Invalid order" };
  const set = new Set(rows.map((i) => i.id));
  for (const id of orderedIds) {
    if (!set.has(id)) return { error: "Invalid order" };
  }
  await prisma.$transaction(
    orderedIds.map((id, sortOrder) => prisma.carVideo.update({ where: { id }, data: { sortOrder } }))
  );
  revalidateCarPaths(carId, car.slug);
  return { ok: true };
}

export async function setCarCoverFromImage(carId: string, imageId: string) {
  try {
    await requireAdmin();
  } catch {
    return { error: "Not allowed" };
  }
  const img = await prisma.carImage.findFirst({
    where: { id: imageId, carId },
    include: { car: true },
  });
  if (!img) return { error: "Not found" };

  await prisma.$transaction([
    prisma.carImage.updateMany({ where: { carId }, data: { isCover: false } }),
    prisma.carImage.update({ where: { id: imageId }, data: { isCover: true } }),
    prisma.car.update({
      where: { id: carId },
      data: {
        coverImageUrl: img.url,
        coverImagePublicId: img.publicId ?? undefined,
      },
    }),
  ]);
  revalidateCarPaths(carId, img.car.slug);
  return { ok: true };
}

/** Single hero walkthrough: marks one video featured (others cleared). */
export async function setFeaturedCarVideo(carId: string, videoId: string) {
  try {
    await requireAdmin();
  } catch {
    return { error: "Not allowed" };
  }
  const row = await prisma.carVideo.findFirst({
    where: { id: videoId, carId },
    include: { car: true },
  });
  if (!row) return { error: "Not found" };

  await prisma.$transaction([
    prisma.carVideo.updateMany({ where: { carId }, data: { isFeatured: false } }),
    prisma.carVideo.update({ where: { id: videoId }, data: { isFeatured: true } }),
  ]);
  revalidateCarPaths(carId, row.car.slug);
  return { ok: true };
}
