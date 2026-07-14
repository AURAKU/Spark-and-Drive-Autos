"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Motorcycle, MotorcycleSpecification } from "@prisma/client";
import { CarListingState, EngineType, MotorcycleType, SourceType } from "@prisma/client";
import { toast } from "sonner";

import {
  archiveMotorcycle,
  deleteMotorcycle,
  duplicateMotorcycle,
  publishMotorcycle,
  unpublishMotorcycle,
  updateMotorcycle,
} from "@/actions/motorcycles";
import { AutofillUnmappedHint } from "@/components/admin/autofill-unmapped-hint";
import { MotorcycleSpecsEditor } from "@/components/admin/motorcycles/motorcycle-specs-editor";
import { PasteSummaryAutofill } from "@/components/admin/paste-summary-autofill";
import { Button } from "@/components/ui/button";
import {
  AUTOFILL_TOAST_REVIEW,
  getFormCheckboxChecked,
  getFormControlString,
  setFormControlString,
  shouldApplyAutofillCheckbox,
  shouldApplyAutofillEnum,
  shouldApplyAutofillNumber,
  shouldApplyAutofillText,
  shouldApplyListingPrice,
} from "@/lib/admin-summary-autofill";
import {
  MOTORCYCLE_FEATURE_TAGS,
  MOTORCYCLE_HIGHLIGHT_TAGS,
} from "@/lib/motorcycle-spec-parser";
import type { MotorcycleSpecRowInput } from "@/lib/motorcycle-specs";
import {
  parseMotorcycleSummaryForAutofill,
  previewRowsFromMotorcycleParse,
} from "@/lib/motorcycle-summary-autofill";

type Props = {
  motorcycle: Motorcycle & { specs?: MotorcycleSpecification[] };
};

