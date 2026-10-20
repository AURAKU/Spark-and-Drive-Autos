import type { NextAuthConfig } from "next-auth";
import type { UserRole } from "@prisma/client";
import { NextResponse } from "next/server";

import { getAuthCookieDomain, getAuthSecrets, getUseSecureCookies } from "@/lib/env-auth";
import { firstAllowedAdminHref } from "@/lib/rbac/catalog";
import { defaultAdminPageKeysForRole } from "@/lib/rbac/defaults";
import { canRoleAccessAdminPath } from "@/lib/rbac/edge";
import { isAdminRole, isSupportStaffRole } from "@/lib/roles";

const useSecureCookies = getUseSecureCookies();
const authCookieDomain = getAuthCookieDomain();
/** Shared opts for cookies that may carry `Domain`. Never applied to `__Host-` CSRF cookie. */
const sharedSessionCookieOptions = {
  path: "/" as const,
  sameSite: "lax" as const,
  httpOnly: true,
  secure: useSecureCookies,
  ...(authCookieDomain ? { domain: authCookieDomain } : {}),
};

/**
 * Edge-safe config (no bcrypt / Prisma / Upstash). Used by `middleware.ts`.
 * Full providers + credentials live in `auth.ts`.
 */
export const authConfig = {
  trustHost: true,
  secret: getAuthSecrets(),
  /** Align with production HTTPS + proxy so session cookie names match middleware (see `getUseSecureCookies`). */
  useSecureCookies,
  cookies: {
    sessionToken: { options: sharedSessionCookieOptions },
    callbackUrl: { options: { ...sharedSessionCookieOptions } },
    pkceCodeVerifier: { options: { ...sharedSessionCookieOptions } },
    state: { options: { ...sharedSessionCookieOptions } },
    nonce: { options: { ...sharedSessionCookieOptions } },
  },
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 7 },
  pages: {
    signIn: "/login",
  },
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id!;
        token.role = user.role;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as UserRole;
        session.user.accountBlocked = Boolean(token.accountBlocked);
        if (Array.isArray(token.adminPages)) {
          session.user.adminPages = token.adminPages as string[];
        }
      }
      return session;
    },
    authorized({ auth, request }) {
      const path = request.nextUrl.pathname;
      const blocked = Boolean(auth?.user && (auth.user as { accountBlocked?: boolean }).accountBlocked);
      if (blocked && (path.startsWith("/dashboard") || path.startsWith("/admin"))) {
        return NextResponse.redirect(new URL("/login?error=account-suspended", request.url));
      }
      if (path.startsWith("/admin")) {
        const role = auth?.user?.role;
        if (!auth?.user?.id || !role) return false;
        if (!isSupportStaffRole(role) && !isAdminRole(role)) return false;

        const tokenPages = (auth.user as { adminPages?: string[] }).adminPages;
        const allowed = canRoleAccessAdminPath(role, path, tokenPages);
        if (!allowed) {
          const keys =
            role === "SUPER_ADMIN"
              ? ["*"]
              : Array.isArray(tokenPages) && tokenPages.length > 0
                ? tokenPages
                : defaultAdminPageKeysForRole(role);
          const dest = firstAllowedAdminHref(keys);
          if (dest === path) return false;
          return NextResponse.redirect(new URL(dest, request.url));
        }
      }
      if (path.startsWith("/dashboard")) {
        if (!auth?.user?.id) return false;
      }
      return true;
    },
  },
} satisfies NextAuthConfig;
