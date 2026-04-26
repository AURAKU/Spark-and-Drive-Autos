"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { cn } from "@/lib/utils";

export type EstimateLinkItem = {
  id: string;
  label: string;
  searchText: string;
};

type Props = {
  name: string;
  items: EstimateLinkItem[];
  initialValue?: string;
  placeholder?: string;
  className?: string;
  onValueChange?: (id: string) => void;
};

export function EstimateLinkCombobox({
  name,
  items,
  initialValue = "",
  placeholder = "Type to search…",
  className,
  onValueChange,
}: Props) {
  const labelFor = useCallback((id: string) => items.find((i) => i.id === id)?.label ?? "", [items]);

  const [selectedId, setSelectedId] = useState(initialValue);
  const [query, setQuery] = useState(() => labelFor(initialValue));
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const prevInitialRef = useRef(initialValue);

  useEffect(() => {
    if (prevInitialRef.current === initialValue) return;
    prevInitialRef.current = initialValue;
    setSelectedId(initialValue);
    setQuery(labelFor(initialValue));
  }, [initialValue, labelFor]);

  useEffect(() => {
    function handlePointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items.slice(0, 50);
    return items.filter((i) => i.searchText.includes(q)).slice(0, 60);
  }, [items, query]);

  function selectItem(item: EstimateLinkItem | null) {
    if (!item) {
      setSelectedId("");
      setQuery("");
      onValueChange?.("");
      setOpen(false);
      return;
    }
    setSelectedId(item.id);
    setQuery(item.label);
    onValueChange?.(item.id);
    setOpen(false);
  }

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <input type="hidden" name={name} value={selectedId} />
      <input
        type="text"
        value={query}
        onChange={(e) => {
          const v = e.target.value;
          setQuery(v);
          setOpen(true);
          const matchLabel = selectedId ? labelFor(selectedId) : "";
          if (selectedId && v !== matchLabel) {
            setSelectedId("");
            onValueChange?.("");
          }
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none ring-[var(--brand)]/30 focus:ring-2 dark:border-white/15 dark:bg-black/30"
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-controls={`${name}-listbox`}
        aria-autocomplete="list"
      />
      {open ? (
        <ul
          id={`${name}-listbox`}
          role="listbox"
          className="absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-border bg-card py-1 text-sm shadow-xl dark:border-white/15 dark:bg-zinc-950"
        >
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-muted-foreground">No matches — try another keyword or id.</li>
          ) : (
            filtered.map((item) => (
              <li
                key={item.id}
                role="option"
                aria-selected={item.id === selectedId}
                className="cursor-pointer px-3 py-2 text-foreground hover:bg-muted/80 dark:hover:bg-white/10"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => selectItem(item)}
              >
                {item.label}
              </li>
            ))
          )}
        </ul>
      ) : null}
      {selectedId ? (
        <button
          type="button"
          className="mt-1 text-[11px] text-zinc-500 underline-offset-2 hover:text-zinc-300 hover:underline"
          onClick={() => selectItem(null)}
        >
          Clear link
        </button>
      ) : null}
    </div>
  );
}

export function buildUserLinkItems(users: { id: string; name: string | null; email: string | null }[]): EstimateLinkItem[] {
  return users.map((u) => {
    const label = `${u.name ?? "Unnamed"} · ${u.email ?? "—"}`;
    return {
      id: u.id,
      label,
      searchText: `${u.name ?? ""} ${u.email ?? ""} ${u.id}`.toLowerCase(),
    };
  });
}

export function buildOrderLinkItems(
  orders: {
    id: string;
    reference: string;
    user: { name: string | null; email: string | null } | null;
    car: { title: string } | null;
  }[],
): EstimateLinkItem[] {
  return orders.map((o) => {
    const label = `${o.reference} · ${o.car?.title ?? "No vehicle"} · ${o.user?.email ?? "—"}`;
    return {
      id: o.id,
      label,
      searchText: `${o.reference} ${o.car?.title ?? ""} ${o.user?.email ?? ""} ${o.user?.name ?? ""} ${o.id}`.toLowerCase(),
    };
  });
}

export function buildInquiryLinkItems(
  inquiries: {
    id: string;
    message: string;
    createdAt: Date;
    user: { name: string | null; email: string | null } | null;
  }[],
): EstimateLinkItem[] {
  return inquiries.map((i) => {
    const snippet = i.message.length > 96 ? `${i.message.slice(0, 96)}…` : i.message;
    const label = `${i.user?.email ?? "Guest"} · ${snippet}`;
    return {
      id: i.id,
      label,
      searchText: `${i.message} ${i.user?.email ?? ""} ${i.user?.name ?? ""} ${i.id} ${i.createdAt.toISOString().slice(0, 10)}`.toLowerCase(),
    };
  });
}

export function buildCarLinkItems(cars: { id: string; title: string; year: number }[]): EstimateLinkItem[] {
  return cars.map((c) => ({
    id: c.id,
    label: `${c.title} · ${c.year}`,
    searchText: `${c.title} ${c.year} ${c.id}`.toLowerCase(),
  }));
}
