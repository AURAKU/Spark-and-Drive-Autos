"use client";

import Link from "next/link";

import type { DashboardOrderFilterId } from "@/lib/dashboard-orders-filter";
import { ordersListHref } from "@/lib/dashboard-orders-filter";
import { cn } from "@/lib/utils";

const GROUPS: Array<{
  title: string;
  items: Array<{ id: DashboardOrderFilterId; label: string }>;
}> = [
  {
    title: "Parts & accessories",
    items: [
      { id: "parts-ghana", label: "Ghana stock" },
      { id: "parts-china-preorder", label: "China pre-order" },
    ],
  },
  {
    title: "Cars",
    items: [
      { id: "car-ghana", label: "Ghana stock" },
      { id: "car-china", label: "China stock" },
    ],
  },
];

type Props = { active: DashboardOrderFilterId };

export function DashboardOrdersFilter({ active }: Props) {
  return (
    <div className="mt-6 space-y-4">
      <p className="text-[10px] font-semibold tracking-wide text-zinc-500 uppercase">Filter by type</p>
      <div className="flex flex-wrap items-center gap-2">
        <FilterPill
          href={ordersListHref(1, "all")}
          isActive={active === "all"}
        >
          All orders
        </FilterPill>
      </div>
      {GROUPS.map((g) => (
        <div key={g.title}>
          <p className="text-xs font-medium text-zinc-400">{g.title}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {g.items.map((item) => (
              <FilterPill
                key={item.id}
                href={ordersListHref(1, item.id)}
                isActive={active === item.id}
              >
                {item.label}
              </FilterPill>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function FilterPill({
  href,
  isActive,
  children,
}: {
  href: string;
  isActive: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex h-9 items-center rounded-full border px-3.5 text-sm transition",
        isActive
          ? "border-[var(--brand)]/50 bg-[var(--brand)]/15 font-medium text-white"
          : "border-white/15 bg-white/[0.04] text-zinc-300 hover:border-white/25 hover:bg-white/[0.08]",
      )}
    >
      {children}
    </Link>
  );
}
