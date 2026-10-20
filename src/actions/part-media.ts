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
});

function revalidatePartPaths(partId: string, slug: string) {
  revalidatePath(`/admin/parts/${partId}/edit`);
  revalidatePath(`/parts/${slug}`);
  revalidatePath("/parts");
  revalidatePath("/admin/parts");
}

export async function addPartImage(partId: string, input: z.infer<typeof urlIn>) {
  try {
    await requireAdmin();
  } catch {
    return { error: "Not allowed" };
  }
  const parsed = urlIn.safeParse(input);
  if (!parsed.success) return { error: "Invalid image data" };
  const part = await prisma.part.findUnique({ where: { id: partId } });
  if (!part) return { error: "Part not found" };

  const max = await prisma.partImage.aggregate({
    where: { partId },
    _max: { sortOrder: true },
  });
  const sortOrder = (max._max.sortOrder ?? -1) + 1;
  const makeCover = sortOrder === 0 && !part.coverImageUrl;

  await prisma.partImage.create({
    data: {
      partId,
      url: parsed.data.url,
      publicId: parsed.data.publicId ?? undefined,
      sortOrder,
      isCover: makeCover,
    },
  });

  if (makeCover) {
    await prisma.part.update({
      where: { id: partId },
      data: {
        coverImageUrl: parsed.data.url,
        coverImagePublicId: parsed.data.publicId ?? undefined,
      },
    });
  }

  revalidatePartPaths(partId, part.slug);
  return { ok: true };
}

export async function addPartVideo(
  partId: string,
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
  const part = await prisma.part.findUnique({ where: { id: partId } });
  if (!part) return { error: "Part not found" };

  const max = await prisma.partVideo.aggregate({
    where: { partId },
    _max: { sortOrder: true },
  });
  const sortOrder = (max._max.sortOrder ?? -1) + 1;
  const derivedThumb = cloudinaryVideoFramePosterUrl(parsed.data.url);
  const thumbnailUrl = parsed.data.thumbnailUrl?.trim() || derivedThumb || undefined;
  const existingFeatured = await prisma.partVideo.count({
    where: { partId, isFeatured: true },
  });

  await prisma.partVideo.create({
    data: {
      partId,
      url: parsed.data.url,
      publicId: parsed.data.publicId ?? undefined,
      thumbnailUrl,
      mimeType: parsed.data.mimeType?.trim() || undefined,
      sortOrder,
      isFeatured: existingFeatured === 0,
    },
  });
  revalidatePartPaths(partId, part.slug);
  return { ok: true };
}

export async function deletePartImage(imageId: string) {
  try {
    await requireAdmin();
  } catch {
    return { error: "Not allowed" };
  }
  const img = await prisma.partImage.findUnique({
    where: { id: imageId },
    include: { part: true },
  });
  if (!img) return { error: "Not found" };

  await prisma.partImage.delete({ where: { id: imageId } });
  void destroyCloudinaryAsset(img.publicId);

  if (img.part.coverImageUrl === img.url || img.isCover) {
    const next = await prisma.partImage.findFirst({
      where: { partId: img.partId },
      orderBy: { sortOrder: "asc" },
    });
    if (next) {
      await prisma.$transaction([
        prisma.partImage.updateMany({ where: { partId: img.partId }, data: { isCover: false } }),
        prisma.partImage.update({ where: { id: next.id }, data: { isCover: true } }),
        prisma.part.update({
          where: { id: img.partId },
          data: {
            coverImageUrl: next.url,
            coverImagePublicId: next.publicId ?? null,
          },
        }),
      ]);
    } else {
      await prisma.part.update({
        where: { id: img.partId },
        data: { coverImageUrl: null, coverImagePublicId: null },
      });
    }
  }

  revalidatePartPaths(img.partId, img.part.slug);
  return { ok: true };
}

