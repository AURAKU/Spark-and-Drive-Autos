import type { UserRole } from "@prisma/client";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      role: UserRole;
      accountBlocked: boolean;
      /** Effective admin page keys (from defaults + RoleAccessOverride). */
      adminPages?: string[];
    };
  }

  interface User {
    role: UserRole;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: UserRole;
    accountBlocked?: boolean;
    /** Last time role/block flags were synced from DB (ms). */
    dbRefreshedAt?: number;
    /** AdminPageKey[] for middleware path gates. */
    adminPages?: string[];
  }
}
