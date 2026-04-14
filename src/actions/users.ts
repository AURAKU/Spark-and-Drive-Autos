"use server";

import { hash } from "bcryptjs";
import { nanoid } from "nanoid";
import { UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdmin, requireSuperAdmin } from "@/lib/auth-helpers";
import { applyWalletLedgerEntry } from "@/lib/wallet-ledger";
import { auditLog } from "@/lib/leads";
import { prisma } from "@/lib/prisma";
import { recordSecurityObservation } from "@/lib/security-observation";

function revalidateAdminUsersSurface() {
  revalidatePath("/admin/users", "page");
  revalidatePath("/admin", "layout");
  revalidatePath("/admin/security", "page");
}

const updateRoleSchema = z.object({
  userId: z.string().cuid(),
  role: z.nativeEnum(UserRole),
});

export type UpdateUserRoleState = { ok?: boolean; error?: string } | null;
export type AdminUserActionState = { ok?: boolean; error?: string } | null;

const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2).max(120),
  password: z.string().min(8).max(128),
  role: z.nativeEnum(UserRole).default(UserRole.CUSTOMER),
});

const deleteUserSchema = z.object({
  userId: z.string().cuid(),
});

const adjustWalletSchema = z.object({
  userId: z.string().cuid(),
  direction: z.enum(["CREDIT", "DEBIT"]),
  amount: z.coerce.number().positive().max(1_000_000),
  note: z.string().max(240).optional(),
});

const accountBlockSchema = z.object({
  userId: z.string().cuid(),
  blocked: z.enum(["0", "1"]),
});

export async function updateUserRole(_prev: UpdateUserRoleState, formData: FormData): Promise<UpdateUserRoleState> {
  try {
    const session = await requireAdmin();
    const parsed = updateRoleSchema.safeParse({
      userId: formData.get("userId"),
      role: formData.get("role"),
    });
    if (!parsed.success) {
      return { error: "Invalid submission" };
    }
    const { userId, role } = parsed.data;
    if (userId === session.user.id) {
      return { error: "You cannot change your own role here." };
    }

    const exists = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!exists) return { error: "User not found." };

    await prisma.user.update({
      where: { id: userId },
      data: { role },
    });

    await auditLog(session.user.id, "user.role.update", "User", userId, { role });
    revalidateAdminUsersSurface();
    return { ok: true };
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") {
      return { error: "Admin access required" };
    }
    console.error("[updateUserRole]", e);
    return { error: e instanceof Error ? e.message : "Could not update role" };
  }
}

export async function setUserAccountBlocked(
  _prev: AdminUserActionState,
  formData: FormData,
): Promise<AdminUserActionState> {
  try {
    const session = await requireAdmin();
    const parsed = accountBlockSchema.safeParse({
      userId: formData.get("userId"),
      blocked: formData.get("blocked"),
    });
    if (!parsed.success) return { error: "Invalid submission." };
    const blocked = parsed.data.blocked === "1";
    const { userId } = parsed.data;
    if (userId === session.user.id) {
      return { error: "You cannot change suspension on your own account here." };
    }
    const target = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
    if (!target) return { error: "User not found." };
    if (target.role === "SUPER_ADMIN") {
      return { error: "Super admin accounts cannot be suspended from this action." };
    }

    await prisma.user.update({
      where: { id: userId },
      data: { accountBlocked: blocked },
    });
    await auditLog(session.user.id, blocked ? "user.account.block" : "user.account.unblock", "User", userId, {});
    await recordSecurityObservation({
      severity: blocked ? "HIGH" : "MEDIUM",
      channel: "ADMIN",
      title: blocked ? "Administrator suspended user account" : "Administrator restored user account",
      userId,
      detail: `Actor admin id ${session.user.id}`,
      metadataJson: { actorId: session.user.id, blocked },
    });
    revalidateAdminUsersSurface();
    return { ok: true };
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") return { error: "Admin access required" };
    console.error("[setUserAccountBlocked]", e);
    return { error: e instanceof Error ? e.message : "Could not update account status." };
  }
}

export async function createUserAdmin(_prev: AdminUserActionState, formData: FormData): Promise<AdminUserActionState> {
  try {
    const session = await requireSuperAdmin();
    const parsed = createUserSchema.safeParse({
      email: formData.get("email"),
      name: formData.get("name"),
      password: formData.get("password"),
      role: formData.get("role"),
    });
    if (!parsed.success) return { error: "Invalid user details." };
    const email = parsed.data.email.toLowerCase();
    const exists = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (exists) return { error: "Email already exists." };

    const passwordHash = await hash(parsed.data.password, 12);
    const user = await prisma.user.create({
      data: {
        email,
        name: parsed.data.name.trim(),
        passwordHash,
        role: parsed.data.role,
      },
      select: { id: true },
    });
    await auditLog(session.user.id, "user.create", "User", user.id, { email, role: parsed.data.role });
    revalidateAdminUsersSurface();
    return { ok: true };
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") return { error: "Super admin only" };
    return { error: e instanceof Error ? e.message : "Could not create user." };
  }
}

export async function deleteUserAdmin(_prev: AdminUserActionState, formData: FormData): Promise<AdminUserActionState> {
  try {
    const session = await requireSuperAdmin();
    const parsed = deleteUserSchema.safeParse({ userId: formData.get("userId") });
    if (!parsed.success) return { error: "Invalid user id." };
    if (parsed.data.userId === session.user.id) return { error: "You cannot delete your own account." };

    const target = await prisma.user.findUnique({ where: { id: parsed.data.userId }, select: { role: true } });
    if (!target) return { error: "User not found." };
    if (target.role === "SUPER_ADMIN") return { error: "Cannot delete another super admin from this action." };

    await prisma.user.delete({ where: { id: parsed.data.userId } });
    await auditLog(session.user.id, "user.delete", "User", parsed.data.userId, {});
    revalidateAdminUsersSurface();
    return { ok: true };
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") return { error: "Super admin only" };
    return { error: e instanceof Error ? e.message : "Could not delete user." };
  }
}

export async function adjustUserWalletAdmin(
  _prev: AdminUserActionState,
  formData: FormData,
): Promise<AdminUserActionState> {
  try {
    const session = await requireSuperAdmin();
    const parsed = adjustWalletSchema.safeParse({
      userId: formData.get("userId"),
      direction: formData.get("direction"),
      amount: formData.get("amount"),
      note: formData.get("note"),
    });
    if (!parsed.success) return { error: "Invalid wallet adjustment payload." };

    const amount = Number(parsed.data.amount.toFixed(2));
    const reference = `SDA-WAL-ADM-${nanoid(10).toUpperCase()}`;
    await prisma.$transaction(async (tx) => {
      await applyWalletLedgerEntry(
        {
          userId: parsed.data.userId,
          reference,
          amount,
          currency: "GHS",
          provider: "MANUAL",
          method: "CASH_OFFICE_GHS",
          direction: parsed.data.direction,
          purpose: "ADJUSTMENT",
          paidAt: new Date(),
          providerPayload: {
            note: parsed.data.note?.trim() || null,
            actorRole: session.user.role,
          },
          actorUserId: session.user.id,
        },
        tx,
      );
    });

    await auditLog(session.user.id, "wallet.adjust", "User", parsed.data.userId, {
      reference,
      amount,
      direction: parsed.data.direction,
      note: parsed.data.note?.trim() || null,
    });
    revalidateAdminUsersSurface();
    revalidatePath("/dashboard/profile");
    return { ok: true };
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") return { error: "Super admin only" };
    return { error: e instanceof Error ? e.message : "Could not adjust wallet." };
  }
}
