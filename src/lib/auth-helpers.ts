import { redirect } from "next/navigation";

import { isAdminRole, isSuperAdminRole } from "@/auth";
import { safeAuth } from "@/lib/safe-auth";

/**
 * Use in layouts/routes that must never render for anonymous users (e.g. `/dashboard`).
 * Preserves deep-link return via `callbackUrl` when login succeeds.
 */
export async function requireSessionOrRedirect(loginCallbackPath = "/dashboard") {
  const session = await safeAuth();
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=" + encodeURIComponent(loginCallbackPath));
  }
  return session;
}

/** Blocks suspended accounts from authenticated app shells (JWT is refreshed in `auth()` first). */
export async function requireActiveSessionOrRedirect(loginCallbackPath = "/dashboard") {
  const session = await requireSessionOrRedirect(loginCallbackPath);
  if (session.user.accountBlocked) {
    redirect("/login?error=account-suspended&callbackUrl=" + encodeURIComponent(loginCallbackPath));
  }
  return session;
}

export async function requireUser() {
  const session = await safeAuth();
  if (!session?.user?.id) {
    throw new Error("UNAUTHORIZED");
  }
  return session;
}

export async function requireAdmin() {
  const session = await requireUser();
  if (!isAdminRole(session.user.role)) {
    throw new Error("FORBIDDEN");
  }
  return session;
}

export async function requireSuperAdmin() {
  const session = await requireUser();
  if (!isSuperAdminRole(session.user.role)) {
    throw new Error("FORBIDDEN");
  }
  return session;
}
