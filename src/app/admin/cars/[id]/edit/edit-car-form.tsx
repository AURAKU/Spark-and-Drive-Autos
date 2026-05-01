"use client";

import { AvailabilityStatus, CarListingState, SourceType } from "@prisma/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { deleteCar, updateCar } from "@/actions/cars";
import { AdminRmbSellingPriceField } from "@/components/admin/admin-rmb-selling-price-field";
import { AdminZodIssues } from "@/components/admin/admin-zod-issues";
import { AutofillUnmappedHint } from "@/components/admin/autofill-unmapped-hint";
import { PasteSummaryAutofill } from "@/components/admin/paste-summary-autofill";
import {
  DEFAULT_RESERVATION_DEPOSIT_MIN_GHS,
  DEFAULT_RESERVATION_DEPOSIT_PERCENT,
} from "@/lib/checkout-amount";
import type { FxRatesInput } from "@/lib/currency";
import {
  AUTOFILL_TOAST_REVIEW,
  ghsAmountToCanonicalRmb,
  getFormCheckboxChecked,
  getFormControlString,
  parseCarSummaryForAutofill,
  setFormControlString,
  shouldApplyAutofillCheckbox,
  shouldApplyAutofillEnum,
  shouldApplyAutofillNumber,
  shouldApplyAutofillText,
  usdAmountToCanonicalRmb,
} from "@/lib/admin-summary-autofill";
import { profitAmountRmb, profitMarginPercent } from "@/lib/admin-profit";
import { tagsToCommaList, specificationsToTextarea } from "@/lib/car-form-helpers";
import { ENGINE_TYPE_ORDER, engineTypeLabel } from "@/lib/engine-type-ui";
import type { CarForClientEdit } from "@/lib/serialize-car";
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

