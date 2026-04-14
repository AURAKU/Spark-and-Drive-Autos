"use server";

import { DuplicateDecision } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

const decisionSchema = z.object({
  eventId: z.string().cuid(),
  decision: z.nativeEnum(DuplicateDecision),
});

export type DuplicateAdminState = { ok?: boolean; error?: string } | null;

export async function setDuplicateEventDecision(
  _prev: DuplicateAdminState,
  formData: FormData,
): Promise<DuplicateAdminState> {
  try {
    const session = await requireAdmin();
    const parsed = decisionSchema.safeParse({
      eventId: formData.get("eventId"),
      decision: formData.get("decision"),
    });
    if (!parsed.success) {
      return { error: "Invalid request" };
    }
    const { eventId, decision } = parsed.data;
    const existing = await prisma.duplicateCheckEvent.findUnique({ where: { id: eventId } });
    if (!existing) return { error: "Event not found" };
    if (existing.decision !== "PENDING") {
      return { error: "This warning was already resolved" };
    }
    if (decision === DuplicateDecision.PENDING) {
      return { error: "Choose a resolution" };
    }
    await prisma.duplicateCheckEvent.update({
      where: { id: eventId },
      data: {
        decision,
        reviewedById: session.user.id,
      },
    });
    revalidatePath("/admin/duplicates");
    return { ok: true };
  } catch (e) {
    if (e instanceof Error && (e.message === "UNAUTHORIZED" || e.message === "FORBIDDEN")) {
      return { error: "Not allowed" };
    }
    console.error("[setDuplicateEventDecision]", e);
    return { error: "Could not update" };
  }
}
