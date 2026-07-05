"use client";

import {
  CAR_COMPARE_MAX,
  CAR_COMPARE_STORAGE_KEY,
  type CarCompareEntry,
} from "@/lib/car-compare";

function readRaw(): CarCompareEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CAR_COMPARE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is CarCompareEntry =>
          item != null &&
          typeof item === "object" &&
          typeof (item as CarCompareEntry).id === "string" &&
          typeof (item as CarCompareEntry).slug === "string" &&
          typeof (item as CarCompareEntry).title === "string",
      )
      .slice(0, CAR_COMPARE_MAX);
  } catch {
    return [];
  }
}

function writeRaw(entries: CarCompareEntry[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CAR_COMPARE_STORAGE_KEY, JSON.stringify(entries.slice(0, CAR_COMPARE_MAX)));
  window.dispatchEvent(new CustomEvent("sda-car-compare-change"));
}

export function loadCarCompareList(): CarCompareEntry[] {
  return readRaw();
}

export function isCarInCompareList(carId: string, list = readRaw()): boolean {
  return list.some((e) => e.id === carId);
}

export type ToggleCompareResult =
  | { ok: true; action: "added" | "removed"; list: CarCompareEntry[] }
  | { ok: false; reason: "full"; list: CarCompareEntry[] };

export function toggleCarCompareEntry(entry: CarCompareEntry): ToggleCompareResult {
  const list = readRaw();
  const idx = list.findIndex((e) => e.id === entry.id);
  if (idx >= 0) {
    const next = list.filter((e) => e.id !== entry.id);
    writeRaw(next);
    return { ok: true, action: "removed", list: next };
  }
  if (list.length >= CAR_COMPARE_MAX) {
    return { ok: false, reason: "full", list };
  }
  const next = [...list, entry];
  writeRaw(next);
  return { ok: true, action: "added", list: next };
}

export function removeCarFromCompareList(carId: string): CarCompareEntry[] {
  const next = readRaw().filter((e) => e.id !== carId);
  writeRaw(next);
  return next;
}

export function clearCarCompareList(): void {
  writeRaw([]);
}
