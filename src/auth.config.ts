import type { NextAuthConfig } from "next-auth";
import type { UserRole } from "@prisma/client";
import { NextResponse } from "next/server";

import { getAuthSecret } from "@/lib/env-auth";
import { isAdminRole } from "@/lib/roles";

/** Service assistants may only access support surfaces under `/admin` (not inventory, payments, etc.). */
function isServiceAssistantAllowedAdminPath(pathname: string): boolean {
  if (pathname === "/admin/comms" || pathname.startsWith("/admin/comms/")) return true;
  if (pathname === "/admin/inquiries" || pathname.startsWith("/admin/inquiries/")) return true;
  return false;
}

/**
 * Edge-safe config (no bcrypt / Prisma / Upstash). Used by `middleware.ts`.
 * Full providers + credentials live in `auth.ts`.
 */
export const authConfig = {
  trustHost: true,
  secret: getAuthSecret(),
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
        if (role === "SERVICE_ASSISTANT") {
          return isServiceAssistantAllowedAdminPath(path);
        }
        if (!isAdminRole(role)) return false;
      }
      if (path.startsWith("/dashboard")) {
        if (!auth?.user?.id) return false;
      }
      return true;
    },
  },
} satisfies NextAuthConfig;
