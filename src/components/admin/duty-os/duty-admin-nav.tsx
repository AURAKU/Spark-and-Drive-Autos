"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { DUTY_ADMIN_NAV } from "@/lib/duty-admin/nav";

export function DutyAdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap gap-1 rounded-xl border border-border bg-muted/30 p-1 dark:border-white/10">
      {DUTY_ADMIN_NAV.map((item) => {
        const active =
          item.href === "/admin/duty"
            ? pathname === "/admin/duty"
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`rounded-lg px-3 py-2 text-xs font-medium transition ${
              active
                ? "bg-background text-foreground shadow-sm dark:bg-white/10"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
