"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth-helpers";
import { cloudinaryVideoFramePosterUrl } from "@/lib/cloudinary-video-poster";
import { destroyCloudinaryAsset, destroyCloudinaryVideoAsset } from "@/lib/motorcycles/media-cleanup";
import { prisma } from "@/lib/prisma";

const urlIn = z.object({
  url: z.string().url(),
  publicId: z.string().min(1).max(500).optional().nullable(),
  width: z.number().int().positive().optional().nullable(),
  height: z.number().int().positive().optional().nullable(),
  altText: z.string().max(300).optional().nullable(),
  caption: z.string().max(500).optional().nullable(),
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
  const makeCover = sortOrder === 0 && !m.coverImageUrl;

  await prisma.motorcycleImage.create({
    data: {
      motorcycleId,
      url: parsed.data.url,
      publicId: parsed.data.publicId ?? undefined,
      sortOrder,
      isCover: makeCover,
      width: parsed.data.width ?? undefined,
      height: parsed.data.height ?? undefined,
      altText: parsed.data.altText ?? undefined,
      caption: parsed.data.caption ?? undefined,
    },
  });

  if (makeCover) {
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
  const existingFeatured = await prisma.motorcycleVideo.count({
    where: { motorcycleId, isFeatured: true },
  });

  await prisma.motorcycleVideo.create({
    data: {
      motorcycleId,
      url: parsed.data.url,
      publicId: parsed.data.publicId ?? undefined,
      thumbnailUrl,
      mimeType: parsed.data.mimeType?.trim() || undefined,
      sortOrder,
      isFeatured: existingFeatured === 0,
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
    include: { motorcycle: true },
  });
  if (!img) return { error: "Not found" };

  await prisma.motorcycleImage.delete({ where: { id: imageId } });
  void destroyCloudinaryAsset(img.publicId);

  if (img.motorcycle.coverImageUrl === img.url || img.isCover) {
    const next = await prisma.motorcycleImage.findFirst({
      where: { motorcycleId: img.motorcycleId },
      orderBy: { sortOrder: "asc" },
    });
    if (next) {
      await prisma.$transaction([
        prisma.motorcycleImage.updateMany({
          where: { motorcycleId: img.motorcycleId },
          data: { isCover: false },
        }),
        prisma.motorcycleImage.update({ where: { id: next.id }, data: { isCover: true } }),
        prisma.motorcycle.update({
          where: { id: img.motorcycleId },
          data: {
            coverImageUrl: next.url,
            coverImagePublicId: next.publicId ?? null,
          },
        }),
      ]);
    } else {
      await prisma.motorcycle.update({
        where: { id: img.motorcycleId },
        data: { coverImageUrl: null, coverImagePublicId: null },
      });
    }
  }

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
  void destroyCloudinaryVideoAsset(vid.publicId);

  if (vid.isFeatured) {
    const next = await prisma.motorcycleVideo.findFirst({
      where: { motorcycleId: vid.motorcycleId },
      orderBy: { sortOrder: "asc" },
    });
    if (next) {
      await prisma.motorcycleVideo.update({ where: { id: next.id }, data: { isFeatured: true } });
    }
  }

  revalidateMotorcyclePaths(vid.motorcycle.id, vid.motorcycle.slug);
  return { ok: true };
}

export async function reorderMotorcycleImages(motorcycleId: string, orderedIds: string[]) {
  try {
    await requireAdmin();
  } catch {
    return { error: "Not allowed" };
  }
  const m = await prisma.motorcycle.findUnique({ where: { id: motorcycleId } });
  if (!m) return { error: "Motorcycle not found" };
  const images = await prisma.motorcycleImage.findMany({ where: { motorcycleId }, select: { id: true } });
  if (orderedIds.length !== images.length) return { error: "Invalid order" };
  const set = new Set(images.map((i) => i.id));
  for (const id of orderedIds) {
    if (!set.has(id)) return { error: "Invalid order" };
  }
  await prisma.$transaction(
    orderedIds.map((id, sortOrder) => prisma.motorcycleImage.update({ where: { id }, data: { sortOrder } })),
  );
  revalidateMotorcyclePaths(motorcycleId, m.slug);
  return { ok: true };
}

export async function reorderMotorcycleVideos(motorcycleId: string, orderedIds: string[]) {
  try {
    await requireAdmin();
  } catch {
    return { error: "Not allowed" };
  }
  const m = await prisma.motorcycle.findUnique({ where: { id: motorcycleId } });
  if (!m) return { error: "Motorcycle not found" };
  const rows = await prisma.motorcycleVideo.findMany({ where: { motorcycleId }, select: { id: true } });
  if (orderedIds.length !== rows.length) return { error: "Invalid order" };
  const set = new Set(rows.map((i) => i.id));
  for (const id of orderedIds) {
    if (!set.has(id)) return { error: "Invalid order" };
  }
  await prisma.$transaction(
    orderedIds.map((id, sortOrder) => prisma.motorcycleVideo.update({ where: { id }, data: { sortOrder } })),
  );
  revalidateMotorcyclePaths(motorcycleId, m.slug);
  return { ok: true };
}

export async function setMotorcycleCoverFromImage(motorcycleId: string, imageId: string) {
  try {
    await requireAdmin();
  } catch {
    return { error: "Not allowed" };
  }
  const img = await prisma.motorcycleImage.findFirst({
    where: { id: imageId, motorcycleId },
    include: { motorcycle: true },
  });
  if (!img) return { error: "Not found" };

  await prisma.$transaction([
    prisma.motorcycleImage.updateMany({ where: { motorcycleId }, data: { isCover: false } }),
    prisma.motorcycleImage.update({ where: { id: imageId }, data: { isCover: true } }),
    prisma.motorcycle.update({
      where: { id: motorcycleId },
      data: {
        coverImageUrl: img.url,
        coverImagePublicId: img.publicId ?? undefined,
      },
    }),
  ]);
  revalidateMotorcyclePaths(motorcycleId, img.motorcycle.slug);
  return { ok: true };
}

/** Marks one walkthrough video as featured (others cleared). */
export async function setFeaturedMotorcycleVideo(motorcycleId: string, videoId: string) {
  try {
    await requireAdmin();
  } catch {
    return { error: "Not allowed" };
  }
  const row = await prisma.motorcycleVideo.findFirst({
    where: { id: videoId, motorcycleId },
    include: { motorcycle: true },
  });
  if (!row) return { error: "Not found" };

  await prisma.$transaction([
    prisma.motorcycleVideo.updateMany({ where: { motorcycleId }, data: { isFeatured: false } }),
    prisma.motorcycleVideo.update({ where: { id: videoId }, data: { isFeatured: true } }),
  ]);
  revalidateMotorcyclePaths(motorcycleId, row.motorcycle.slug);
  return { ok: true };
}

export async function updateMotorcycleImageMeta(
  imageId: string,
  input: { altText?: string | null; caption?: string | null },
) {
  try {
    await requireAdmin();
  } catch {
    return { error: "Not allowed" };
  }
  const parsed = z
    .object({
      altText: z.string().max(300).optional().nullable(),
      caption: z.string().max(500).optional().nullable(),
    })
    .safeParse(input);
  if (!parsed.success) return { error: "Invalid metadata" };
  const img = await prisma.motorcycleImage.findUnique({
    where: { id: imageId },
    include: { motorcycle: { select: { id: true, slug: true } } },
  });
  if (!img) return { error: "Not found" };
  await prisma.motorcycleImage.update({
    where: { id: imageId },
    data: {
      altText: parsed.data.altText?.trim() || null,
      caption: parsed.data.caption?.trim() || null,
    },
  });
  revalidateMotorcyclePaths(img.motorcycle.id, img.motorcycle.slug);
  return { ok: true };
}

export async function updateMotorcycleVideoMeta(
  videoId: string,
  input: { caption?: string | null },
) {
  try {
    await requireAdmin();
  } catch {
    return { error: "Not allowed" };
  }
  const parsed = z.object({ caption: z.string().max(500).optional().nullable() }).safeParse(input);
  if (!parsed.success) return { error: "Invalid metadata" };
  const vid = await prisma.motorcycleVideo.findUnique({
    where: { id: videoId },
    include: { motorcycle: { select: { id: true, slug: true } } },
  });
  if (!vid) return { error: "Not found" };
  await prisma.motorcycleVideo.update({
    where: { id: videoId },
    data: { caption: parsed.data.caption?.trim() || null },
  });
  revalidateMotorcyclePaths(vid.motorcycle.id, vid.motorcycle.slug);
  return { ok: true };
}