export function MotorcycleEditForm({ motorcycle }: Props) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState(false);
  const [autofillUnmapped, setAutofillUnmapped] = useState<string[]>([]);
  const [features, setFeatures] = useState<string[]>(
    Array.isArray(motorcycle.featureTags) ? (motorcycle.featureTags as string[]) : [],
  );
  const [highlights, setHighlights] = useState<string[]>(
    Array.isArray(motorcycle.highlightTags) ? (motorcycle.highlightTags as string[]) : [],
  );
  const [specRows, setSpecRows] = useState<MotorcycleSpecRowInput[]>(() =>
    (motorcycle.specs ?? []).map((s) => ({
      groupName: s.groupName ?? "",
      label: s.label,
      value: s.value,
      unit: s.unit ?? "",
      sortOrder: s.sortOrder,
      isPublic: s.isPublic !== false,
    })),
  );

  const baselineRef = useRef({
    brand: motorcycle.brand,
    model: motorcycle.model,
    year: String(motorcycle.year),
    mileage: String(motorcycle.mileage ?? 0),
    condition: motorcycle.condition ?? "",
    longDescription: motorcycle.longDescription ?? "",
    transmission: motorcycle.transmission ?? "",
    color: motorcycle.color ?? "",
    location: motorcycle.location ?? "",
    engineCc: motorcycle.engineCc != null ? String(motorcycle.engineCc) : "",
    torque: motorcycle.torque ?? "",
    horsepower: motorcycle.horsepower != null ? String(motorcycle.horsepower) : "",
    weightKg: motorcycle.weightKg != null ? String(motorcycle.weightKg) : "",
    tyreSize: motorcycle.tyreSize ?? "",
    basePriceAmount: String(Number(motorcycle.basePriceAmount)),
    engineType: motorcycle.engineType,
    motorcycleType: motorcycle.motorcycleType,
    sourceType: motorcycle.sourceType,
    listingState: motorcycle.listingState,
  });

  const inputCls =
    "mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm dark:border-white/15 dark:bg-black/40";

  async function applyMotorcycleSummary(raw: string, opts?: { overwrite?: boolean }) {
    const overwrite = opts?.overwrite ?? false;
    const trimmed = raw.trim();
    if (!trimmed) {
      setAutofillUnmapped([]);
      toast.error("Paste or type something in the summary box first.");
      return;
    }
    const parsed = parseMotorcycleSummaryForAutofill(trimmed);
    setAutofillUnmapped(parsed.unmappedConcepts);
    const form = formRef.current;
    if (!form) return;
    const b = baselineRef.current;

    if (
      parsed.listingPrice &&
      shouldApplyListingPrice(
        getFormControlString(form, "basePriceAmount"),
        b.basePriceAmount,
        parsed.listingPrice,
        overwrite,
      )
    ) {
      setFormControlString(form, "basePriceAmount", String(parsed.listingPrice.amount));
      setFormControlString(form, "basePriceCurrency", parsed.listingPrice.currency);
    }

    const textMap: [string, string | undefined][] = [
      ["brand", parsed.stringFields.brand?.value],
      ["model", parsed.stringFields.model?.value],
      ["condition", parsed.stringFields.condition?.value],
      ["longDescription", parsed.stringFields.longDescription?.value],
      ["transmission", parsed.stringFields.transmission?.value],
      ["driveType", parsed.stringFields.driveType?.value],
      ["color", parsed.stringFields.color?.value],
      ["location", parsed.stringFields.location?.value],
      ["vin", parsed.stringFields.vin?.value],
      ["frameNumber", parsed.stringFields.frameNumber?.value],
      ["torque", parsed.stringFields.torque?.value],
      ["tyreSize", parsed.stringFields.tyreSize?.value],
      ["warranty", parsed.stringFields.warranty?.value],
      ["variant", parsed.stringFields.variant?.value],
      ["coolingType", parsed.stringFields.coolingType?.value],
      ["fuelTankCapacity", parsed.stringFields.fuelTankCapacity?.value],
      ["batteryCapacity", parsed.stringFields.batteryCapacity?.value],
      ["motorPower", parsed.stringFields.motorPower?.value],
      ["electricRange", parsed.stringFields.electricRange?.value],
      ["chargingTime", parsed.stringFields.chargingTime?.value],
      ["wheelSize", parsed.stringFields.wheelSize?.value],
      ["estimatedDelivery", parsed.stringFields.estimatedDelivery?.value],
      ["inspectionStatus", parsed.stringFields.inspectionStatus?.value],
    ];

    for (const [name, value] of textMap) {
      if (!value) continue;
      const field = parsed.stringFields[name];
      const proposed = field ?? { value, confidence: "explicit" as const };
      if (
        shouldApplyAutofillText(
          getFormControlString(form, name),
          (b as Record<string, string>)[name] ?? "",
          proposed,
          overwrite,
        )
      ) {
        setFormControlString(form, name, value);
      }
    }

    const numMap: [string, typeof parsed.numberFields.year][] = [
      ["year", parsed.numberFields.year],
      ["mileage", parsed.numberFields.mileage],
      ["engineCc", parsed.numberFields.engineCc],
      ["horsepower", parsed.numberFields.horsepower],
      ["weightKg", parsed.numberFields.weightKg],
      ["seatHeight", parsed.numberFields.seatHeight],
      ["topSpeedKmh", parsed.numberFields.topSpeedKmh],
    ];
    for (const [name, field] of numMap) {
      if (
        field &&
        shouldApplyAutofillNumber(
          getFormControlString(form, name),
          (b as Record<string, string>)[name] ?? "",
          field,
          overwrite,
        )
      ) {
        setFormControlString(form, name, String(field.value));
      }
    }

    if (
      parsed.engineTypeEnum &&
      shouldApplyAutofillEnum(
        getFormControlString(form, "engineType"),
        b.engineType,
        parsed.engineTypeEnum,
        overwrite,
      )
    ) {
      setFormControlString(form, "engineType", parsed.engineTypeEnum.value);
    }
    if (
      parsed.motorcycleTypeEnum &&
      shouldApplyAutofillEnum(
        getFormControlString(form, "motorcycleType"),
        b.motorcycleType,
        parsed.motorcycleTypeEnum,
        overwrite,
      )
    ) {
      setFormControlString(form, "motorcycleType", parsed.motorcycleTypeEnum.value);
    }
    if (
      parsed.sourceTypeEnum &&
      shouldApplyAutofillEnum(
        getFormControlString(form, "sourceType"),
        b.sourceType,
        parsed.sourceTypeEnum,
        overwrite,
      )
    ) {
      setFormControlString(form, "sourceType", parsed.sourceTypeEnum.value);
    }
    if (
      parsed.listingStateEnum &&
      shouldApplyAutofillEnum(
        getFormControlString(form, "listingState"),
        b.listingState,
        parsed.listingStateEnum,
        overwrite,
      )
    ) {
      setFormControlString(form, "listingState", parsed.listingStateEnum.value);
    }
    if (
      parsed.featured &&
      shouldApplyAutofillCheckbox(getFormCheckboxChecked(form, "featured"), motorcycle.featured, parsed.featured, overwrite)
    ) {
      setFormControlString(form, "featured", parsed.featured.value ? "on" : "");
    }

    if (parsed.stringFields.featureTags?.value) {
      const tags = parsed.stringFields.featureTags.value.split(/[,;]/).map((t) => t.trim()).filter(Boolean);
      if (tags.length && (overwrite || features.length === 0)) setFeatures(tags);
    }

    if (parsed.specLines.length > 0) {
      const incoming: MotorcycleSpecRowInput[] = parsed.specLines.map((s, i) => ({
        groupName: s.groupName ?? "",
        label: s.label,
        value: s.value,
        sortOrder: i,
        isPublic: true,
      }));
      if (overwrite || specRows.length === 0) {
        setSpecRows(incoming);
      } else {
        const existingLabels = new Set(specRows.map((r) => r.label.toLowerCase()));
        setSpecRows([
          ...specRows,
          ...incoming.filter((r) => !existingLabels.has(r.label.toLowerCase())),
        ]);
      }
    }

    toast.success(AUTOFILL_TOAST_REVIEW);
  }

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
    toast.success("Motorcycle saved.");
    router.refresh();
  }

  function toggleTag(list: string[], setList: (v: string[]) => void, tag: string) {
    setList(list.includes(tag) ? list.filter((t) => t !== tag) : [...list, tag]);
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="mt-8 space-y-8">
      <PasteSummaryAutofill
        buildPreviewRows={(t) => previewRowsFromMotorcycleParse(parseMotorcycleSummaryForAutofill(t))}
        onApply={applyMotorcycleSummary}
        placeholder="Paste motorcycle summary: Make Yamaha, Model MT-07, Year 2024, Engine CC 689, Price GHS 95000, Torque 68 Nm…"
      />
      <AutofillUnmappedHint items={autofillUnmapped} />

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
          Variant
          <input name="variant" defaultValue={motorcycle.variant ?? ""} className={inputCls} />
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
        <label className="text-xs text-muted-foreground">
          Display location
          <input name="location" defaultValue={motorcycle.location ?? ""} className={inputCls} />
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
        <label className="flex items-center gap-2 text-xs text-muted-foreground sm:mt-6">
          <input name="featured" type="checkbox" defaultChecked={motorcycle.featured} />
          Featured listing
        </label>
        <label className="text-xs text-muted-foreground">
          Slug
          <input name="slug" defaultValue={motorcycle.slug} className={inputCls} />
        </label>
        <label className="text-xs text-muted-foreground">
          Sea freight (GHS)
          <input
            name="seaShippingFeeGhs"
            type="number"
            defaultValue={motorcycle.seaShippingFeeGhs != null ? Number(motorcycle.seaShippingFeeGhs) : ""}
            className={inputCls}
          />
        </label>
      </div>

      <details className="rounded-lg border border-border p-4 dark:border-white/10" open>
        <summary className="cursor-pointer text-sm font-medium">Technical specifications</summary>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-xs">Engine CC<input name="engineCc" type="number" defaultValue={motorcycle.engineCc ?? ""} className={inputCls} /></label>
          <label className="text-xs">Horsepower<input name="horsepower" type="number" defaultValue={motorcycle.horsepower ?? ""} className={inputCls} /></label>
          <label className="text-xs">Torque<input name="torque" defaultValue={motorcycle.torque ?? ""} className={inputCls} /></label>
          <label className="text-xs">Transmission<input name="transmission" defaultValue={motorcycle.transmission ?? ""} className={inputCls} /></label>
          <label className="text-xs">Drive type<input name="driveType" defaultValue={motorcycle.driveType ?? ""} className={inputCls} /></label>
          <label className="text-xs">Color<input name="color" defaultValue={motorcycle.color ?? ""} className={inputCls} /></label>
          <label className="text-xs">Weight (kg)<input name="weightKg" type="number" defaultValue={motorcycle.weightKg ?? ""} className={inputCls} /></label>
          <label className="text-xs">Seat height (mm)<input name="seatHeight" type="number" defaultValue={motorcycle.seatHeight ?? ""} className={inputCls} /></label>
          <label className="text-xs">Wheel size<input name="wheelSize" defaultValue={motorcycle.wheelSize ?? ""} className={inputCls} /></label>
          <label className="text-xs">Tyre size<input name="tyreSize" defaultValue={motorcycle.tyreSize ?? ""} className={inputCls} /></label>
          <label className="text-xs">Top speed (km/h)<input name="topSpeedKmh" type="number" defaultValue={motorcycle.topSpeedKmh ?? ""} className={inputCls} /></label>
          <label className="text-xs">Cooling<input name="coolingType" defaultValue={motorcycle.coolingType ?? ""} className={inputCls} /></label>
          <label className="text-xs">Fuel tank<input name="fuelTankCapacity" defaultValue={motorcycle.fuelTankCapacity ?? ""} className={inputCls} /></label>
          <label className="text-xs">Warranty<input name="warranty" defaultValue={motorcycle.warranty ?? ""} className={inputCls} /></label>
          <label className="text-xs">VIN<input name="vin" defaultValue={motorcycle.vin ?? ""} className={inputCls} /></label>
          <label className="text-xs">Frame number<input name="frameNumber" defaultValue={motorcycle.frameNumber ?? ""} className={inputCls} /></label>
          <label className="text-xs">Engine number<input name="engineNumber" defaultValue={motorcycle.engineNumber ?? ""} className={inputCls} /></label>
          <label className="text-xs">Battery capacity<input name="batteryCapacity" defaultValue={motorcycle.batteryCapacity ?? ""} className={inputCls} /></label>
          <label className="text-xs">Motor power<input name="motorPower" defaultValue={motorcycle.motorPower ?? ""} className={inputCls} /></label>
          <label className="text-xs">Electric range<input name="electricRange" defaultValue={motorcycle.electricRange ?? ""} className={inputCls} /></label>
          <label className="text-xs">Charging time<input name="chargingTime" defaultValue={motorcycle.chargingTime ?? ""} className={inputCls} /></label>
        </div>
      </details>

      <MotorcycleSpecsEditor rows={specRows} onRowsChange={setSpecRows} />

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

      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save changes"}
        </button>
        {motorcycle.listingState === CarListingState.PUBLISHED ? (
          <Button
            type="button"
            variant="secondary"
            disabled={pending}
            onClick={async () => {
              const r = await unpublishMotorcycle(motorcycle.id);
              if (r.error) toast.error(r.error);
              else {
                toast.success("Unpublished");
                router.refresh();
              }
            }}
          >
            Unpublish
          </Button>
        ) : (
          <Button
            type="button"
            variant="secondary"
            disabled={pending}
            onClick={async () => {
              const r = await publishMotorcycle(motorcycle.id);
              if (r.error) toast.error(r.error);
              else {
                toast.success("Published");
                router.refresh();
              }
            }}
          >
            Publish
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={async () => {
            const r = await archiveMotorcycle(motorcycle.id);
            if (r.error) toast.error(r.error);
            else {
              toast.success("Archived (hidden)");
              router.refresh();
            }
          }}
        >
          Archive
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={async () => {
            const r = await duplicateMotorcycle(motorcycle.id);
            if (r.error) toast.error(r.error);
            else if (r.id) {
              toast.success("Duplicated");
              router.push(`/admin/motorcycles/${r.id}/edit`);
            }
          }}
        >
          Duplicate
        </Button>
        <Button
          type="button"
          variant="destructive"
          disabled={pending}
          onClick={async () => {
            if (!confirmDel) {
              setConfirmDel(true);
              toast.message("Click again to permanently delete.");
              return;
            }
            const r = await deleteMotorcycle(motorcycle.id);
            if (r.error) {
              toast.error(r.error);
              setConfirmDel(false);
            } else {
              toast.success("Deleted");
              router.push("/admin/motorcycles");
            }
          }}
        >
          {confirmDel ? "Confirm delete" : "Delete"}
        </Button>
      </div>
    </form>
  );
}
