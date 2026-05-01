"use client";

import { AvailabilityStatus, CarListingState, EngineType, SourceType } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { createCar } from "@/actions/cars";
import { AutofillUnmappedHint } from "@/components/admin/autofill-unmapped-hint";
import { AdminVehicleListPriceField } from "@/components/admin/admin-vehicle-list-price-field";
import { AdminVehicleSupplierCostField } from "@/components/admin/admin-vehicle-supplier-cost-field";
import { PasteSummaryAutofill } from "@/components/admin/paste-summary-autofill";
import {
  DEFAULT_RESERVATION_DEPOSIT_MIN_GHS,
  DEFAULT_RESERVATION_DEPOSIT_PERCENT,
} from "@/lib/checkout-amount";
import type { DisplayCurrency } from "@/lib/currency";
import {
  AUTOFILL_TOAST_REVIEW,
  getFormCheckboxChecked,
  getFormControlString,
  parseCarSummaryForAutofill,
  previewRowsFromCarParse,
  setFormControlString,
  shouldApplyAutofillCheckbox,
  shouldApplyAutofillEnum,
  shouldApplyAutofillNumber,
  shouldApplyAutofillText,
  shouldApplyListingPrice,
} from "@/lib/admin-summary-autofill";
import { ENGINE_TYPE_ORDER, engineTypeLabel } from "@/lib/engine-type-ui";
import { AdminZodIssues } from "@/components/admin/admin-zod-issues";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type State = {
  ok?: boolean;
  id?: string;
  error?: string;
  warning?: string;
  issues?: { fieldErrors: Record<string, string[] | undefined>; formErrors: string[] };
} | null;

type NewCarFormProps = {
  /** When set, called after create instead of navigating away (e.g. modal on inventory page). */
  onCreated?: (id: string) => void;
};

