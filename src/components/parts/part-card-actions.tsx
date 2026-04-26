"use client";

import { Heart } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

type Props = {
  partId: string;
  partSlug: string;
  stockQty: number;
  isFavorite: boolean;
  canFavorite: boolean;
  /** When true, skip quick add and send shoppers to the detail page to pick variant options. */
  requiresOptions?: boolean;
};

export function PartCardActions({
  partId,
  partSlug,
  stockQty,
  isFavorite,
  canFavorite,
  requiresOptions = false,
}: Props) {
  const router = useRouter();
  const [fav, setFav] = useState(isFavorite);
  const [loading, setLoading] = useState(false);

  async function addToCart() {
    setLoading(true);
    try {
      const res = await fetch("/api/parts/cart/items", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ partId, quantity: 1 }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; count?: number; alreadyInCart?: boolean };
      if (res.status === 401) {
        router.push(`/login?callbackUrl=${encodeURIComponent(`/parts/${partSlug}`)}`);
        return;
      }
      if (!res.ok) {
        throw new Error(data.error ?? "Could not add to cart.");
      }
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("parts-cart:changed", { detail: { count: data.count } }));
      }
      if (data.alreadyInCart) {
        toast.info("Item already in cart. Increase quantity from your cart page.");
      } else {
        toast.success("Added to cart.");
      }
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add item.");
    } finally {
      setLoading(false);
    }
  }

  async function toggleFavorite() {
    if (!canFavorite) {
      router.push(`/login?callbackUrl=${encodeURIComponent(`/parts/${partSlug}`)}`);
      return;
    }
    const next = !fav;
    setFav(next);
    try {
      const res = await fetch(next ? "/api/parts/favorites" : `/api/parts/favorites?partId=${encodeURIComponent(partId)}`, {
        method: next ? "POST" : "DELETE",
        headers: next ? { "content-type": "application/json" } : undefined,
        body: next ? JSON.stringify({ partId }) : undefined,
      });
      if (!res.ok) throw new Error("Could not update favorites.");
      router.refresh();
      toast.success(next ? "Saved to favorites." : "Removed from favorites.");
    } catch {
      setFav(!next);
      toast.error("Could not update favorites.");
    }
  }

  const outOfStock = stockQty < 1;
  const canQuickAdd = !outOfStock && !requiresOptions;

  return (
    <div className="flex flex-col gap-2">
      {outOfStock ? (
        <p className="text-[11px] leading-snug text-amber-200/90">Out of stock — contact support for restock or alternatives.</p>
      ) : null}
      {requiresOptions && !outOfStock ? (
        <p className="text-[11px] text-zinc-500">Color, size, or type — open the product to choose options.</p>
      ) : null}
      <div className="flex items-center gap-2">
      {canQuickAdd ? (
      <button
        type="button"
        onClick={() => void addToCart()}
        disabled={loading}
        className="inline-flex h-9 items-center justify-center rounded-lg bg-[var(--brand)] px-3 text-sm font-semibold text-white shadow-[0_10px_20px_-14px_rgba(239,68,68,1)] transition hover:brightness-110 disabled:opacity-70"
      >
        Add to Cart
      </button>
      ) : !outOfStock && requiresOptions ? (
        <Link
          href={`/parts/${partSlug}`}
          className="inline-flex h-9 items-center justify-center rounded-lg bg-[var(--brand)] px-3 text-sm font-semibold text-white shadow-[0_10px_20px_-14px_rgba(239,68,1)] transition hover:brightness-110"
        >
          Choose options
        </Link>
      ) : null}
      <button
        type="button"
        aria-label={fav ? "Remove from favorites" : "Add to favorites"}
        title={fav ? "Remove from favorites" : "Add to favorites"}
        onClick={() => void toggleFavorite()}
        className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border transition ${
          fav
            ? "border-rose-400/70 bg-rose-400/20 text-rose-300"
            : "border-white/20 bg-white/[0.03] text-zinc-300 hover:bg-white/10"
        }`}
      >
        <Heart className={`size-4 ${fav ? "fill-current" : ""}`} />
      </button>
      <Link
        href={`/parts/${partSlug}`}
        className="inline-flex h-9 items-center justify-center rounded-lg border border-white/20 px-3 text-sm text-zinc-200 transition hover:bg-white/8"
      >
        {canQuickAdd ? "View" : "Details"}
      </Link>
      </div>
    </div>
  );
}
