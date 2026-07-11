"use client";

import { Loader2, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { useCarCompare } from "@/components/cars/car-compare-context";
import { VehicleCoverImage } from "@/components/cars/vehicle-cover-image";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { buildComparePageHref, toCarCompareEntry } from "@/lib/car-compare";

type PickerCar = {
  id: string;
  slug: string;
  title: string;
  brand: string;
  year: number;
  coverImageUrl: string | null;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CarComparePickerSheet({ open, onOpenChange }: Props) {
  const router = useRouter();
  const { entries, toggle, max } = useCarCompare();
  const [query, setQuery] = useState("");
  const [cars, setCars] = useState<PickerCar[]>([]);
  const [loading, setLoading] = useState(false);

  const excludeIds = entries.map((e) => e.id).join(",");
  const slotLabel = entries.length === 0 ? "first" : "second";

  const fetchCars = useCallback(
    async (search: string) => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (search.trim()) params.set("q", search.trim());
        if (excludeIds) params.set("exclude", excludeIds);
        params.set("limit", "16");
        const res = await fetch(`/api/cars/compare-search?${params.toString()}`);
        if (!res.ok) throw new Error("Could not load vehicles.");
        const json = (await res.json()) as { cars: PickerCar[] };
        setCars(json.cars ?? []);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not load vehicles.");
        setCars([]);
      } finally {
        setLoading(false);
      }
    },
    [excludeIds],
  );

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => {
      void fetchCars(query);
    }, query.trim() ? 250 : 0);
    return () => window.clearTimeout(timer);
  }, [open, query, fetchCars]);

  function selectCar(car: PickerCar) {
    const result = toggle(toCarCompareEntry(car));
    if (!result.ok && result.reason === "full") {
      toast.error("Compare list is full. Remove a vehicle first.");
      return;
    }
    onOpenChange(false);
    if (result.list.length >= max) {
      toast.success("Opening side-by-side comparison…");
      router.push(buildComparePageHref([result.list[0]!.slug, result.list[1]!.slug]));
      return;
    }
    toast.success(`Added as your ${slotLabel} vehicle. Pick one more to compare.`);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[85vh] overflow-hidden rounded-t-2xl px-4 pb-6">
        <SheetHeader className="text-left">
          <SheetTitle>Select vehicle to compare</SheetTitle>
          <SheetDescription>
            Choose the {slotLabel} vehicle from inventory. We will open a side-by-side view once both are selected.
          </SheetDescription>
        </SheetHeader>

        <div className="relative mt-4">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by brand, model, or title…"
            className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm dark:border-white/15"
          />
        </div>

        <div className="mt-4 max-h-[50vh] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Loading vehicles…
            </div>
          ) : cars.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">No matching vehicles found.</p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {cars.map((car) => (
                <li key={car.id}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 rounded-xl border border-border p-2 text-left transition hover:border-[var(--brand)]/40 hover:bg-muted/40 dark:border-white/10"
                    onClick={() => selectCar(car)}
                  >
                    <div className="relative size-14 shrink-0 overflow-hidden rounded-lg bg-muted">
                      {car.coverImageUrl ? (
                        <VehicleCoverImage src={car.coverImageUrl} alt="" fill sizes="56px" deliveryPreset="card" className="object-cover" />
                      ) : (
                        <div className="flex size-full items-center justify-center text-[10px] text-muted-foreground">No img</div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{car.title}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {car.brand} · {car.year}
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
