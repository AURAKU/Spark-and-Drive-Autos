import Link from "next/link";
import type { ReactNode } from "react";

type ShopLink = {
  id: string;
  label: string;
  hint: string;
  href: string;
  active: boolean;
  icon: ReactNode;
};

function Icon({ children, className = "size-6" }: { children: ReactNode; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}

const icons = {
  parts: (
    <Icon>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v2.2M12 18.8V21M3 12h2.2M18.8 12H21M5.6 5.6l1.6 1.6M16.8 16.8l1.6 1.6M18.4 5.6l-1.6 1.6M7.2 16.8l-1.6 1.6" />
    </Icon>
  ),
  tools: (
    <Icon>
      <path d="M14.5 6.5a3.5 3.5 0 0 0-4.8 4.8L4 17l3 3 5.7-5.7a3.5 3.5 0 0 0 4.8-4.8L15 12l-3-3 2.5-2.5Z" />
    </Icon>
  ),
  accessories: (
    <Icon>
      <path d="M12 3.5 14 8l5 .6-3.7 3.3.9 4.9L12 14.8 7.8 16.8l.9-4.9L5 8.6 10 8l2-4.5Z" />
    </Icon>
  ),
  brakes: (
    <Icon>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M12 4v3M12 17v3M4 12h3M17 12h3" />
    </Icon>
  ),
  engine: (
    <Icon>
      <path d="M8 9h8v8H8z" />
      <path d="M10 9V6h4v3M8 12H5v3h3M16 12h3v3h-3M10 17v2M14 17v2" />
    </Icon>
  ),
  filters: (
    <Icon>
      <path d="M4 6h16l-5 6v6l-6-2v-4L4 6Z" />
    </Icon>
  ),
  lights: (
    <Icon>
      <path d="M9 18h6M10 21h4" />
      <path d="M8 14a4 4 0 1 1 8 0c0 1.6-.8 2.6-1.5 3.2-.4.3-.5.6-.5.8H10c0-.2-.1-.5-.5-.8C8.8 16.6 8 15.6 8 14Z" />
    </Icon>
  ),
  suspension: (
    <Icon>
      <path d="M8 4h3v3H8zM13 17h3v3h-3z" />
      <path d="M9.5 7c4 1 5 4 5 6.5" />
      <path d="M8 10.5c2 .4 3.2 1.4 4 2.8" />
    </Icon>
  ),
  fluids: (
    <Icon>
      <path d="M10 3h4l1 4H9l1-4Z" />
      <path d="M8 7h8l-1 13H9L8 7Z" />
    </Icon>
  ),
  wheels: (
    <Icon>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="2" />
      <path d="m12 4 1.2 6L12 12l-1.2-2L12 4Zm0 16-1.2-6L12 12l1.2 2L12 20ZM4 12l6-1.2L12 12l-2 1.2L4 12Zm16 0-6 1.2L12 12l2-1.2L20 12Z" />
    </Icon>
  ),
  all: (
    <Icon className="size-4">
      <rect x="4" y="4" width="6" height="6" rx="1" />
      <rect x="14" y="4" width="6" height="6" rx="1" />
      <rect x="4" y="14" width="6" height="6" rx="1" />
      <rect x="14" y="14" width="6" height="6" rx="1" />
    </Icon>
  ),
  ghana: (
    <Icon className="size-4">
      <path d="M4 10h16v9H4z" />
      <path d="M8 10V7h8v3M12 13v3" />
    </Icon>
  ),
  overseas: (
    <Icon className="size-4">
      <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
      <circle cx="12" cy="12" r="8" />
    </Icon>
  ),
};

export const shopIcons = icons;

function Tile({ item }: { item: ShopLink }) {
  return (
    <Link
      href={item.href}
      aria-current={item.active ? "page" : undefined}
      aria-label={item.hint ? `${item.label}. ${item.hint}` : item.label}
      title={item.hint || undefined}
      className={`flex min-w-0 flex-col items-center justify-center gap-1.5 rounded-2xl border px-1.5 py-2.5 text-center transition sm:px-2 sm:py-3 ${
        item.active
          ? "border-[var(--brand)] bg-[var(--brand)] text-white"
          : "border-white/10 bg-white/[0.04] text-zinc-100 hover:border-[var(--brand)]/45 hover:bg-white/[0.07]"
      }`}
    >
      <span className={`grid size-8 place-items-center rounded-lg sm:size-9 [&_svg]:size-5 sm:[&_svg]:size-6 ${item.active ? "text-white" : "text-[var(--brand)]"}`} aria-hidden>
        {item.icon}
      </span>
      <span className="line-clamp-2 text-[11px] font-semibold leading-tight sm:text-sm">{item.label}</span>
    </Link>
  );
}

export function PartsShopNav({ lanes, departments, stock }: { lanes: ShopLink[]; departments: ShopLink[]; stock: ShopLink[] }) {
  return (
    <nav aria-label="Shop parts" className="mt-4 space-y-3">
      <div className="grid grid-cols-3 gap-2">
        {lanes.map((item) => (
          <Tile key={item.id} item={item} />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {departments.map((item) => (
          <Tile key={item.id} item={item} />
        ))}
      </div>
      <div className="sda-chip-scroll pb-1" role="group" aria-label="Stock">
        {stock.map((item) => (
          <Link
            key={item.id}
            href={item.href}
            aria-current={item.active ? "true" : undefined}
            className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm font-semibold ${
              item.active ? "bg-[var(--brand)] text-white" : "border border-white/15 text-zinc-200"
            }`}
          >
            <span className="grid size-4 place-items-center">{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
