"use server";

import { PartListingState, ReviewStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { writeAuditLog } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

export type AdminReviewState = { ok?: true; error?: string };

async function revalidateReviewPaths(partId: string | null) {
  revalidatePath("/admin/reviews");
  revalidatePath("/dashboard/profile");
  if (!partId) return;
  const part = await prisma.part.findUnique({ where: { id: partId }, select: { slug: true } });
  if (part) revalidatePath(`/parts/${part.slug}`);
}

async function loadReviewWithPart(reviewId: string) {
  return prisma.review.findUnique({
    where: { id: reviewId },
    include: { part: { select: { id: true, slug: true } } },
  });
}

export async function adminApproveReviewAction(_prev: AdminReviewState | null, formData: FormData): Promise<AdminReviewState> {
  try {
    const session = await requireAdmin();
    const id = z.string().cuid().safeParse(formData.get("reviewId"));
    if (!id.success) return { error: "Invalid review." };

    const before = await loadReviewWithPart(id.data);
    if (!before) return { error: "Review not found." };

    await prisma.review.update({
      where: { id: id.data },
      data: { status: ReviewStatus.APPROVED },
    });

    await writeAuditLog({
      actorId: session.user.id,
      action: "review.approve",
      entityType: "Review",
      entityId: id.data,
      metadataJson: { partId: before.partId },
    });

    await revalidateReviewPaths(before.partId);
    return { ok: true };
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") return { error: "Admin only." };
    console.error("[adminApproveReviewAction]", e);
    return { error: "Could not approve review." };
  }
}

export async function adminRejectReviewAction(_prev: AdminReviewState | null, formData: FormData): Promise<AdminReviewState> {
  try {
    const session = await requireAdmin();
    const id = z.string().cuid().safeParse(formData.get("reviewId"));
    if (!id.success) return { error: "Invalid review." };

    const before = await loadReviewWithPart(id.data);
    if (!before) return { error: "Review not found." };

    await prisma.review.update({
      where: { id: id.data },
      data: { status: ReviewStatus.REJECTED },
    });

    await writeAuditLog({
      actorId: session.user.id,
      action: "review.reject",
      entityType: "Review",
      entityId: id.data,
      metadataJson: { partId: before.partId },
    });

    await revalidateReviewPaths(before.partId);
    return { ok: true };
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") return { error: "Admin only." };
    console.error("[adminRejectReviewAction]", e);
    return { error: "Could not reject review." };
  }
}

export async function adminDeleteReviewAction(_prev: AdminReviewState | null, formData: FormData): Promise<AdminReviewState> {
  try {
    const session = await requireAdmin();
    const id = z.string().cuid().safeParse(formData.get("reviewId"));
    if (!id.success) return { error: "Invalid review." };

    const before = await loadReviewWithPart(id.data);
    if (!before) return { error: "Review not found." };

    await prisma.review.delete({ where: { id: id.data } });

    await writeAuditLog({
      actorId: session.user.id,
      action: "review.delete",
      entityType: "Review",
      entityId: id.data,
      metadataJson: { partId: before.partId },
    });

    await revalidateReviewPaths(before.partId);
    return { ok: true };
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") return { error: "Admin only." };
    console.error("[adminDeleteReviewAction]", e);
    return { error: "Could not delete review." };
  }
}

const adminBodySchema = z.string().trim().min(3).max(4000);
const adminEmailSchema = z.string().trim().toLowerCase().email();

/** Creates or replaces an approved catalog review attributed to the chosen user (storefront shows no staff marker). */
export async function adminUpsertPartReviewAsUserAction(
  _prev: AdminReviewState | null,
  formData: FormData,
): Promise<AdminReviewState> {
  try {
    const session = await requireAdmin();
    const partId = z.string().cuid().safeParse(formData.get("partId"));
    const userEmail = adminEmailSchema.safeParse(formData.get("userEmail"));
    const rating = z.coerce.number().int().min(1).max(5).safeParse(formData.get("rating"));
    const body = adminBodySchema.safeParse(formData.get("body"));
    if (!partId.success) return { error: "Pick a product." };
    if (!userEmail.success) return { error: "Enter a valid user email." };
    if (!rating.success) return { error: "Rating must be 1–5." };
    if (!body.success) return { error: body.error.issues.map((i) => i.message).join(" ") };

    const part = await prisma.part.findFirst({
      where: { id: partId.data, listingState: PartListingState.PUBLISHED },
      select: { id: true, slug: true },
    });
    if (!part) return { error: "Product not found or not published." };

    const user = await prisma.user.findUnique({
      where: { email: userEmail.data },
      select: { id: true },
    });
    if (!user) return { error: "No account with that email." };

    await prisma.review.upsert({
      where: {
        userId_partId: { userId: user.id, partId: part.id },
      },
      create: {
        userId: user.id,
        partId: part.id,
        rating: rating.data,
        body: body.data,
        status: ReviewStatus.APPROVED,
        verifiedPurchase: false,
      },
      update: {
        rating: rating.data,
        body: body.data,
        status: ReviewStatus.APPROVED,
        verifiedPurchase: false,
      },
    });

    await writeAuditLog({
      actorId: session.user.id,
      action: "review.admin_upsert_as_user",
      entityType: "Part",
      entityId: part.id,
      metadataJson: { attributedUserId: user.id },
    });

    await revalidateReviewPaths(part.id);
    return { ok: true };
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") return { error: "Admin only." };
    console.error("[adminUpsertPartReviewAsUserAction]", e);
    return { error: "Could not save review." };
  }
}

export async function adminReassignPartReviewUserAction(
  _prev: AdminReviewState | null,
  formData: FormData,
): Promise<AdminReviewState> {
  try {
    const session = await requireAdmin();
    const reviewId = z.string().cuid().safeParse(formData.get("reviewId"));
    const userEmail = adminEmailSchema.safeParse(formData.get("userEmail"));
    if (!reviewId.success) return { error: "Invalid review." };
    if (!userEmail.success) return { error: "Enter a valid user email." };

    const review = await prisma.review.findUnique({
      where: { id: reviewId.data },
      include: { part: { select: { id: true, slug: true } } },
    });
    if (!review?.partId) return { error: "Only product reviews can be reassigned." };
    if (!review.userId) return { error: "This review has no author to replace — use delete or publish-as-user instead." };

    const user = await prisma.user.findUnique({
      where: { email: userEmail.data },
      select: { id: true },
    });
    if (!user) return { error: "No account with that email." };

    if (user.id === review.userId) {
      return { error: "That account already owns this review." };
    }

    const clash = await prisma.review.findFirst({
      where: { userId: user.id, partId: review.partId, NOT: { id: review.id } },
      select: { id: true },
    });
    if (clash) {
      return { error: "That user already has a different review for this product. Delete or merge it first." };
    }

    await prisma.review.update({
      where: { id: review.id },
      data: { userId: user.id },
    });

    await writeAuditLog({
      actorId: session.user.id,
      action: "review.reassign_user",
      entityType: "Review",
      entityId: review.id,
      metadataJson: { partId: review.partId, newUserId: user.id },
    });

    await revalidateReviewPaths(review.partId);
    return { ok: true };
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") return { error: "Admin only." };
    console.error("[adminReassignPartReviewUserAction]", e);
    return { error: "Could not reassign review." };
  }
}
