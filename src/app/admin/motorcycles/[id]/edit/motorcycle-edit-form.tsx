"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Motorcycle } from "@prisma/client";
import { CarListingState, EngineType, MotorcycleType, SourceType } from "@prisma/client";

import { updateMotorcycle } from "@/actions/motorcycles";
import {
  MOTORCYCLE_FEATURE_TAGS,
  MOTORCYCLE_HIGHLIGHT_TAGS,
} from "@/lib/motorcycle-spec-parser";

type Props = { motorcycle: Motorcycle };

export function MotorcycleEditForm({ motorcycle }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [features, setFeatures] = useState<string[]>(
    Array.isArray(motorcycle.featureTags) ? (motorcycle.featureTags as string[]) : [],
  );
  const [highlights, setHighlights] = useState<string[]>(
    Array.isArray(motorcycle.highlightTags) ? (motorcycle.highlightTags as string[]) : [],
  );

  const inputCls =
    "mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm dark:border-white/15 dark:bg-black/40";

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const fd = new FormData(e.currentTarget);
    fd.set("id", motorcycle.id);
    fd.set("featureTags", features.join(","));
    fd.set("highlightTags", highlights.join(","));
    const result = await updateMotorcycle(null, fd);
    setPending(false);
    if (result.error) {
      setError(typeof result.error === "string" ? result.error : "Could not save.");
      return;
    }
    router.refresh();
  }

  function toggleTag(list: string[], setList: (v: string[]) => void, tag: string) {
    setList(list.includes(tag) ? list.filter((t) => t !== tag) : [...list, tag]);
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-xs text-muted-foreground">
          Manufacturer *
          <input name="brand" required defaultValue={motorcycle.brand} className={inputCls} />
        </label>
        <label className="text-xs text-muted-foreground">
          Model *
          <input name="model" required defaultValue={motorcycle.model} className={inputCls} />
        </label>
        <label className="text-xs text-muted-foreground">
          Year *
          <input name="year" type="number" required defaultValue={motorcycle.year} className={inputCls} />
        </label>
        <label className="text-xs text-muted-foreground">
          Fuel type *
          <select name="engineType" required defaultValue={motorcycle.engineType} className={inputCls}>
            {Object.values(EngineType).map((t) => (
              <option key={t} value={t}>
                {t.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-muted-foreground">
          Motorcycle type *
          <select name="motorcycleType" required defaultValue={motorcycle.motorcycleType} className={inputCls}>
            {Object.values(MotorcycleType).map((t) => (
              <option key={t} value={t}>
                {t.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-muted-foreground">
          Mileage *
          <input name="mileage" type="number" required defaultValue={motorcycle.mileage ?? 0} className={inputCls} />
        </label>
        <label className="text-xs text-muted-foreground">
          Condition *
          <input name="condition" required defaultValue={motorcycle.condition ?? "Used"} className={inputCls} />
        </label>
        <label className="text-xs text-muted-foreground">
          Stock location *
          <select name="sourceType" required defaultValue={motorcycle.sourceType} className={inputCls}>
            <option value={SourceType.IN_CHINA}>China</option>
            <option value={SourceType.IN_GHANA}>Ghana</option>
            <option value={SourceType.IN_TRANSIT}>In transit</option>
          </select>
        </label>
        <label className="text-xs text-muted-foreground sm:col-span-2">
          Description *
          <textarea
            name="longDescription"
            required
            rows={4}
            defaultValue={motorcycle.longDescription ?? ""}
            className={inputCls}
          />
        </label>
        <label className="text-xs text-muted-foreground">
          Price *
          <input
            name="basePriceAmount"
            type="number"
            required
            defaultValue={Number(motorcycle.basePriceAmount)}
            className={inputCls}
          />
        </label>
        <label className="text-xs text-muted-foreground">
          Currency *
          <select name="basePriceCurrency" defaultValue={motorcycle.basePriceCurrency} className={inputCls}>
            <option value="USD">USD</option>
            <option value="GHS">GHS</option>
            <option value="CNY">CNY</option>
          </select>
        </label>
        <label className="text-xs text-muted-foreground">
          Reservation deposit %
          <input
            name="reservationDepositPercent"
            type="number"
            defaultValue={Number(motorcycle.reservationDepositPercent ?? 80)}
            className={inputCls}
          />
        </label>
        <label className="text-xs text-muted-foreground">
          Estimated delivery
          <input name="estimatedDelivery" defaultValue={motorcycle.estimatedDelivery ?? "35–45 Days"} className={inputCls} />
        </label>
        <label className="text-xs text-muted-foreground">
          Listing state
          <select name="listingState" defaultValue={motorcycle.listingState} className={inputCls}>
            {Object.values(CarListingState).map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-muted-foreground sm:col-span-2">
          Specifications (plain text)
          <textarea
            name="specificationsText"
            rows={5}
            defaultValue={motorcycle.specificationsText ?? ""}
            className={inputCls}
          />
        </label>
      </div>

      <div>
        <p className="text-xs font-medium text-muted-foreground">Feature tags</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {MOTORCYCLE_FEATURE_TAGS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => toggleTag(features, setFeatures, t)}
              className={`rounded-full border px-2 py-1 text-xs ${features.includes(t) ? "border-primary bg-primary/10" : "border-border"}`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs font-medium text-muted-foreground">Highlights</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {MOTORCYCLE_HIGHLIGHT_TAGS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => toggleTag(highlights, setHighlights, t)}
              className={`rounded-full border px-2 py-1 text-xs ${highlights.includes(t) ? "border-primary bg-primary/10" : "border-border"}`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}
