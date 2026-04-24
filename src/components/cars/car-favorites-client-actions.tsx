"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";

type Props = {
  carId?: string;
  hasCarItems?: boolean;
};

export function CarFavoritesClientActions({ carId, hasCarItems = false }: Props) {
  const router = useRouter();

  async function removeOne() {
    if (!carId) return;
    const res = await fetch(`/api/cars/favorites?carId=${encodeURIComponent(carId)}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Could not remove saved vehicle.");
      return;
    }
    toast.success("Removed from saved vehicles.");
    router.refresh();
  }

  async function clearAllCars() {
    const res = await fetch("/api/cars/favorites?all=1", { method: "DELETE" });
    if (!res.ok) {
      toast.error("Could not clear saved vehicles.");
      return;
    }
    toast.success("All saved vehicles cleared.");
    router.refresh();
  }

  if (carId) {
    return (
      <button
        type="button"
        onClick={() => void removeOne()}
        className="inline-flex h-9 items-center rounded-lg border border-white/20 px-3 text-xs text-zinc-300 transition hover:bg-white/8"
      >
        Remove from saved
      </button>
    );
  }

  if (!hasCarItems) return null;

  return (
    <button
      type="button"
      onClick={() => void clearAllCars()}
      className="inline-flex h-9 items-center rounded-lg border border-white/20 px-3 text-xs text-zinc-300 transition hover:bg-white/8"
    >
      Clear all saved vehicles
    </button>
  );
}
