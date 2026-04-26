"use client";

import { Bell, ChevronDown, Home, LayoutDashboard, LogOut, Menu, UserCircle2 } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { signIn, signOut } from "next-auth/react";
import { clearAllNotifications, deleteNotification, markAllNotificationsRead, markNotificationRead } from "@/actions/notifications";

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
 * Public storefront header with low-clutter controls:
 * - left: logo menu (home/dashboard)
 * - center: theme toggle (always centered)
 * - right: unified actions menu (currency/auth/notifications)
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
      <div className="relative min-h-[4.25rem] w-full px-2 py-3 sm:px-4 lg:px-6">
        <div className="flex min-h-[calc(4.25rem-1.5rem)] items-center justify-between">
          <DropdownMenu>
            <DropdownMenuTrigger
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/80 p-1.5 text-foreground shadow-[0_0_30px_-12px_rgba(239,68,68,0.35)] transition hover:border-[var(--brand)]/50 hover:bg-muted dark:border-white/25 dark:bg-white/[0.08] dark:text-white dark:shadow-[0_0_30px_-12px_rgba(239,68,68,0.7)] dark:hover:bg-white/[0.12]"
              aria-label="Open site navigation menu"
            >
              <span className="relative inline-flex size-10 items-center justify-center overflow-hidden rounded-full sm:size-11">
                <Image src="/brand/logo-emblem.png" alt="Spark and Drive Autos logo" fill className="rounded-full object-cover p-1" />
              </span>
              <ChevronDown className="mr-1 size-4 opacity-75" aria-hidden />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" sideOffset={10} className="w-56 max-w-[calc(100vw-1rem)] shadow-xl">
              <DropdownMenuItem className="cursor-pointer gap-2" onClick={() => router.push("/")}>
                <Home className="size-4" aria-hidden /> Main homepage
              </DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer gap-2" onClick={() => router.push(dashboardHref)}>
                {isLoggedIn ? <LayoutDashboard className="size-4" aria-hidden /> : <UserCircle2 className="size-4" aria-hidden />}
                Dashboard
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger
              className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card text-foreground shadow-sm transition hover:border-[var(--brand)]/45 hover:bg-muted dark:border-white/20 dark:bg-gradient-to-b dark:from-white/[0.12] dark:to-white/[0.04] dark:text-zinc-100 dark:shadow-[0_0_26px_-14px_rgba(20,216,230,0.8)] dark:hover:bg-white/[0.12]"
              aria-label="Open account and currency menu"
            >
              <Menu className="size-5" aria-hidden />
              {isLoggedIn && unreadNotifications > 0 ? (
                <span className="absolute -right-0.5 -top-0.5 flex h-[1.1rem] min-w-[1.1rem] items-center justify-center rounded-full bg-[var(--brand)] px-1 text-[10px] font-bold text-black">
                  {unreadNotifications > 99 ? "99+" : unreadNotifications}
                </span>
              ) : null}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" sideOffset={10} className="w-[22rem] max-w-[calc(100vw-1rem)] shadow-xl">
              <DropdownMenuGroup>
                <DropdownMenuLabel>Display preferences</DropdownMenuLabel>
                <div className="px-3 pb-2">
                  <CurrencySwitcher initial={displayCurrency} />
                </div>
                <DropdownMenuSeparator className="bg-border dark:bg-white/10" />
                {!isLoggedIn ? (
                  <>
                    <DropdownMenuLabel>Account</DropdownMenuLabel>
                    {appleOAuthConfigured ? (
                      <DropdownMenuItem className="cursor-pointer" onClick={() => void signIn("apple", { callbackUrl: AUTH_CALLBACK })}>
                        Login with Apple
                      </DropdownMenuItem>
                    ) : null}
                    {googleOAuthConfigured ? (
                      <DropdownMenuItem className="cursor-pointer" onClick={() => void signIn("google", { callbackUrl: AUTH_CALLBACK })}>
                        Login with Google
                      </DropdownMenuItem>
                    ) : null}
                    <DropdownMenuItem className="cursor-pointer" onClick={() => router.push("/login#email")}>
                      Login with email or phone
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="bg-border dark:bg-white/10" />
                    <DropdownMenuItem className="cursor-pointer font-medium text-[var(--brand)]" onClick={() => router.push("/register#phone")}>
                      Create Account
                    </DropdownMenuItem>
                  </>
                ) : (
                  <>
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
                    <DropdownMenuItem className="cursor-pointer gap-2 font-medium text-[var(--brand)]" onClick={() => router.push("/dashboard/notifications")}>
                      <Bell className="size-4" aria-hidden />
                      View all notifications
                    </DropdownMenuItem>
                    <DropdownMenuItem className="cursor-pointer gap-2" onClick={() => void signOut({ callbackUrl: "/" })}>
                      <LogOut className="size-4" aria-hidden />
                      Sign out
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="pointer-events-none absolute inset-y-0 left-1/2 flex -translate-x-1/2 items-center">
          <ThemeToggle className="pointer-events-auto" />
        </div>
      </div>
    </header>
  );
}
