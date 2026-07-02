"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth-helpers";
import { cloudinaryVideoFramePosterUrl } from "@/lib/cloudinary-video-poster";
import { prisma } from "@/lib/prisma";

const urlIn = z.object({
  url: z.string().url(),
  publicId: z.string().min(1).max(500).optional().nullable(),
});

function revalidateMotorcyclePaths(motorcycleId: string, slug: string) {
  revalidatePath(`/admin/motorcycles/${motorcycleId}/edit`);
  revalidatePath(`/motorcycles/${slug}`);
  revalidatePath("/motorcycles");
  revalidatePath("/admin/motorcycles");
}

export async function addMotorcycleImage(motorcycleId: string, input: z.infer<typeof urlIn>) {
  try {
    await requireAdmin();
  } catch {
    return { error: "Not allowed" };
  }
  const parsed = urlIn.safeParse(input);
  if (!parsed.success) return { error: "Invalid image data" };
  const m = await prisma.motorcycle.findUnique({ where: { id: motorcycleId } });
  if (!m) return { error: "Motorcycle not found" };

  const max = await prisma.motorcycleImage.aggregate({
    where: { motorcycleId },
    _max: { sortOrder: true },
  });
  const sortOrder = (max._max.sortOrder ?? -1) + 1;

  await prisma.motorcycleImage.create({
    data: {
      motorcycleId,
      url: parsed.data.url,
      publicId: parsed.data.publicId ?? undefined,
      sortOrder,
      isCover: sortOrder === 0 && !m.coverImageUrl,
    },
  });

  if (!m.coverImageUrl) {
    await prisma.motorcycle.update({
      where: { id: motorcycleId },
      data: { coverImageUrl: parsed.data.url, coverImagePublicId: parsed.data.publicId ?? undefined },
    });
  }

  revalidateMotorcyclePaths(motorcycleId, m.slug);
  return { ok: true };
}

export async function addMotorcycleVideo(
  motorcycleId: string,
  input: z.infer<typeof urlIn> & { thumbnailUrl?: string | null; mimeType?: string | null },
) {
  try {
    await requireAdmin();
  } catch {
    return { error: "Not allowed" };
  }
  const parsed = urlIn
    .extend({
      thumbnailUrl: z.string().url().optional().nullable(),
      mimeType: z.string().max(120).optional().nullable(),
    })
    .safeParse(input);
  if (!parsed.success) return { error: "Invalid video data" };
  const m = await prisma.motorcycle.findUnique({ where: { id: motorcycleId } });
  if (!m) return { error: "Motorcycle not found" };

  const max = await prisma.motorcycleVideo.aggregate({
    where: { motorcycleId },
    _max: { sortOrder: true },
  });
  const sortOrder = (max._max.sortOrder ?? -1) + 1;
  const derivedThumb = cloudinaryVideoFramePosterUrl(parsed.data.url);
  const thumbnailUrl = parsed.data.thumbnailUrl?.trim() || derivedThumb || undefined;

  await prisma.motorcycleVideo.create({
    data: {
      motorcycleId,
      url: parsed.data.url,
      publicId: parsed.data.publicId ?? undefined,
      thumbnailUrl,
      mimeType: parsed.data.mimeType?.trim() || undefined,
      sortOrder,
    },
  });
  revalidateMotorcyclePaths(motorcycleId, m.slug);
  return { ok: true };
}

export async function deleteMotorcycleImage(imageId: string) {
  try {
    await requireAdmin();
  } catch {
    return { error: "Not allowed" };
  }
  const img = await prisma.motorcycleImage.findUnique({
    where: { id: imageId },
    include: { motorcycle: { select: { id: true, slug: true } } },
  });
  if (!img) return { error: "Not found" };
  await prisma.motorcycleImage.delete({ where: { id: imageId } });
  revalidateMotorcyclePaths(img.motorcycle.id, img.motorcycle.slug);
  return { ok: true };
}

export async function deleteMotorcycleVideo(videoId: string) {
  try {
    await requireAdmin();
  } catch {
    return { error: "Not allowed" };
  }
  const vid = await prisma.motorcycleVideo.findUnique({
    where: { id: videoId },
    include: { motorcycle: { select: { id: true, slug: true } } },
  });
  if (!vid) return { error: "Not found" };
  await prisma.motorcycleVideo.delete({ where: { id: videoId } });
  revalidateMotorcyclePaths(vid.motorcycle.id, vid.motorcycle.slug);
  return { ok: true };
}