export function EditCarForm({
  car,
  hasSuccessfulFullPayment = false,
}: {
  car: CarForClientEdit;
  hasSuccessfulFullPayment?: boolean;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action] = useActionState(updateCar, null as State);
  const [, startTransition] = useTransition();
  const [confirmDel, setConfirmDel] = useState(false);
  const [listingPriceKey, setListingPriceKey] = useState(0);
  const [priceRmbSeed, setPriceRmbSeed] = useState<number | undefined>(undefined);
  const [autofillUnmapped, setAutofillUnmapped] = useState<string[]>([]);

  useEffect(() => {
    if (state?.ok) {
      toast.success("Vehicle saved");
      router.refresh();
    }
  }, [state?.ok, router]);

  useEffect(() => {
    if (state?.warning) toast.warning(state.warning);
  }, [state?.warning]);

  const baseRmb = Number(car.basePriceRmb);
  const costRmb = car.supplierCostRmb;
  const profitRmb = profitAmountRmb(baseRmb, costRmb);
  const marginPct = profitMarginPercent(baseRmb, costRmb);
  const select =
    "mt-1 h-10 w-full rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white outline-none ring-[var(--brand)]/30 focus:ring-2";

  const fieldBaseline = useMemo(
    () => ({
      title: car.title,
      brand: car.brand,
      model: car.model,
      year: String(car.year),
      trim: car.trim ?? "",
      bodyType: car.bodyType ?? "",
      transmission: car.transmission ?? "",
      drivetrain: car.drivetrain ?? "",
      mileage: car.mileage != null ? String(car.mileage) : "",
      colorExterior: car.colorExterior ?? "",
      colorInterior: car.colorInterior ?? "",
      vin: car.vin ?? "",
      condition: car.condition ?? "",
      shortDescription: car.shortDescription ?? "",
      longDescription: car.longDescription ?? "",
      engineDetails: car.engineDetails ?? "",
      inspectionStatus: car.inspectionStatus ?? "",
      estimatedDelivery: car.estimatedDelivery ?? "",
      seaShippingFeeGhs: car.seaShippingFeeGhs != null ? String(car.seaShippingFeeGhs) : "",
      accidentHistory: car.accidentHistory ?? "",
      tags: tagsToCommaList(car.tags),
      specifications: specificationsToTextarea(car.specifications),
      location: car.location ?? "",
      coverImageUrl: car.coverImageUrl ?? "",
      coverImagePublicId: car.coverImagePublicId ?? "",
      supplierDealerName: car.supplierDealerName ?? "",
      supplierDealerPhone: car.supplierDealerPhone ?? "",
      supplierDealerReference: car.supplierDealerReference ?? "",
      supplierDealerNotes: car.supplierDealerNotes ?? "",
      supplierCostRmb: car.supplierCostRmb != null ? String(car.supplierCostRmb) : "",
      reservationDepositPercent:
        car.reservationDepositPercent != null ? String(car.reservationDepositPercent) : "",
      basePriceRmb: String(car.basePriceRmb),
      engineType: car.engineType,
      sourceType: car.sourceType,
      availabilityStatus: car.availabilityStatus,
      listingState: car.listingState,
    }),
    [car],
  );

  async function applyCarSummaryEdit(raw: string) {
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

    const ratesRes = await fetch("/api/currency/rates");
    const ratesJson = (await ratesRes.json()) as {
      rates: { usdToRmb: number; rmbToGhs: number; usdToGhsStored: number };
    };
    const fx: FxRatesInput = {
      usdToRmb: ratesJson.rates.usdToRmb,
      rmbToGhs: ratesJson.rates.rmbToGhs,
      usdToGhs: ratesJson.rates.usdToGhsStored,
    };

    let priceProposed = parsed.basePriceRmb;
    const alt = parsed.listPriceAlternate;
    if (alt) {
      let converted:
        | {
            value: number;
            confidence: (typeof alt)["confidence"];
          }
        | undefined;
      if (alt.currency === "GHS") converted = { value: ghsAmountToCanonicalRmb(alt.amount, fx), confidence: alt.confidence };
      else if (alt.currency === "USD") converted = { value: usdAmountToCanonicalRmb(alt.amount, fx), confidence: alt.confidence };
      if (converted) {
        if (!priceProposed) priceProposed = converted;
        else if (converted.confidence === "explicit" && priceProposed.confidence === "heuristic") priceProposed = converted;
      }
    }

    if (
      priceProposed &&
      shouldApplyAutofillNumber(getFormControlString(form, "basePriceRmb"), fieldBaseline.basePriceRmb, priceProposed)
    ) {
      setPriceRmbSeed(priceProposed.value);
      setListingPriceKey((k) => k + 1);
    }

    const supCost = parsed.numberFields.supplierCostRmb;
    if (
      supCost &&
      shouldApplyAutofillNumber(getFormControlString(form, "supplierCostRmb"), fieldBaseline.supplierCostRmb, supCost)
    ) {
      setFormControlString(form, "supplierCostRmb", String(supCost.value));
    }

    const yr = parsed.numberFields.year;
    if (yr && shouldApplyAutofillNumber(getFormControlString(form, "year"), fieldBaseline.year, yr)) {
      setFormControlString(form, "year", String(yr.value));
    }

    const mi = parsed.numberFields.mileage;
    if (mi && shouldApplyAutofillNumber(getFormControlString(form, "mileage"), fieldBaseline.mileage, mi)) {
      setFormControlString(form, "mileage", String(mi.value));
    }

    if (
      parsed.engineTypeEnum &&
      shouldApplyAutofillEnum(getFormControlString(form, "engineType"), fieldBaseline.engineType, {
        value: parsed.engineTypeEnum.value,
        confidence: parsed.engineTypeEnum.confidence,
      })
    ) {
      setFormControlString(form, "engineType", parsed.engineTypeEnum.value);
    }
    if (
      parsed.sourceTypeEnum &&
      shouldApplyAutofillEnum(getFormControlString(form, "sourceType"), fieldBaseline.sourceType, {
        value: parsed.sourceTypeEnum.value,
        confidence: parsed.sourceTypeEnum.confidence,
      })
    ) {
      setFormControlString(form, "sourceType", parsed.sourceTypeEnum.value);
    }
    if (
      parsed.availabilityEnum &&
      shouldApplyAutofillEnum(getFormControlString(form, "availabilityStatus"), fieldBaseline.availabilityStatus, {
        value: parsed.availabilityEnum.value,
        confidence: parsed.availabilityEnum.confidence,
      })
    ) {
      setFormControlString(form, "availabilityStatus", parsed.availabilityEnum.value);
    }
    if (
      parsed.listingStateEnum &&
      shouldApplyAutofillEnum(getFormControlString(form, "listingState"), fieldBaseline.listingState, {
        value: parsed.listingStateEnum.value,
        confidence: parsed.listingStateEnum.confidence,
      })
    ) {
      setFormControlString(form, "listingState", parsed.listingStateEnum.value);
    }

    if (
      parsed.featured &&
      shouldApplyAutofillCheckbox(getFormCheckboxChecked(form, "featured"), car.featured, parsed.featured)
    ) {
      setFormControlString(form, "featured", parsed.featured.value ? "on" : "");
    }

    const skipCover =
      fieldBaseline.coverImageUrl.trim() !== "" || fieldBaseline.coverImagePublicId.trim() !== "";

    for (const [key, proposed] of Object.entries(parsed.stringFields)) {
      if (!proposed?.value) continue;
      if (key === "slug") continue;
      if (skipCover && (key === "coverImageUrl" || key === "coverImagePublicId")) continue;
      const initial =
        key in fieldBaseline && typeof (fieldBaseline as Record<string, string>)[key] === "string"
          ? (fieldBaseline as Record<string, string>)[key]
          : "";
      const current = getFormControlString(form, key);
      if (shouldApplyAutofillText(current, initial, proposed)) {
        setFormControlString(form, key, proposed.value);
      }
    }

    toast.info(AUTOFILL_TOAST_REVIEW);
  }

  return (
    <div className="mt-8 space-y-8">
      <form ref={formRef} action={action} className="grid max-w-3xl gap-4 sm:grid-cols-2">
        <input type="hidden" name="id" value={car.id} />
        {state?.error && <p className="sm:col-span-2 text-sm text-red-400">{state.error}</p>}
        <AdminZodIssues issues={state?.issues} />

        <div className="sm:col-span-2 rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <PasteSummaryAutofill onAutofill={applyCarSummaryEdit} />
          <AutofillUnmappedHint items={autofillUnmapped} />
          <p className="mt-2 text-xs text-zinc-500">
            Parsed values merge conservatively with what is already on this listing. Cover image URL and Cloudinary ID are not
            changed when a cover is already set (upload or URL). Slug is never set from the summary.
          </p>
        </div>

        <p className="sm:col-span-2 text-xs font-medium tracking-wide text-zinc-500 uppercase">Identity</p>
        <div className="sm:col-span-2">
          <Label htmlFor="title">Title</Label>
          <Input id="title" name="title" required className="mt-1" defaultValue={car.title} />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="slug">URL slug</Label>
          <p className="mt-0.5 text-xs text-zinc-500">Lowercase, numbers, hyphens only. Changing this updates the public URL.</p>
          <Input
            id="slug"
            name="slug"
            required
            className="mt-1 font-mono text-sm"
            defaultValue={car.slug}
            pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
          />
        </div>
        <div>
          <Label htmlFor="brand">Brand</Label>
          <Input id="brand" name="brand" required className="mt-1" defaultValue={car.brand} />
        </div>
        <div>
          <Label htmlFor="model">Model</Label>
          <Input id="model" name="model" required className="mt-1" defaultValue={car.model} />
        </div>
        <div>
          <Label htmlFor="year">Year</Label>
          <Input id="year" name="year" type="number" required className="mt-1" defaultValue={car.year} />
        </div>
        <div>
          <Label htmlFor="trim">Trim</Label>
          <Input id="trim" name="trim" className="mt-1" defaultValue={car.trim ?? ""} />
        </div>
        <div>
          <Label htmlFor="bodyType">Body type</Label>
          <Input id="bodyType" name="bodyType" className="mt-1" defaultValue={car.bodyType ?? ""} />
        </div>

        <p className="sm:col-span-2 mt-2 text-xs font-medium tracking-wide text-zinc-500 uppercase">Mechanical</p>
        <div>
          <Label htmlFor="engineType">Engine type</Label>
          <select
            id="engineType"
            name="engineType"
            className={select}
            required
            defaultValue={car.engineType}
          >
            {ENGINE_TYPE_ORDER.map((v) => (
              <option key={v} value={v}>
                {engineTypeLabel(v)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="transmission">Transmission</Label>
          <Input id="transmission" name="transmission" className="mt-1" defaultValue={car.transmission ?? ""} />
        </div>
        <div>
          <Label htmlFor="drivetrain">Drivetrain</Label>
          <Input id="drivetrain" name="drivetrain" className="mt-1" defaultValue={car.drivetrain ?? ""} />
        </div>
        <div>
          <Label htmlFor="mileage">Mileage (km)</Label>
          <Input
            id="mileage"
            name="mileage"
            type="number"
            min={0}
            className="mt-1"
            defaultValue={car.mileage ?? ""}
          />
        </div>

        <p className="sm:col-span-2 mt-2 text-xs font-medium tracking-wide text-zinc-500 uppercase">Appearance &amp; ID</p>
        <div>
          <Label htmlFor="colorExterior">Exterior color</Label>
          <Input id="colorExterior" name="colorExterior" className="mt-1" defaultValue={car.colorExterior ?? ""} />
        </div>
        <div>
          <Label htmlFor="colorInterior">Interior color</Label>
          <Input id="colorInterior" name="colorInterior" className="mt-1" defaultValue={car.colorInterior ?? ""} />
        </div>
        <div>
          <Label htmlFor="vin">VIN / chassis</Label>
          <Input id="vin" name="vin" className="mt-1" defaultValue={car.vin ?? ""} />
        </div>
        <div>
          <Label htmlFor="condition">Condition</Label>
          <Input id="condition" name="condition" className="mt-1" defaultValue={car.condition ?? ""} />
        </div>

        <p className="sm:col-span-2 mt-2 text-xs font-medium tracking-wide text-zinc-500 uppercase">Commerce</p>
        {hasSuccessfulFullPayment ? (
          <div className="sm:col-span-2 rounded-xl border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-50">
            <p className="font-semibold text-amber-100">Fully paid in the system</p>
            <p className="mt-1 leading-relaxed text-amber-50/95">
              This unit is marked sold automatically after a successful full payment. The public inventory page shows it as
              unavailable with a sold badge. Only administrators can edit this record; changing stock or listing status away
              from sold requires the override below.
            </p>
            <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-lg border border-amber-500/25 bg-black/20 p-3">
              <input
                type="checkbox"
                name="inventoryOverride"
                className="mt-1 size-4 shrink-0 rounded border-white/20"
              />
              <span className="leading-relaxed text-amber-50/95">
                I am deliberately overriding sold inventory (admin correction only).
              </span>
            </label>
          </div>
        ) : null}
        <div>
          <Label htmlFor="sourceType">Source</Label>
          <select id="sourceType" name="sourceType" className={select} required defaultValue={car.sourceType}>
            {Object.values(SourceType).map((v) => (
              <option key={v} value={v}>
                {v.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="availabilityStatus">Stock availability</Label>
          <select
            id="availabilityStatus"
            name="availabilityStatus"
            className={select}
            required
            defaultValue={car.availabilityStatus}
          >
            {Object.values(AvailabilityStatus).map((v) => (
              <option key={v} value={v}>
                {v.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="listingState">Listing visibility</Label>
          <p className="mt-0.5 text-xs text-zinc-500">
            Draft = not on storefront; Published = live; Hidden = off but kept; Sold = sold overlay, checkout closed.
          </p>
          <select
            id="listingState"
            name="listingState"
            className={select}
            required
            defaultValue={car.listingState}
          >
            {Object.values(CarListingState).map((v) => (
              <option key={v} value={v}>
                {v.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </div>
        <AdminRmbSellingPriceField
          key={`car-rmb-edit-${listingPriceKey}`}
          label="Base selling price (CNY / RMB)"
          description="Canonical price — reference GHS is saved to the vehicle record on each save for admin quoting."
          defaultValue={priceRmbSeed ?? baseRmb}
          lastSavedReferenceGhs={Number(car.price)}
        />
        <div>
          <Label htmlFor="reservationDepositPercent">Reservation deposit (% of list price, GHS)</Label>
          <p className="mt-0.5 text-xs text-zinc-500">
            Shown on the public vehicle page and used at checkout. Calculated from the listing price in Ghana cedis (from
            RMB). Leave blank for site default ({DEFAULT_RESERVATION_DEPOSIT_PERCENT}%, minimum ₵
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
            defaultValue={car.reservationDepositPercent != null ? String(car.reservationDepositPercent) : ""}
            placeholder={`Default ${DEFAULT_RESERVATION_DEPOSIT_PERCENT}%`}
          />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="supplierCostRmb">Supplier / dealership cost (CNY)</Label>
          <p className="mt-0.5 text-xs text-zinc-500">Admin-only — never shown on the public site.</p>
          <Input
            id="supplierCostRmb"
            name="supplierCostRmb"
            type="number"
            step="0.01"
            min={0}
            className="mt-1"
            defaultValue={costRmb ?? ""}
          />
        </div>
        <p className="sm:col-span-2 text-xs text-zinc-500">
          The fields below are for internal traceability only. They are never shown on the public site.
        </p>
        <div>
          <Label htmlFor="supplierDealerName">Supplier or dealer name</Label>
          <Input
            id="supplierDealerName"
            name="supplierDealerName"
            className="mt-1"
            defaultValue={car.supplierDealerName ?? ""}
            autoComplete="off"
          />
        </div>
        <div>
          <Label htmlFor="supplierDealerPhone">Supplier / dealer phone (reference)</Label>
          <Input
            id="supplierDealerPhone"
            name="supplierDealerPhone"
            type="tel"
            className="mt-1"
            defaultValue={car.supplierDealerPhone ?? ""}
            autoComplete="off"
          />
        </div>
        <div>
          <Label htmlFor="supplierDealerReference">Dealer or listing reference</Label>
          <Input
            id="supplierDealerReference"
            name="supplierDealerReference"
            className="mt-1"
            defaultValue={car.supplierDealerReference ?? ""}
            placeholder="e.g. stock #, ad link"
            autoComplete="off"
          />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="supplierDealerNotes">Notes to trace the deal</Label>
          <Textarea
            id="supplierDealerNotes"
            name="supplierDealerNotes"
            className="mt-1"
            rows={2}
            defaultValue={car.supplierDealerNotes ?? ""}
            autoComplete="off"
          />
        </div>
        <div className="sm:col-span-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-emerald-200/80">Admin profit (CNY)</p>
          <p className="mt-1 text-sm text-zinc-300">
            {profitRmb != null ? (
              <>
                <span className="font-semibold text-white">¥{profitRmb.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                {marginPct != null ? (
                  <span className="text-zinc-500"> · margin {marginPct.toFixed(1)}% of list</span>
                ) : null}
              </>
            ) : (
              <span className="text-zinc-500">Enter a cost to see estimated profit.</span>
            )}
          </p>
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="location">Location</Label>
          <Input id="location" name="location" className="mt-1" defaultValue={car.location ?? ""} />
        </div>

        <p className="sm:col-span-2 mt-2 text-xs font-medium tracking-wide text-zinc-500 uppercase">Media (URLs)</p>
        <div className="sm:col-span-2">
          <Label htmlFor="coverImageUrl">Cover image URL</Label>
          <Input id="coverImageUrl" name="coverImageUrl" type="url" className="mt-1" defaultValue={car.coverImageUrl ?? ""} />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="coverImagePublicId">Cover image Cloudinary public ID</Label>
          <Input
            id="coverImagePublicId"
            name="coverImagePublicId"
            className="mt-1"
            defaultValue={car.coverImagePublicId ?? ""}
          />
        </div>

        <p className="sm:col-span-2 mt-2 text-xs font-medium tracking-wide text-zinc-500 uppercase">Copy</p>
        <div className="sm:col-span-2">
          <Label htmlFor="shortDescription">Short description</Label>
          <Textarea
            id="shortDescription"
            name="shortDescription"
            className="mt-1"
            rows={3}
            defaultValue={car.shortDescription ?? ""}
          />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="longDescription">Long description</Label>
          <Textarea
            id="longDescription"
            name="longDescription"
            className="mt-1"
            rows={6}
            defaultValue={car.longDescription ?? ""}
          />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="engineDetails">Engine / technical notes</Label>
          <Textarea
            id="engineDetails"
            name="engineDetails"
            className="mt-1"
            rows={3}
            defaultValue={car.engineDetails ?? ""}
          />
        </div>
        <div>
          <Label htmlFor="inspectionStatus">Inspection status</Label>
          <Input
            id="inspectionStatus"
            name="inspectionStatus"
            className="mt-1"
            defaultValue={car.inspectionStatus ?? ""}
          />
        </div>
        <div>
          <Label htmlFor="estimatedDelivery">Estimated delivery window</Label>
          <Input
            id="estimatedDelivery"
            name="estimatedDelivery"
            className="mt-1"
            defaultValue={car.estimatedDelivery ?? ""}
          />
        </div>
        <div>
          <Label htmlFor="seaShippingFeeGhs">Sea shipping estimate (GHS)</Label>
          <Input
            id="seaShippingFeeGhs"
            name="seaShippingFeeGhs"
            type="number"
            min={0}
            step="0.01"
            className="mt-1"
            placeholder="Shown on listing & checkout"
            defaultValue={car.seaShippingFeeGhs != null ? String(car.seaShippingFeeGhs) : ""}
          />
          <p className="mt-1 text-[10px] text-zinc-500">Vehicle moves on sea freight only. Leave blank if not yet quoted.</p>
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="accidentHistory">Accident history</Label>
          <Textarea
            id="accidentHistory"
            name="accidentHistory"
            className="mt-1"
            rows={2}
            defaultValue={car.accidentHistory ?? ""}
          />
        </div>

        <p className="sm:col-span-2 mt-2 text-xs font-medium tracking-wide text-zinc-500 uppercase">Tags &amp; structured data</p>
        <div className="sm:col-span-2">
          <Label htmlFor="tags">Badges / tags</Label>
          <Input id="tags" name="tags" className="mt-1" defaultValue={tagsToCommaList(car.tags)} />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="specifications">Specifications JSON</Label>
          <Textarea
            id="specifications"
            name="specifications"
            className="mt-1 font-mono text-xs"
            rows={5}
            defaultValue={specificationsToTextarea(car.specifications)}
          />
        </div>

        <div className="flex items-center gap-2 sm:col-span-2">
          <input id="featured" name="featured" type="checkbox" value="on" className="size-4" defaultChecked={car.featured} />
          <Label htmlFor="featured">Featured on homepage</Label>
        </div>
        <div className="sm:col-span-2 flex flex-wrap gap-3">
          <Button type="submit">Save changes</Button>
          <Link
            href={`/admin/duty-estimator?vehicleName=${encodeURIComponent(car.title)}`}
            className="inline-flex h-8 items-center rounded-lg border border-[var(--brand)]/40 bg-[var(--brand)]/10 px-3 text-sm font-medium text-[var(--brand)] hover:bg-[var(--brand)]/20"
          >
            Generate duty estimate
          </Link>
          <Link
            href="/admin/cars"
            className="inline-flex h-8 items-center rounded-lg border border-white/15 px-3 text-sm text-zinc-300 hover:bg-white/5"
          >
            Back to list
          </Link>
        </div>
      </form>

      <div className="max-w-3xl rounded-2xl border border-white/10 bg-white/[0.02] p-6">
        <p className="text-sm text-zinc-400">
          The <strong className="text-zinc-300">reference GHS</strong> field on this listing is updated from base RMB every
          time you save, and for all vehicles when admin exchange rates change.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="destructive"
            onClick={() => {
              if (!confirmDel) {
                setConfirmDel(true);
                return;
              }
              startTransition(async () => {
                const r = await deleteCar(car.id);
                if (r?.error) {
                  toast.error(r.error);
                  setConfirmDel(false);
                  return;
                }
                if (r?.ok) {
                  toast.success("Vehicle deleted");
                  router.push("/admin/cars");
                }
              });
            }}
          >
            {confirmDel ? "Click again to delete" : "Delete vehicle"}
          </Button>
        </div>
      </div>
    </div>
  );
}
