import NextAuth from "next-auth";

import { authConfig } from "./auth.config";

/**
 * Edge-only: uses `auth.config` (no bcrypt / DB / Upstash). Route rules live in `callbacks.authorized`.
 */
export default NextAuth(authConfig).auth;

export const config = {
  matcher: ["/admin/:path*", "/dashboard/:path*"],
};
