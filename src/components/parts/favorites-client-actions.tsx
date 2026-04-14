"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";

type Props = {
  partId?: string;
  hasItems?: boolean;
};

export function FavoritesClientActions({ partId, hasItems = false }: Props) {
  const router = useRouter();

  async function removeOne() {
    if (!partId) return;
    const res = await fetch(`/api/parts/favorites?partId=${encodeURIComponent(partId)}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Could not remove favorite.");
      return;
    }
    toast.success("Removed favorite.");
    router.refresh();
  }

  async function clearAll() {
    const res = await fetch("/api/parts/favorites?all=1", { method: "DELETE" });
    if (!res.ok) {
      toast.error("Could not clear favorites.");
      return;
    }
    toast.success("All favorites cleared.");
    router.refresh();
  }

  if (partId) {
    return (
      <button
        type="button"
        onClick={() => void removeOne()}
        className="inline-flex h-9 items-center rounded-lg border border-white/20 px-3 text-xs text-zinc-300 transition hover:bg-white/8"
      >
        Remove favorite
      </button>
    );
  }

  if (!hasItems) return null;

  return (
    <button
      type="button"
      onClick={() => void clearAll()}
      className="inline-flex h-9 items-center rounded-lg border border-white/20 px-3 text-xs text-zinc-300 transition hover:bg-white/8"
    >
      Remove all favorites
    </button>
  );
}