export async function deletePartVideo(videoId: string) {
  try {
    await requireAdmin();
  } catch {
    return { error: "Not allowed" };
  }
  const vid = await prisma.partVideo.findUnique({
    where: { id: videoId },
    include: { part: { select: { id: true, slug: true } } },
  });
  if (!vid) return { error: "Not found" };
  await prisma.partVideo.delete({ where: { id: videoId } });
  void destroyCloudinaryVideoAsset(vid.publicId);

  if (vid.isFeatured) {
    const next = await prisma.partVideo.findFirst({
      where: { partId: vid.partId },
      orderBy: { sortOrder: "asc" },
    });
    if (next) {
      await prisma.partVideo.update({ where: { id: next.id }, data: { isFeatured: true } });
    }
  }

  revalidatePartPaths(vid.part.id, vid.part.slug);
  return { ok: true };
}

export async function reorderPartImages(partId: string, orderedIds: string[]) {
  try {
    await requireAdmin();
  } catch {
    return { error: "Not allowed" };
  }
  const part = await prisma.part.findUnique({ where: { id: partId } });
  if (!part) return { error: "Part not found" };
  const images = await prisma.partImage.findMany({ where: { partId }, select: { id: true } });
  if (orderedIds.length !== images.length) return { error: "Invalid order" };
  const set = new Set(images.map((i) => i.id));
  for (const id of orderedIds) {
    if (!set.has(id)) return { error: "Invalid order" };
  }
  await prisma.$transaction(
    orderedIds.map((id, sortOrder) => prisma.partImage.update({ where: { id }, data: { sortOrder } })),
  );
  revalidatePartPaths(partId, part.slug);
  return { ok: true };
}

export async function reorderPartVideos(partId: string, orderedIds: string[]) {
  try {
    await requireAdmin();
  } catch {
    return { error: "Not allowed" };
  }
  const part = await prisma.part.findUnique({ where: { id: partId } });
  if (!part) return { error: "Part not found" };
  const rows = await prisma.partVideo.findMany({ where: { partId }, select: { id: true } });
  if (orderedIds.length !== rows.length) return { error: "Invalid order" };
  const set = new Set(rows.map((i) => i.id));
  for (const id of orderedIds) {
    if (!set.has(id)) return { error: "Invalid order" };
  }
  await prisma.$transaction(
    orderedIds.map((id, sortOrder) => prisma.partVideo.update({ where: { id }, data: { sortOrder } })),
  );
  revalidatePartPaths(partId, part.slug);
  return { ok: true };
}

export async function setPartCoverFromImage(partId: string, imageId: string) {
  try {
    await requireAdmin();
  } catch {
    return { error: "Not allowed" };
  }
  const img = await prisma.partImage.findFirst({
    where: { id: imageId, partId },
    include: { part: true },
  });
  if (!img) return { error: "Not found" };

  await prisma.$transaction([
    prisma.partImage.updateMany({ where: { partId }, data: { isCover: false } }),
    prisma.partImage.update({ where: { id: imageId }, data: { isCover: true } }),
    prisma.part.update({
      where: { id: partId },
      data: {
        coverImageUrl: img.url,
        coverImagePublicId: img.publicId ?? undefined,
      },
    }),
  ]);
  revalidatePartPaths(partId, img.part.slug);
  return { ok: true };
}

export async function setFeaturedPartVideo(partId: string, videoId: string) {
  try {
    await requireAdmin();
  } catch {
    return { error: "Not allowed" };
  }
  const row = await prisma.partVideo.findFirst({
    where: { id: videoId, partId },
    include: { part: true },
  });
  if (!row) return { error: "Not found" };

  await prisma.$transaction([
    prisma.partVideo.updateMany({ where: { partId }, data: { isFeatured: false } }),
    prisma.partVideo.update({ where: { id: videoId }, data: { isFeatured: true } }),
  ]);
  revalidatePartPaths(partId, row.part.slug);
  return { ok: true };
}
