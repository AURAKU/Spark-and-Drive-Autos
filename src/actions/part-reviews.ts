"use server";

import { PartListingState } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireActiveSessionOrRedirect } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

const bodySchema = z.string().trim().min(10, "Write at least 10 characters.").max(4000);
const ratingSchema = z.coerce.number().int().min(1).max(5);

async function verifiedPartPurchase(userId: string, partId: string): Promise<boolean> {
  const n = await prisma.order.count({
    where: {
      userId,
      kind: "PARTS",
      orderStatus: { notIn: ["DRAFT", "PENDING_PAYMENT", "CANCELLED"] },
      partItems: { some: { partId } },
    },
  });
  return n > 0;
}

export type PartReviewActionState = { ok?: true; error?: string };

export async function submitPartReviewAction(
  _prev: PartReviewActionState | null,
  formData: FormData,
): Promise<PartReviewActionState> {
  try {
    const session = await requireActiveSessionOrRedirect("/dashboard/profile");
    const partId = z.string().cuid().safeParse(formData.get("partId"));
    if (!partId.success) return { error: "Invalid product." };

    const rating = ratingSchema.safeParse(formData.get("rating"));
    const body = bodySchema.safeParse(formData.get("body"));
    if (!rating.success) return { error: "Choose a rating from 1 to 5 stars." };
    if (!body.success) return { error: body.error.issues.map((i) => i.message).join(" ") };

    const part = await prisma.part.findFirst({
      where: { id: partId.data, listingState: PartListingState.PUBLISHED },
      select: { id: true, slug: true },
    });
    if (!part) return { error: "This product is not open for reviews." };

    const verified = await verifiedPartPurchase(session.user.id, part.id);
    const fallbackAuthorName = session.user.name?.trim() || null;

    const existing = await prisma.review.findFirst({
      where: { userId: session.user.id, partId: part.id },
    });

    if (existing?.status === "APPROVED") {
      return { error: "You already published a review for this product." };
    }

    if (existing) {
      await prisma.review.update({
        where: { id: existing.id },
        data: {
          rating: rating.data,
          body: body.data,
          status: "APPROVED",
          verifiedPurchase: verified,
          authorName: fallbackAuthorName,
        },
      });
    } else {
      await prisma.review.create({
        data: {
          userId: session.user.id,
          authorName: fallbackAuthorName,
          partId: part.id,
          rating: rating.data,
          body: body.data,
          status: "APPROVED",
          verifiedPurchase: verified,
        },
      });
    }

    revalidatePath(`/parts/${part.slug}`);
    revalidatePath("/dashboard/profile");
    revalidatePath("/admin/reviews");
    return { ok: true };
  } catch (e) {
    console.error("[submitPartReviewAction]", e);
    return { error: "Could not submit your review." };
  }
}
