"use client";

import { Bell, ChevronDown, LayoutDashboard, UserCircle2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn, signOut } from "next-auth/react";
import { clearAllNotifications, deleteNotification, markAllNotificationsRead, markNotificationRead } from "@/actions/notifications";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { DisplayCurrency } from "@/lib/currency";

import { CurrencySwitcher } from "./currency-switcher";
import { ThemeToggle } from "./theme-toggle";

const AUTH_CALLBACK = "/dashboard";

/** Stable SSR/client string — avoids `toLocaleString()` hydration mismatches. */
function formatNotificationTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  const h = String(d.getUTCHours()).padStart(2, "0");
  const min = String(d.getUTCMinutes()).padStart(2, "0");
  return `${y}-${m}-${day} ${h}:${min} UTC`;
}

type Props = {
  displayCurrency: DisplayCurrency;
  isLoggedIn: boolean;
  dashboardHref: string;
  googleOAuthConfigured: boolean;
  appleOAuthConfigured: boolean;
  unreadNotifications: number;
  recentNotifications: Array<{
    id: string;
    type: string;
    title: string;
    body: string | null;
    href: string | null;
    read: boolean;
    createdAt: string;
  }>;
};

/**
 * Public storefront header: logo-home anchor, dashboard entry, currency, and auth entry points.
 */
