"use client";

import { Share2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";

type Props = {
  /** Absolute URL to this page (e.g. https://example.com/cars/slug). */
  url: string;
  title?: string;
  text?: string;
  className?: string;
};

/**
 * Share or copy the current listing URL so recipients can open the same page.
 */
export function SharePageButton({ url, title, text, className }: Props) {
  const [busy, setBusy] = useState(false);

  async function onShare() {
    if (busy || typeof window === "undefined") return;
    setBusy(true);
    try {
      if (navigator.share) {
        try {
          await navigator.share({
            title: title ?? document.title,
            text: text ?? title,
            url,
          });
          toast.success("Link shared.");
          return;
        } catch (err) {
          if (err instanceof Error && err.name === "AbortError") return;
        }
      }
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        toast.success("Link copied. Paste it anywhere—opening it opens this page.");
        return;
      }
      window.prompt("Copy this link:", url);
    } catch {
      toast.error("Could not share or copy. Copy the address from your browser bar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => void onShare()}
      aria-label="Share link to this page"
      title="Share or copy link"
      className={cn(
        "inline-flex h-8 min-w-[2.75rem] items-center justify-center gap-1.5 rounded-lg border border-border bg-muted px-3 text-sm font-medium text-foreground transition hover:bg-muted/80 disabled:opacity-60 dark:border-white/15 dark:bg-white/10 dark:text-white dark:hover:bg-white/15",
        className,
      )}
    >
      <Share2 className="size-4 shrink-0" aria-hidden />
      <span className="hidden sm:inline">Share</span>
    </button>
  );
}
