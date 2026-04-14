"use client";

import { ShoppingCart } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

type Props = {
  className?: string;
};

type CartChangedEvent = CustomEvent<{ count?: number }>;

export function CartIconButton({ className = "" }: Props) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let mounted = true;

    async function loadCount() {
      const res = await fetch("/api/parts/cart/items", { cache: "no-store" });
      const data = (await res.json().catch(() => ({}))) as { count?: number };
      if (!mounted) return;
      setCount(typeof data.count === "number" ? data.count : 0);
    }

    function onChanged(ev: Event) {
      const detail = (ev as CartChangedEvent).detail;
      if (typeof detail?.count === "number") {
        setCount(detail.count);
        return;
      }
      void loadCount();
    }

    void loadCount();
    window.addEventListener("parts-cart:changed", onChanged);
    return () => {
      mounted = false;
      window.removeEventListener("parts-cart:changed", onChanged);
    };
  }, []);

  return (
    <Link href="/parts/cart" aria-label="Open cart" title="Open cart" className={`relative inline-flex items-center justify-center ${className}`}>
      <ShoppingCart className="size-4.5" aria-hidden />
      {count > 0 ? (
        <span className="absolute right-0 top-0 inline-flex min-w-5 -translate-y-1/2 translate-x-1/2 items-center justify-center rounded-full border-2 border-white bg-red-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white shadow-[0_8px_16px_-10px_rgba(239,68,68,1)]">
          {count > 99 ? "99+" : count}
        </span>
      ) : null}
      <span className="sr-only">Open cart</span>
    </Link>
  );
}
