"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { clearAllNotifications, deleteNotification, markNotificationRead } from "@/actions/notifications";

export type NotificationRow = {
  id: string;
  title: string;
  body: string | null;
  read: boolean;
  href: string | null;
  createdAt: string;
};

export function NotificationList({ initial }: { initial: NotificationRow[] }) {
  const router = useRouter();

  async function onMarkRead(id: string) {
    await markNotificationRead(id);
    router.refresh();
  }

  async function onDelete(id: string) {
    await deleteNotification(id);
    router.refresh();
  }

  async function onClearAll() {
    await clearAllNotifications();
    router.refresh();
  }

  if (initial.length === 0) {
    return <p className="text-sm text-muted-foreground">No notifications yet.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button
          type="button"
          className="text-xs text-muted-foreground underline-offset-2 transition hover:text-foreground hover:underline"
          onClick={() => void onClearAll()}
        >
          Clear all notifications
        </button>
      </div>
      <ul className="space-y-3">
        {initial.map((n) => (
          <li
            key={n.id}
            id={`notification-${n.id}`}
            className={`rounded-2xl border border-border p-4 dark:border-white/10 ${
              n.read ? "bg-muted/40 dark:bg-white/[0.02]" : "border-[var(--brand)]/30 bg-[var(--brand)]/[0.08] dark:border-[var(--brand)]/25 dark:bg-[var(--brand)]/[0.06]"
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-medium text-foreground dark:text-white">{n.title}</p>
                {n.body ? <p className="mt-1 text-sm text-muted-foreground">{n.body}</p> : null}
                <p className="mt-2 text-xs text-muted-foreground">{new Date(n.createdAt).toLocaleString()}</p>
              </div>
              <div className="flex flex-wrap gap-3">
                {n.href ? (
                  <Link
                    href={n.href}
                    className="text-sm font-medium text-[var(--brand)] hover:underline"
                    onClick={() => void onMarkRead(n.id)}
                  >
                    View full message
                  </Link>
                ) : null}
                {!n.read ? (
                  <button
                    type="button"
                    className="text-sm text-muted-foreground underline-offset-2 transition hover:text-foreground hover:underline"
                    onClick={() => void onMarkRead(n.id)}
                  >
                    Mark read
                  </button>
                ) : null}
                <button
                  type="button"
                  className="text-sm text-muted-foreground underline-offset-2 transition hover:text-foreground hover:underline"
                  onClick={() => void onDelete(n.id)}
                >
                  Clear
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
