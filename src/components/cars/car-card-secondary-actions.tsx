"use client";

import { GitCompare, Heart, Share2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";

type Props = {
  carId: string;
  carSlug: string;
  carTitle: string;
  shareUrl: string;
  isSignedIn: boolean;
  initialFavorite: boolean;
  className?: string;
};

const secondaryBtn =
  "inline-flex h-11 min-h-[44px] min-w-[44px] flex-1 items-center justify-center gap-1.5 rounded-xl border border-border bg-background/80 px-3 text-xs font-semibold text-foreground transition duration-250 ease-out hover:-translate-y-px hover:border-[var(--brand)]/35 hover:bg-muted/80 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] disabled:opacity-60 dark:border-[#2A313C] dark:bg-[#181C22]/80 dark:text-[#B7C0CC] dark:hover:bg-white/[0.06] group-hover/card:brightness-105";

export function CarCardSecondaryActions({
  carId,
  carSlug,
  carTitle,
  shareUrl,
  isSignedIn,
  initialFavorite,
  className,
}: Props) {
  const router = useRouter();
  const [favorite, setFavorite] = useState(initialFavorite);
  const [pending, setPending] = useState(false);
  const [shareBusy, setShareBusy] = useState(false);

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

  async function onShare() {
    if (shareBusy || typeof window === "undefined") return;
    setShareBusy(true);
    try {
      if (navigator.share) {
        try {
          await navigator.share({ title: carTitle, text: `${carTitle} — Spark and Drive Autos`, url: shareUrl });
          toast.success("Link shared.");
          return;
        } catch (err) {
          if (err instanceof Error && err.name === "AbortError") return;
        }
      }
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        toast.success("Link copied.");
        return;
      }
      window.prompt("Copy this link:", shareUrl);
    } catch {
      toast.error("Could not share or copy.");
    } finally {
      setShareBusy(false);
    }
  }

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      <button
        type="button"
        disabled={pending}
        aria-label={favorite ? "Remove vehicle from favorites" : "Save vehicle to favorites"}
        aria-pressed={favorite}
        title={favorite ? "Remove from favorites" : "Save to favorites"}
        className={cn(
          secondaryBtn,
          favorite &&
            "border-rose-400/50 bg-rose-500/10 text-rose-700 hover:border-rose-400/60 dark:text-rose-200",
        )}
        onClick={() => void toggleFavorite()}
      >
        <Heart className={cn("size-4 shrink-0", favorite && "fill-current")} aria-hidden />
        <span>{favorite ? "Saved" : "Save"}</span>
      </button>
      <Link
        href={`/cars/${carSlug}`}
        aria-label={`Compare specifications for ${carTitle}`}
        title="View full specifications"
        className={secondaryBtn}
      >
        <GitCompare className="size-4 shrink-0" aria-hidden />
        <span>Compare</span>
      </Link>
      <button
        type="button"
        disabled={shareBusy}
        aria-label={`Share ${carTitle}`}
        title="Share listing"
        className={secondaryBtn}
        onClick={() => void onShare()}
      >
        <Share2 className="size-4 shrink-0" aria-hidden />
        <span>Share</span>
      </button>
    </div>
  );
}
