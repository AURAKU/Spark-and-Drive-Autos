import Link from "next/link";

import { cn } from "@/lib/utils";

type Panel = "users" | "roles";

export function UsersRolesTabs({ panel }: { panel: Panel }) {
  const base =
    "inline-flex items-center rounded-lg px-4 py-2 text-sm font-medium transition border";
  const active = "border-[var(--brand)]/40 bg-[var(--brand)]/10 text-white";
  const idle = "border-white/10 bg-white/[0.02] text-zinc-400 hover:border-white/20 hover:text-zinc-200";

  return (
    <nav className="mt-6 flex flex-wrap gap-2 border-b border-white/10 pb-4" aria-label="Users and roles">
      <Link href="/admin/users" className={cn(base, panel === "users" ? active : idle)} scroll={false}>
        User directory
      </Link>
      <Link href="/admin/users?panel=roles" className={cn(base, panel === "roles" ? active : idle)} scroll={false}>
        Role reference
      </Link>
    </nav>
  );
}