export function SiteHeaderClient({
  displayCurrency,
  isLoggedIn,
  dashboardHref,
  googleOAuthConfigured,
  appleOAuthConfigured,
  unreadNotifications,
  recentNotifications,
}: Props) {
  const router = useRouter();

  async function openNotification(notification: {
    id: string;
    href: string | null;
  }) {
    await markNotificationRead(notification.id);
    router.push(notification.href ?? `/dashboard/notifications#notification-${notification.id}`);
    router.refresh();
  }

  async function onMarkAllRead() {
    await markAllNotificationsRead();
    router.refresh();
  }

  async function onClearOne(id: string) {
    await deleteNotification(id);
    router.refresh();
  }

  async function onClearAll() {
    await clearAllNotifications();
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur-xl dark:border-white/10 dark:bg-zinc-950/90">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--brand)]/40 to-transparent" />
      <div className="mx-auto flex min-h-[4.25rem] max-w-7xl min-w-0 flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-6">
        <div className="flex min-w-0 shrink-0 items-center gap-2 sm:gap-2.5">
          <Link
            href="/"
            aria-label="Home"
            title="Home"
            className="relative inline-flex size-12 shrink-0 items-center justify-center rounded-full border border-border bg-muted/80 text-foreground shadow-[0_0_30px_-12px_rgba(239,68,68,0.35)] transition hover:border-[var(--brand)]/50 hover:bg-muted sm:size-14 dark:border-white/25 dark:bg-white/[0.08] dark:text-white dark:shadow-[0_0_30px_-12px_rgba(239,68,68,0.7)] dark:hover:bg-white/[0.12]"
          >
            <Image src="/brand/logo-emblem.png" alt="Spark and Drive Autos logo" fill className="rounded-full object-cover p-1" />
          </Link>
          <Link
            href={dashboardHref}
            aria-label="Open dashboard"
            title="Open dashboard"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-foreground shadow-sm transition hover:border-[var(--brand)]/45 hover:bg-muted sm:h-11 sm:w-11 dark:border-white/20 dark:bg-gradient-to-b dark:from-white/[0.12] dark:to-white/[0.04] dark:text-zinc-100 dark:shadow-[0_0_26px_-14px_rgba(20,216,230,0.8)] dark:hover:bg-white/[0.12]"
          >
            {isLoggedIn ? <LayoutDashboard className="size-5" aria-hidden /> : <UserCircle2 className="size-5" aria-hidden />}
          </Link>
        </div>
        <div className="flex min-w-0 flex-wrap items-center justify-end gap-2 sm:gap-2.5">
          <ThemeToggle />
          <CurrencySwitcher initial={displayCurrency} />
          {isLoggedIn ? (
            <>
              <DropdownMenu>
                <DropdownMenuTrigger
                  className="relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-foreground transition hover:bg-muted dark:border-white/15 dark:bg-white/[0.04] dark:text-zinc-200 dark:hover:bg-white/10"
                  aria-label="Notifications"
                >
                  <Bell className="size-[1.15rem]" aria-hidden />
                  {unreadNotifications > 0 ? (
                    <span className="absolute -right-0.5 -top-0.5 flex h-[1.1rem] min-w-[1.1rem] items-center justify-center rounded-full bg-[var(--brand)] px-1 text-[10px] font-bold text-black">
                      {unreadNotifications > 99 ? "99+" : unreadNotifications}
                    </span>
                  ) : null}
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[24rem] max-w-[90vw] shadow-xl">
                  <DropdownMenuGroup>
                    <DropdownMenuLabel className="flex items-center justify-between">
                      <span>Notifications</span>
                      <span className="text-xs text-muted-foreground">{unreadNotifications} unread</span>
                    </DropdownMenuLabel>
                    <div className="px-3 pb-2 text-[11px] text-muted-foreground">
                      Customer Service Live Support Chat, announcements, payment and order updates, and system notices.
                    </div>
                    <div className="flex items-center gap-3 px-3 pb-2 text-xs">
                      <button type="button" className="text-[var(--brand)] hover:underline" onClick={() => void onMarkAllRead()}>
                        Mark all read
                      </button>
                      <button
                        type="button"
                        className="text-muted-foreground underline-offset-2 transition hover:text-foreground hover:underline"
                        onClick={() => void onClearAll()}
                      >
                        Clear all
                      </button>
                    </div>
                    <DropdownMenuSeparator className="bg-border dark:bg-white/10" />
                    {recentNotifications.length === 0 ? (
                      <div className="px-3 py-6 text-sm text-muted-foreground">No messages yet.</div>
                    ) : (
                      recentNotifications.map((n) => (
                        <div
                          key={n.id}
                          className={`px-3 py-2 transition hover:bg-muted/80 dark:hover:bg-white/[0.08] ${n.read ? "" : "bg-[var(--brand)]/[0.08]"}`}
                        >
                          <button
                            type="button"
                            onClick={() => void openNotification({ id: n.id, href: n.href })}
                            className="w-full cursor-pointer text-left"
                          >
                            <p className="line-clamp-1 text-sm font-semibold text-foreground">{n.title}</p>
                            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                              {n.body?.trim() ? n.body : "Open to view full message."}
                            </p>
                            <p className="mt-1 text-[10px] text-muted-foreground">
                              {n.type} · {formatNotificationTime(n.createdAt)}
                            </p>
                          </button>
                          <div className="mt-1.5 flex items-center gap-3 text-[11px]">
                            {!n.read ? (
                              <button
                                type="button"
                                className="text-[var(--brand)] hover:underline"
                                onClick={() => void openNotification({ id: n.id, href: n.href })}
                              >
                                View full
                              </button>
                            ) : null}
                            <button
                              type="button"
                              className="text-muted-foreground underline-offset-2 transition hover:text-foreground hover:underline"
                              onClick={() => void onClearOne(n.id)}
                            >
                              Clear
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                    <DropdownMenuSeparator className="bg-border dark:bg-white/10" />
                    <DropdownMenuItem
                      className="cursor-pointer font-medium text-[var(--brand)]"
                      onClick={() => router.push("/dashboard/notifications")}
                    >
                      View all notifications
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 border-border bg-card text-xs text-foreground hover:bg-muted sm:text-sm dark:border-white/15 dark:bg-white/[0.04] dark:text-zinc-200 dark:hover:bg-white/10"
                onClick={() => void signOut({ callbackUrl: "/" })}
              >
                Sign out
              </Button>
            </>
          ) : (
            <>
              <DropdownMenu>
                <DropdownMenuTrigger
                  className="inline-flex h-9 shrink-0 items-center gap-1 rounded-lg border border-border bg-card px-2.5 text-xs font-medium text-foreground outline-none transition hover:bg-muted focus-visible:ring-2 focus-visible:ring-[var(--brand)]/50 sm:px-3 sm:text-sm dark:border-white/15 dark:bg-white/[0.04] dark:text-zinc-200 dark:hover:bg-white/10"
                  aria-label="Login options"
                >
                  Login
                  <ChevronDown className="size-3.5 opacity-70" aria-hidden />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-[14rem] shadow-xl">
                  <DropdownMenuGroup>
                    <DropdownMenuLabel>Sign in</DropdownMenuLabel>
                    {appleOAuthConfigured ? (
                      <DropdownMenuItem
                        className="cursor-pointer"
                        onClick={() => void signIn("apple", { callbackUrl: AUTH_CALLBACK })}
                      >
                        Continue with Apple
                      </DropdownMenuItem>
                    ) : null}
                    {googleOAuthConfigured ? (
                      <DropdownMenuItem
                        className="cursor-pointer"
                        onClick={() => void signIn("google", { callbackUrl: AUTH_CALLBACK })}
                      >
                        Continue with Google
                      </DropdownMenuItem>
                    ) : null}
                    {appleOAuthConfigured || googleOAuthConfigured ? (
                      <DropdownMenuSeparator className="bg-border dark:bg-white/10" />
                    ) : null}
                    <DropdownMenuItem className="cursor-pointer" onClick={() => router.push("/login#email")}>
                      Email or phone + password
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger
                  className="inline-flex h-9 shrink-0 items-center gap-1 rounded-lg bg-[var(--brand)] px-2.5 text-xs font-semibold text-black outline-none transition hover:opacity-90 focus-visible:ring-2 focus-visible:ring-[var(--brand)]/50 sm:px-3 sm:text-sm"
                  aria-label="Create account options"
                >
                  Create account
                  <ChevronDown className="size-3.5 opacity-80" aria-hidden />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-[14rem] shadow-xl">
                  <DropdownMenuGroup>
                    <DropdownMenuLabel>Sign up</DropdownMenuLabel>
                    {appleOAuthConfigured ? (
                      <DropdownMenuItem
                        className="cursor-pointer"
                        onClick={() => void signIn("apple", { callbackUrl: AUTH_CALLBACK })}
                      >
                        Continue with Apple
                      </DropdownMenuItem>
                    ) : null}
                    {googleOAuthConfigured ? (
                      <DropdownMenuItem
                        className="cursor-pointer"
                        onClick={() => void signIn("google", { callbackUrl: AUTH_CALLBACK })}
                      >
                        Continue with Google
                      </DropdownMenuItem>
                    ) : null}
                    {appleOAuthConfigured || googleOAuthConfigured ? (
                      <DropdownMenuSeparator className="bg-border dark:bg-white/10" />
                    ) : null}
                    <DropdownMenuItem className="cursor-pointer" onClick={() => router.push("/register#phone")}>
                      Phone number
                    </DropdownMenuItem>
                    <DropdownMenuItem className="cursor-pointer" onClick={() => router.push("/register#email")}>
                      Email + password
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
