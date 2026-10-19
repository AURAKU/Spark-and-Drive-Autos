"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";

type SuggestionProduct = {
  slug: string;
  title: string;
  oemNumber: string | null;
  stockLabel: string;
};

type Suggestions = {
  products: SuggestionProduct[];
  oems: { oemNumber: string; slug: string; title: string }[];
  categories: string[];
};

type Props = {
  initialQuery: string;
  hidden: Record<string, string>;
};

export function PartsCatalogSearch({ initialQuery, hidden }: Props) {
  const listId = useId();
  const [query, setQuery] = useState(initialQuery);
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestions | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      setSuggestions(null);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void fetch(`/api/parts/suggest?q=${encodeURIComponent(term)}`, { signal: controller.signal })
        .then(async (res) => {
          if (!res.ok) return null;
          return (await res.json()) as Suggestions;
        })
        .then((data) => {
          if (!controller.signal.aborted) setSuggestions(data);
        })
        .catch(() => {
          if (!controller.signal.aborted) setSuggestions(null);
        });
    }, 280);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query]);

  useEffect(() => {
    function onPointer(event: MouseEvent) {
      if (!boxRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, []);

  const hasSuggestions =
    suggestions != null &&
    (suggestions.products.length > 0 || suggestions.oems.length > 0 || suggestions.categories.length > 0);

  return (
    <div ref={boxRef} className="relative w-full">
      <form action="/parts" method="get" className="flex h-12 w-full items-center overflow-hidden rounded-xl border border-white/15 bg-black/50">
        {Object.entries(hidden).map(([key, value]) =>
          value ? <input key={key} type="hidden" name={key} value={value} /> : null,
        )}
        <label htmlFor="parts-q" className="sr-only">
          Search parts
        </label>
        <input
          id="parts-q"
          name="q"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search part name, OEM number, vehicle model…"
          autoComplete="off"
          role="combobox"
          aria-expanded={open && hasSuggestions}
          aria-controls={listId}
          className="h-full w-full bg-transparent px-4 text-sm text-white outline-none placeholder:text-zinc-400"
        />
        <button type="submit" className="h-full shrink-0 bg-[var(--brand)] px-4 text-sm font-semibold text-white">
          Search
        </button>
      </form>
      {open && hasSuggestions ? (
        <div
          id={listId}
          role="listbox"
          className="absolute z-20 mt-2 max-h-80 w-full overflow-auto rounded-xl border border-white/10 bg-zinc-950 p-2 shadow-xl"
        >
          {suggestions.products.length > 0 ? (
            <SuggestionGroup label="Products">
              {suggestions.products.map((product) => (
                <Link
                  key={product.slug}
                  href={`/parts/${product.slug}`}
                  className="block rounded-lg px-3 py-2 text-sm text-zinc-100 hover:bg-white/5"
                  onClick={() => setOpen(false)}
                >
                  <span className="font-medium">{product.title}</span>
                  <span className="mt-0.5 block text-xs text-zinc-400">
                    {product.oemNumber ? `OEM ${product.oemNumber} · ` : ""}
                    {product.stockLabel}
                  </span>
                </Link>
              ))}
            </SuggestionGroup>
          ) : null}
          {suggestions.oems.length > 0 ? (
            <SuggestionGroup label="OEM numbers">
              {suggestions.oems.map((row) => (
                <Link
                  key={`${row.slug}-${row.oemNumber}`}
                  href={`/parts/${row.slug}`}
                  className="block rounded-lg px-3 py-2 text-sm text-zinc-100 hover:bg-white/5"
                  onClick={() => setOpen(false)}
                >
                  {row.oemNumber}
                  <span className="mt-0.5 block text-xs text-zinc-400">{row.title}</span>
                </Link>
              ))}
            </SuggestionGroup>
          ) : null}
          {suggestions.categories.length > 0 ? (
            <SuggestionGroup label="Categories">
              {suggestions.categories.map((name) => (
                <Link
                  key={name}
                  href={`/parts?category=${encodeURIComponent(name)}`}
                  className="block rounded-lg px-3 py-2 text-sm text-zinc-100 hover:bg-white/5"
                  onClick={() => setOpen(false)}
                >
                  {name}
                </Link>
              ))}
            </SuggestionGroup>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function SuggestionGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="py-1">
      <p className="px-3 py-1 text-[10px] font-semibold tracking-wide text-zinc-500 uppercase">{label}</p>
      {children}
    </div>
  );
}
