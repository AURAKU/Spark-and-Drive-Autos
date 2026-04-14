import { cookies } from "next/headers";

import { isAppleAuthConfigured, isGoogleAuthConfigured } from "@/lib/oauth-config";
import { parseDisplayCurrency } from "@/lib/currency";
import { safeAuth } from "@/lib/safe-auth";
import { prisma } from "@/lib/prisma";
import { getStaffOperationsHref } from "@/lib/roles";

import { SiteHeaderClient } from "./site-header-client";

/** Same root element + layout shell as `SiteHeaderClient` to avoid Suspense/streaming markup mismatches. */
export function SiteHeaderFallback() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0b1016]/90 backdrop-blur-xl">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--brand)]/40 to-transparent" />
      <div className="mx-auto flex min-h-[4.25rem] max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:gap-4 sm:px-6">
        <div className="flex shrink-0 items-center gap-2 sm:gap-2.5">
          <div className="size-12 shrink-0 animate-pulse rounded-full bg-white/10 sm:size-14" aria-hidden />
          <div className="h-10 w-[7.5rem] shrink-0 animate-pulse rounded-xl bg-white/10 sm:h-11 sm:w-28" aria-hidden />
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-2.5">
          <div className="h-9 w-[4.5rem] animate-pulse rounded-lg bg-white/10" aria-hidden />
          <div className="h-8 w-20 animate-pulse rounded-lg bg-white/10" aria-hidden />
          <div className="h-9 w-16 animate-pulse rounded-lg bg-white/10" aria-hidden />
          <div className="h-9 w-20 animate-pulse rounded-lg bg-white/10" aria-hidden />
        </div>
      </div>
    </header>
  );
}

/** Server wrapper: session, currency cookie, OAuth availability, unread notifications. */
export async function SiteHeader() {
  const session = await safeAuth();
  const cookieStore = await cookies();
  const displayCurrency = parseDisplayCurrency(cookieStore.get("sda_currency")?.value);
  const googleOAuthConfigured = isGoogleAuthConfigured();
  const appleOAuthConfigured = isAppleAuthConfigured();
  const dashboardHref = getStaffOperationsHref(session?.user?.role);

  let unreadNotifications = 0;
  let recentNotifications: Array<{
    id: string;
    type: string;
    title: string;
    body: string | null;
    href: string | null;
    read: boolean;
    createdAt: string;
  }> = [];
  if (session?.user?.id) {
    const [count, recent] = await Promise.all([
      prisma.notification.count({
        where: { userId: session.user.id, read: false },
      }),
      prisma.notification.findMany({
        where: { userId: session.user.id },
        orderBy: { createdAt: "desc" },
        take: 12,
        select: { id: true, type: true, title: true, body: true, href: true, read: true, createdAt: true },
      }),
    ]);
    unreadNotifications = count;
    recentNotifications = recent.map((n) => ({
      ...n,
      createdAt: n.createdAt.toISOString(),
    }));
  }

  return (
    <SiteHeaderClient
      displayCurrency={displayCurrency}
      isLoggedIn={Boolean(session?.user)}
      dashboardHref={dashboardHref}
      googleOAuthConfigured={googleOAuthConfigured}
      appleOAuthConfigured={appleOAuthConfigured}
      unreadNotifications={unreadNotifications}
      recentNotifications={recentNotifications}
    />
  );
}
