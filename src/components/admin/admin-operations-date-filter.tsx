"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import type { OpsDateMode } from "@/lib/admin-operations-date-filter";

function localYmd(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function localYm(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/**
 * Calendar-style date filter for admin operations pages (payments intelligence, orders, shipping, duty).
 * Syncs to URL: opsDateMode, opsDateDay, opsDateMonth, opsDateYear.
 */
export function AdminOperationsDateFilter() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const urlMode = (searchParams.get("opsDateMode") as OpsDateMode | null) ?? "off";
  const urlDay = searchParams.get("opsDateDay") ?? localYmd();
  const urlMonth = searchParams.get("opsDateMonth") ?? localYm();
  const urlYear = searchParams.get("opsDateYear") ?? String(new Date().getFullYear());

  const [mode, setMode] = useState<OpsDateMode>(urlMode === "off" ? "off" : urlMode);
  const [day, setDay] = useState(urlDay);
  const [month, setMonth] = useState(urlMonth);
  const [year, setYear] = useState(urlYear);

  useEffect(() => {
    setMode(urlMode === "off" ? "off" : urlMode);
    setDay(urlDay);
    setMonth(urlMonth);
    setYear(urlYear);
  }, [urlMode, urlDay, urlMonth, urlYear]);

  const activeLabel = useMemo(() => {
    if (urlMode === "day" && /^\d{4}-\d{2}-\d{2}$/.test(searchParams.get("opsDateDay") ?? "")) {
      return `Day: ${searchParams.get("opsDateDay")}`;
    }
    if (urlMode === "month" && /^\d{4}-\d{2}$/.test(searchParams.get("opsDateMonth") ?? "")) {
      return `Month: ${searchParams.get("opsDateMonth")}`;
    }
    if (urlMode === "year" && /^\d{4}$/.test(searchParams.get("opsDateYear") ?? "")) {
      return `Year: ${searchParams.get("opsDateYear")}`;
    }
    return null;
  }, [searchParams, urlMode]);

  const apply = useCallback(() => {
    const next = new URLSearchParams(searchParams.toString());
    next.delete("opsDateMode");
    next.delete("opsDateDay");
    next.delete("opsDateMonth");
    next.delete("opsDateYear");

    if (mode === "off") {
      router.push(`${pathname}${next.toString() ? `?${next.toString()}` : ""}`);
      return;
    }

    next.set("opsDateMode", mode);
    if (mode === "day") {
      next.set("opsDateDay", day);
    } else if (mode === "month") {
      next.set("opsDateMonth", month);
    } else if (mode === "year") {
      next.set("opsDateYear", year.replace(/\D/g, "").slice(0, 4) || String(new Date().getFullYear()));
    }

    router.push(`${pathname}?${next.toString()}`);
  }, [day, mode, month, pathname, router, searchParams, year]);

  const clear = useCallback(() => {
    const next = new URLSearchParams(searchParams.toString());
    next.delete("opsDateMode");
    next.delete("opsDateDay");
    next.delete("opsDateMonth");
    next.delete("opsDateYear");
    setMode("off");
    router.push(`${pathname}${next.toString() ? `?${next.toString()}` : ""}`);
  }, [pathname, router, searchParams]);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium tracking-wide text-zinc-500 uppercase">Date filter</p>
          <p className="mt-1 text-sm text-zinc-400">
            Filter lists by calendar day, month, or year (UTC boundaries).{" "}
            {activeLabel ? <span className="text-[var(--brand)]">Active: {activeLabel}</span> : <span>Showing all dates.</span>}
          </p>
        </div>
        {activeLabel ? (
          <Button type="button" variant="outline" size="sm" className="border-white/15 text-xs" onClick={() => clear()}>
            Clear date
          </Button>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="text-[11px] text-zinc-500">Scope</label>
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as OpsDateMode)}
            className="mt-1 flex h-10 min-w-[140px] rounded-lg border border-white/15 bg-black/40 px-3 text-sm text-white"
          >
            <option value="off">All dates</option>
            <option value="day">Specific day</option>
            <option value="month">Month</option>
            <option value="year">Year</option>
          </select>
        </div>

        {mode === "day" ? (
          <div>
            <label className="text-[11px] text-zinc-500">Date</label>
            <input
              type="date"
              value={day}
              onChange={(e) => setDay(e.target.value)}
              className="mt-1 flex h-10 rounded-lg border border-white/15 bg-black/40 px-3 text-sm text-white [color-scheme:dark]"
            />
          </div>
        ) : null}

        {mode === "month" ? (
          <div>
            <label className="text-[11px] text-zinc-500">Month</label>
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="mt-1 flex h-10 rounded-lg border border-white/15 bg-black/40 px-3 text-sm text-white [color-scheme:dark]"
            />
          </div>
        ) : null}

        {mode === "year" ? (
          <div>
            <label className="text-[11px] text-zinc-500">Year</label>
            <input
              type="number"
              min={2000}
              max={2100}
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="mt-1 flex h-10 w-28 rounded-lg border border-white/15 bg-black/40 px-3 text-sm text-white"
            />
          </div>
        ) : null}

        <Button type="button" size="sm" className="bg-[var(--brand)] text-black hover:bg-[var(--brand)]/90" onClick={() => apply()}>
          Apply
        </Button>
      </div>
    </div>
  );
}
