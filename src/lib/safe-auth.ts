import type { Session } from "next-auth";

import { auth } from "@/auth";

function isDynamicServerUsageError(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    "digest" in e &&
    (e as { digest?: string }).digest === "DYNAMIC_SERVER_USAGE"
  );
}

/**
 * Wraps `auth()` so misconfiguration does not 500 layouts.
 * Re-throws Next.js dynamic-rendering signals so prerender can opt into dynamic routes.
 */
export async function safeAuth(): Promise<Session | null> {
  try {
    return (await auth()) ?? null;
  } catch (e) {
    if (isDynamicServerUsageError(e)) throw e;
    console.error("[safeAuth]", e);
    return null;
  }
}