export function NewCarForm({ onCreated }: NewCarFormProps) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action] = useActionState(createCar, null as State);
  const [listingPriceKey, setListingPriceKey] = useState(0);
  const [supplierCostKey, setSupplierCostKey] = useState(0);
  const [priceAmountSeed, setPriceAmountSeed] = useState<number | undefined>(undefined);
  const [priceCurrencySeed, setPriceCurrencySeed] = useState<DisplayCurrency>("GHS");
  const [autofillUnmapped, setAutofillUnmapped] = useState<string[]>([]);

  useEffect(() => {
    if (state?.ok && state.id) {
      if (state.warning) toast.warning(state.warning);
      if (onCreated) {
        onCreated(state.id);
        return;
      }
      router.push(`/admin/cars/${state.id}/edit`);
    }
  }, [state, router, onCreated]);

  const select =
    "mt-1 h-10 w-full rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white outline-none ring-[var(--brand)]/30 focus:ring-2";

  const enumBaselineRef = useRef({
    engineType: EngineType.GASOLINE_PETROL as EngineType | string,
    sourceType: "" as string,
    availabilityStatus: "" as string,
    listingState: CarListingState.DRAFT as CarListingState | string,
  });

  useEffect(() => {
    const f = formRef.current;
    if (!f) return;
    const engineRaw = getFormControlString(f, "engineType");
    const listingRaw = getFormControlString(f, "listingState");
    enumBaselineRef.current = {
      engineType: (engineRaw as EngineType) || EngineType.GASOLINE_PETROL,
      sourceType: getFormControlString(f, "sourceType"),
      availabilityStatus: getFormControlString(f, "availabilityStatus"),
      listingState: (listingRaw as CarListingState) || CarListingState.DRAFT,
    };
  }, []);

  const TEXT_BASELINE: Record<string, string> = {
    title: "",
    brand: "",
    model: "",
    year: "",
    trim: "",
    bodyType: "",
    transmission: "",
    drivetrain: "",
    mileage: "",
    colorExterior: "",
    colorInterior: "",
    vin: "",
    condition: "",
    shortDescription: "",
    longDescription: "",
    engineDetails: "",
    inspectionStatus: "",
    estimatedDelivery: "",
    seaShippingFeeGhs: "",
    accidentHistory: "",
    tags: "",
    specifications: "",
    location: "",
    coverImageUrl: "",
    coverImagePublicId: "",
    supplierDealerName: "",
    supplierDealerPhone: "",
    supplierDealerReference: "",
    supplierDealerNotes: "",
    supplierCostAmount: "",
    reservationDepositPercent: "",
    basePriceAmount: "",
  };

  async function applyCarSummary(raw: string, opts?: { overwrite?: boolean }) {
    const overwrite = opts?.overwrite ?? false;
    const trimmed = raw.trim();
    if (!trimmed) {
      setAutofillUnmapped([]);
      toast.error("Paste or type something in the summary box first.");
      return;
    }
    const parsed = parseCarSummaryForAutofill(trimmed);
    setAutofillUnmapped(parsed.unmappedConcepts);
    const form = formRef.current;
    if (!form) return;

    let listing = parsed.listingPrice;
    const alt = parsed.listPriceAlternate;
    if (!listing && alt) {
      listing = {
        amount: alt.amount,
        currency: alt.currency === "RMB" ? "CNY" : alt.currency,
        confidence: alt.confidence,
      };
    }
    if (!listing && parsed.basePriceRmb) {
      listing = { amount: parsed.basePriceRmb.value, currency: "CNY", confidence: parsed.basePriceRmb.confidence };
    }

    if (
      listing &&
      shouldApplyListingPrice(getFormControlString(form, "basePriceAmount"), TEXT_BASELINE.basePriceAmount ?? "", listing, overwrite)
    ) {
      setPriceAmountSeed(listing.amount);
      setPriceCurrencySeed(listing.currency);
      setListingPriceKey((k) => k + 1);
    }

    if (parsed.supplierCost && shouldApplyListingPrice(
      getFormControlString(form, "supplierCostAmount"),
      TEXT_BASELINE.supplierCostAmount ?? "",
      parsed.supplierCost,
      overwrite,
    )) {
      setFormControlString(form, "supplierCostAmount", String(parsed.supplierCost.amount));
      setFormControlString(form, "supplierCostCurrency", parsed.supplierCost.currency);
      setSupplierCostKey((k) => k + 1);
    }

    const supLegacy = parsed.numberFields.supplierCostRmb;
    if (
      supLegacy &&
      shouldApplyAutofillNumber(
        getFormControlString(form, "supplierCostAmount"),
        TEXT_BASELINE.supplierCostAmount ?? "",
        supLegacy,
        overwrite,
      )
    ) {
      setFormControlString(form, "supplierCostAmount", String(supLegacy.value));
      setFormControlString(form, "supplierCostCurrency", "CNY");
      setSupplierCostKey((k) => k + 1);
    }

    const yr = parsed.numberFields.year;
    if (yr && shouldApplyAutofillNumber(getFormControlString(form, "year"), "", yr, overwrite)) {
      setFormControlString(form, "year", String(yr.value));
    }

    const mi = parsed.numberFields.mileage;
    if (mi && shouldApplyAutofillNumber(getFormControlString(form, "mileage"), "", mi, overwrite)) {
      setFormControlString(form, "mileage", String(mi.value));
    }

    if (
      parsed.engineTypeEnum &&
      shouldApplyAutofillEnum(
        getFormControlString(form, "engineType"),
        enumBaselineRef.current.engineType,
        {
          value: parsed.engineTypeEnum.value,
          confidence: parsed.engineTypeEnum.confidence,
        },
        overwrite,
      )
    ) {
      setFormControlString(form, "engineType", parsed.engineTypeEnum.value);
    }
    if (
      parsed.sourceTypeEnum &&
      shouldApplyAutofillEnum(
        getFormControlString(form, "sourceType"),
        enumBaselineRef.current.sourceType,
        {
          value: parsed.sourceTypeEnum.value,
          confidence: parsed.sourceTypeEnum.confidence,
        },
        overwrite,
      )
    ) {
      setFormControlString(form, "sourceType", parsed.sourceTypeEnum.value);
    }
    if (
      parsed.availabilityEnum &&
      shouldApplyAutofillEnum(
        getFormControlString(form, "availabilityStatus"),
        enumBaselineRef.current.availabilityStatus,
        { value: parsed.availabilityEnum.value, confidence: parsed.availabilityEnum.confidence },
        overwrite,
      )
    ) {
      setFormControlString(form, "availabilityStatus", parsed.availabilityEnum.value);
    }
    if (
      parsed.listingStateEnum &&
      shouldApplyAutofillEnum(
        getFormControlString(form, "listingState"),
        enumBaselineRef.current.listingState,
        {
          value: parsed.listingStateEnum.value,
          confidence: parsed.listingStateEnum.confidence,
        },
        overwrite,
      )
    ) {
      setFormControlString(form, "listingState", parsed.listingStateEnum.value);
    }

    if (
      parsed.featured &&
      shouldApplyAutofillCheckbox(getFormCheckboxChecked(form, "featured"), false, parsed.featured, overwrite)
    ) {
      setFormControlString(form, "featured", parsed.featured.value ? "on" : "");
    }

    for (const [key, proposed] of Object.entries(parsed.stringFields)) {
      if (!proposed?.value) continue;
      const initial = TEXT_BASELINE[key] ?? "";
      const current = getFormControlString(form, key);
      if (shouldApplyAutofillText(current, initial, proposed, overwrite)) {
        setFormControlString(form, key, proposed.value);
      }
    }

    toast.info(AUTOFILL_TOAST_REVIEW);
  }

  return (
    <form ref={formRef} action={action} className="mt-8 grid max-w-3xl gap-4 sm:grid-cols-2">
      {state?.error && <p className="sm:col-span-2 text-sm text-red-400">{state.error}</p>}
      <AdminZodIssues issues={state?.issues} />

      <div className="sm:col-span-2 rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <PasteSummaryAutofill
          buildPreviewRows={(t) => previewRowsFromCarParse(parseCarSummaryForAutofill(t))}
          onApply={(t, o) => void applyCarSummary(t, o)}
        />
        <AutofillUnmappedHint items={autofillUnmapped} />
        <p className="mt-2 text-xs text-zinc-500">
          Use labeled lines for precise fields (e.g. <span className="font-mono text-zinc-400">VIN:</span>,{" "}
          <span className="font-mono text-zinc-400">price RMB:</span>, <span className="font-mono text-zinc-400">price GHS:</span>
          ). Comma-separated snippets fill make/model/year, mileage, transmission, and color when detected. GHS/USD prices convert
          to canonical RMB using admin FX rates.
        </p>
      </div>

      <p className="sm:col-span-2 text-xs font-medium tracking-wide text-zinc-500 uppercase">Identity</p>
      <div className="sm:col-span-2">
        <Label htmlFor="title">Title</Label>
        <Input id="title" name="title" required className="mt-1" />
      </div>
      <div>
        <Label htmlFor="brand">Brand</Label>
        <Input id="brand" name="brand" required className="mt-1" />
      </div>
      <div>
        <Label htmlFor="model">Model</Label>
        <Input id="model" name="model" required className="mt-1" />
      </div>
      <div>
        <Label htmlFor="year">Year</Label>
        <Input id="year" name="year" type="number" required className="mt-1" />
      </div>
      <div>
        <Label htmlFor="trim">Trim</Label>
        <Input id="trim" name="trim" className="mt-1" />
      </div>
      <div>
        <Label htmlFor="bodyType">Body type</Label>
        <Input id="bodyType" name="bodyType" placeholder="SUV, Sedan…" className="mt-1" />
      </div>

      <p className="sm:col-span-2 mt-2 text-xs font-medium tracking-wide text-zinc-500 uppercase">Mechanical</p>
      <div>
        <Label htmlFor="engineType">Engine type</Label>
        <select id="engineType" name="engineType" className={select} required defaultValue={EngineType.GASOLINE_PETROL}>
          {ENGINE_TYPE_ORDER.map((v) => (
            <option key={v} value={v}>
              {engineTypeLabel(v)}
            </option>
          ))}
        </select>
      </div>
      <div>
        <Label htmlFor="transmission">Transmission</Label>
        <Input id="transmission" name="transmission" placeholder="Automatic, CVT…" className="mt-1" />
      </div>
      <div>
        <Label htmlFor="drivetrain">Drivetrain</Label>
        <Input id="drivetrain" name="drivetrain" placeholder="FWD, AWD…" className="mt-1" />
      </div>
      <div>
        <Label htmlFor="mileage">Mileage (km)</Label>
        <Input id="mileage" name="mileage" type="number" min={0} className="mt-1" />
      </div>

      <p className="sm:col-span-2 mt-2 text-xs font-medium tracking-wide text-zinc-500 uppercase">Appearance &amp; ID</p>
      <div>
        <Label htmlFor="colorExterior">Exterior color</Label>
        <Input id="colorExterior" name="colorExterior" className="mt-1" />
      </div>
      <div>
        <Label htmlFor="colorInterior">Interior color</Label>
        <Input id="colorInterior" name="colorInterior" className="mt-1" />
      </div>
      <div>
        <Label htmlFor="vin">VIN / chassis</Label>
        <Input id="vin" name="vin" className="mt-1" />
      </div>
      <div>
        <Label htmlFor="condition">Condition</Label>
        <Input id="condition" name="condition" placeholder="Excellent, good…" className="mt-1" />
      </div>

      <p className="sm:col-span-2 mt-2 text-xs font-medium tracking-wide text-zinc-500 uppercase">Commerce</p>
      <div>
        <Label htmlFor="sourceType">Source</Label>
        <select id="sourceType" name="sourceType" className={select} required>
          {Object.values(SourceType).map((v) => (
            <option key={v} value={v}>
              {v.replaceAll("_", " ")}
            </option>
          ))}
        </select>
      </div>
      <div>
        <Label htmlFor="availabilityStatus">Stock availability</Label>
        <select id="availabilityStatus" name="availabilityStatus" className={select} required>
          {Object.values(AvailabilityStatus).map((v) => (
            <option key={v} value={v}>
              {v.replaceAll("_", " ")}
            </option>
          ))}
        </select>
      </div>
      <div className="sm:col-span-2">
        <Label htmlFor="listingState">Listing visibility</Label>
        <select
          id="listingState"
          name="listingState"
          className={select}
          required
          defaultValue={CarListingState.DRAFT}
        >
          {Object.values(CarListingState).map((v) => (
            <option key={v} value={v}>
              {v.replaceAll("_", " ")}
            </option>
          ))}
        </select>
      </div>
      <AdminVehicleListPriceField
        key={`car-list-${listingPriceKey}`}
        label="Base selling price"
        description="Choose currency and amount. Reference GHS for checkout is derived from admin FX rates on save."
        defaultAmount={priceAmountSeed}
        defaultCurrency={priceCurrencySeed}
      />
      <div>
        <Label htmlFor="reservationDepositPercent">Reservation deposit (% of list price, GHS)</Label>
        <p className="mt-0.5 text-xs text-zinc-500">
          Optional. Leave blank for site default ({DEFAULT_RESERVATION_DEPOSIT_PERCENT}%, minimum ₵
          {DEFAULT_RESERVATION_DEPOSIT_MIN_GHS.toLocaleString("en-GH")}).
        </p>
        <Input
          id="reservationDepositPercent"
          name="reservationDepositPercent"
          type="number"
          step="0.01"
          min={0}
          max={100}
          className="mt-1"
          placeholder={`Default ${DEFAULT_RESERVATION_DEPOSIT_PERCENT}%`}
        />
      </div>
      <AdminVehicleSupplierCostField key={`car-sup-${supplierCostKey}`} />
      <p className="sm:col-span-2 text-xs text-zinc-500">
        The fields below are for internal traceability only. They are never shown on the public site.
      </p>
      <div>
        <Label htmlFor="supplierDealerName">Supplier or dealer name</Label>
        <Input id="supplierDealerName" name="supplierDealerName" className="mt-1" autoComplete="off" />
      </div>
      <div>
        <Label htmlFor="supplierDealerPhone">Supplier / dealer phone (reference)</Label>
        <Input id="supplierDealerPhone" name="supplierDealerPhone" type="tel" className="mt-1" autoComplete="off" />
      </div>
      <div>
        <Label htmlFor="supplierDealerReference">Dealer or listing reference</Label>
        <Input id="supplierDealerReference" name="supplierDealerReference" className="mt-1" placeholder="e.g. stock #, ad link" autoComplete="off" />
      </div>
      <div className="sm:col-span-2">
        <Label htmlFor="supplierDealerNotes">Notes to trace the deal</Label>
        <Textarea id="supplierDealerNotes" name="supplierDealerNotes" className="mt-1" rows={2} autoComplete="off" />
      </div>
      <div className="sm:col-span-2">
        <Label htmlFor="location">Location</Label>
        <Input id="location" name="location" className="mt-1" />
      </div>

      <p className="sm:col-span-2 mt-2 text-xs font-medium tracking-wide text-zinc-500 uppercase">Media (URLs)</p>
      <div className="sm:col-span-2">
        <Label htmlFor="coverImageUrl">Cover image URL</Label>
        <Input id="coverImageUrl" name="coverImageUrl" type="url" placeholder="https://..." className="mt-1" />
      </div>
      <div className="sm:col-span-2">
        <Label htmlFor="coverImagePublicId">Cover image Cloudinary public ID</Label>
        <p className="mt-0.5 text-xs text-zinc-500">Optional — used for destructive deletes from Cloudinary later.</p>
        <Input id="coverImagePublicId" name="coverImagePublicId" className="mt-1" />
      </div>

      <p className="sm:col-span-2 mt-2 text-xs font-medium tracking-wide text-zinc-500 uppercase">Copy</p>
      <div className="sm:col-span-2">
        <Label htmlFor="shortDescription">Short description</Label>
        <Textarea id="shortDescription" name="shortDescription" className="mt-1" rows={3} />
      </div>
      <div className="sm:col-span-2">
        <Label htmlFor="longDescription">Long description</Label>
        <Textarea id="longDescription" name="longDescription" className="mt-1" rows={6} />
      </div>
      <div className="sm:col-span-2">
        <Label htmlFor="engineDetails">Engine / technical notes</Label>
        <Textarea id="engineDetails" name="engineDetails" className="mt-1" rows={3} />
      </div>
      <div>
        <Label htmlFor="inspectionStatus">Inspection status</Label>
        <Input id="inspectionStatus" name="inspectionStatus" className="mt-1" />
      </div>
      <div>
        <Label htmlFor="estimatedDelivery">Estimated delivery window</Label>
        <Input id="estimatedDelivery" name="estimatedDelivery" placeholder="e.g. 4–6 weeks" className="mt-1" />
      </div>
      <div>
        <Label htmlFor="seaShippingFeeGhs">Sea shipping estimate (GHS)</Label>
        <Input
          id="seaShippingFeeGhs"
          name="seaShippingFeeGhs"
          type="number"
          min={0}
          step="0.01"
          placeholder="Optional — listing & checkout"
          className="mt-1"
        />
      </div>
      <div className="sm:col-span-2">
        <Label htmlFor="accidentHistory">Accident history</Label>
        <Textarea id="accidentHistory" name="accidentHistory" className="mt-1" rows={2} />
      </div>

      <p className="sm:col-span-2 mt-2 text-xs font-medium tracking-wide text-zinc-500 uppercase">Tags &amp; structured data</p>
      <div className="sm:col-span-2">
        <Label htmlFor="tags">Badges / tags</Label>
        <p className="mt-0.5 text-xs text-zinc-500">Comma-separated — e.g. Low mileage, One owner</p>
        <Input id="tags" name="tags" placeholder="Tag one, Tag two" className="mt-1" />
      </div>
      <div className="sm:col-span-2">
        <Label htmlFor="specifications">Specifications JSON</Label>
        <p className="mt-0.5 text-xs text-zinc-500">Object or array of label/value pairs — valid JSON only.</p>
        <Textarea
          id="specifications"
          name="specifications"
          className="mt-1 font-mono text-xs"
          rows={5}
          placeholder='{"Seats":"5","Warranty":"12 months"}'
        />
      </div>

      <div className="flex items-center gap-2 sm:col-span-2">
        <input id="featured" name="featured" type="checkbox" value="on" className="size-4" />
        <Label htmlFor="featured">Featured on homepage</Label>
      </div>
      <div className="sm:col-span-2">
        <Button type="submit">Create listing</Button>
      </div>
    </form>
  );
}
