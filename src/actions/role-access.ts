"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireSuperAdmin } from "@/lib/auth-helpers";
import { auditLog } from "@/lib/leads";
import { sanitizePageKeysForRole } from "@/lib/rbac/access";
import { ADMIN_PAGE_CATALOG, EDITABLE_STAFF_ROLES, type EditableStaffRole } from "@/lib/rbac/catalog";
import { defaultAdminPageKeysForRole } from "@/lib/rbac/defaults";
import { prisma } from "@/lib/prisma";

export type RoleAccessActionState = {
  ok?: boolean;
  error?: string;
} | null;

const editableRoleEnum = z.enum(
  EDITABLE_STAFF_ROLES as unknown as [EditableStaffRole, ...EditableStaffRole[]],
);

const saveSchema = z.object({
  role: editableRoleEnum,
  pageKeys: z.array(z.string()).max(ADMIN_PAGE_CATALOG.length + 5),
});

export async function saveRoleAccessOverride(
  _prev: RoleAccessActionState,
  formData: FormData,
): Promise<RoleAccessActionState> {
  try {
    const session = await requireSuperAdmin();
    const parsed = saveSchema.safeParse({
      role: formData.get("role"),
      pageKeys: formData.getAll("pageKeys").map(String),
    });
    if (!parsed.success) return { error: "Invalid role access submission." };

    const pageKeys = sanitizePageKeysForRole(parsed.data.role, parsed.data.pageKeys);
    await prisma.roleAccessOverride.upsert({
      where: { role: parsed.data.role },
      create: {
        role: parsed.data.role,
        pageKeys,
        updatedById: session.user.id,
      },
      update: {
        pageKeys,
        updatedById: session.user.id,
      },
    });

    await auditLog(session.user.id, "role.access.update", "RoleAccessOverride", parsed.data.role, {
      pageKeys,
    });
    revalidatePath("/admin/roles");
    revalidatePath("/admin/users");
    revalidatePath("/admin");
    return { ok: true };
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") {
      return { error: "Only Super Admin can edit role access." };
    }
    console.error("[saveRoleAccessOverride]", e);
    return { error: e instanceof Error ? e.message : "Could not save role access." };
  }
}

export async function resetRoleAccessOverride(
  _prev: RoleAccessActionState,
  formData: FormData,
): Promise<RoleAccessActionState> {
  try {
    const session = await requireSuperAdmin();
    const roleParsed = editableRoleEnum.safeParse(formData.get("role"));
    if (!roleParsed.success) return { error: "Invalid role." };

    await prisma.roleAccessOverride.deleteMany({ where: { role: roleParsed.data } });
    await auditLog(session.user.id, "role.access.reset", "RoleAccessOverride", roleParsed.data, {
      defaults: defaultAdminPageKeysForRole(roleParsed.data),
    });
    revalidatePath("/admin/roles");
    revalidatePath("/admin/users");
    revalidatePath("/admin");
    return { ok: true };
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") {
      return { error: "Only Super Admin can reset role access." };
    }
    console.error("[resetRoleAccessOverride]", e);
    return { error: e instanceof Error ? e.message : "Could not reset role access." };
  }
}
