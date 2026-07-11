"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import {
  buildComparePageHref,
  CAR_COMPARE_MAX,
  type CarCompareEntry,
} from "@/lib/car-compare";
import {
  clearCarCompareList,
  loadCarCompareList,
  removeCarFromCompareList,
  toggleCarCompareEntry,
} from "@/lib/car-compare-storage";

type CarCompareContextValue = {
  entries: CarCompareEntry[];
  isSelected: (carId: string) => boolean;
  toggle: (entry: CarCompareEntry) => {
    ok: boolean;
    action?: "added" | "removed";
    reason?: "full";
    list: CarCompareEntry[];
  };
  remove: (carId: string) => void;
  clear: () => void;
  compareHref: string | null;
  ready: boolean;
  max: number;
};

const CarCompareContext = createContext<CarCompareContextValue | null>(null);

export function CarCompareProvider({ children }: { children: React.ReactNode }) {
  const [entries, setEntries] = useState<CarCompareEntry[]>([]);
  const [ready, setReady] = useState(false);

  const sync = useCallback(() => {
    setEntries(loadCarCompareList());
    setReady(true);
  }, []);

  useEffect(() => {
    sync();
    const onChange = () => sync();
    window.addEventListener("sda-car-compare-change", onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener("sda-car-compare-change", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, [sync]);

  const isSelected = useCallback((carId: string) => entries.some((e) => e.id === carId), [entries]);

  const toggle = useCallback((entry: CarCompareEntry) => {
    const result = toggleCarCompareEntry(entry);
    setEntries(result.list);
    if (!result.ok) return { ok: false, reason: "full" as const, list: result.list };
    return { ok: true, action: result.action, list: result.list };
  }, []);

  const remove = useCallback((carId: string) => {
    setEntries(removeCarFromCompareList(carId));
  }, []);

  const clear = useCallback(() => {
    clearCarCompareList();
    setEntries([]);
  }, []);

  const compareHref = useMemo(() => {
    if (entries.length !== CAR_COMPARE_MAX) return null;
    return buildComparePageHref([entries[0]!.slug, entries[1]!.slug]);
  }, [entries]);

  const value = useMemo(
    () => ({
      entries,
      isSelected,
      toggle,
      remove,
      clear,
      compareHref,
      ready,
      max: CAR_COMPARE_MAX,
    }),
    [entries, isSelected, toggle, remove, clear, compareHref, ready],
  );

  return <CarCompareContext.Provider value={value}>{children}</CarCompareContext.Provider>;
}

export function useCarCompare() {
  const ctx = useContext(CarCompareContext);
  if (!ctx) throw new Error("useCarCompare must be used within CarCompareProvider");
  return ctx;
}

export function useCarCompareOptional() {
  return useContext(CarCompareContext);
}
