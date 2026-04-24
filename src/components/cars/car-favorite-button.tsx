"use client";

import { Heart } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";

type Props = {
  carId: string;
  carSlug: string;
  isSignedIn: boolean;
  initialFavorite: boolean;
};

/**
 * Heart control for saving a vehicle to dashboard favorites (replaces ad-hoc WhatsApp CTA on listing detail).
 */
export function CarFavoriteButton({ carId, carSlug, isSignedIn, initialFavorite }: Props) {
  const router = useRouter();
  const [favorite, setFavorite] = useState(initialFavorite);
  const [pending, setPending] = useState(false);

  async function toggleFavorite() {
    if (!isSignedIn) {
      router.push(`/login?callbackUrl=${encodeURIComponent(`/cars/${carSlug}`)}`);
      return;
    }
    const next = !favorite;
    setFavorite(next);
    setPending(true);
    try {
      const res = await fetch(next ? "/api/cars/favorites" : `/api/cars/favorites?carId=${encodeURIComponent(carId)}`, {
        method: next ? "POST" : "DELETE",
        headers: next ? { "content-type": "application/json" } : undefined,
        body: next ? JSON.stringify({ carId }) : undefined,
      });
      if (!res.ok) throw new Error("Could not update favorites.");
      toast.success(next ? "Saved to your favorites." : "Removed from favorites.");
      router.refresh();
    } catch {
      setFavorite(!next);
      toast.error("Could not update favorites.");
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      disabled={pending}
      aria-label={favorite ? "Remove vehicle from favorites" : "Save vehicle to favorites"}
      aria-pressed={favorite}
      title={favorite ? "Remove from favorites" : "Save to favorites — view in dashboard"}
      className={cn(
        "inline-flex h-8 min-w-[2.75rem] items-center justify-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition disabled:opacity-60",
        favorite
          ? "border-rose-400/70 bg-rose-400/15 text-rose-200 hover:bg-rose-400/25 dark:text-rose-100"
          : "border-border bg-muted text-foreground hover:bg-muted/80 dark:border-white/15 dark:bg-white/10 dark:text-white dark:hover:bg-white/15",
      )}
      onClick={() => void toggleFavorite()}
    >
      <Heart className={cn("size-4 shrink-0", favorite && "fill-current")} aria-hidden />
      <span className="hidden sm:inline">{favorite ? "Saved" : "Save"}</span>
    </button>
  );
}
