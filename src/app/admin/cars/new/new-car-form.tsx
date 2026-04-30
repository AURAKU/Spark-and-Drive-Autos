"use client";

import { AvailabilityStatus, CarListingState, EngineType, SourceType } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";
import { toast } from "sonner";

import { createCar } from "@/actions/cars";
import {
  DEFAULT_RESERVATION_DEPOSIT_MIN_GHS,
  DEFAULT_RESERVATION_DEPOSIT_PERCENT,
} from "@/lib/checkout-amount";
import { ENGINE_TYPE_ORDER, engineTypeLabel } from "@/lib/engine-type-ui";
import { AdminRmbSellingPriceField } from "@/components/admin/admin-rmb-selling-price-field";
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
  const [state, action] = useActionState(createCar, null as State);

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

  return (
    <form action={action} className="mt-8 grid max-w-3xl gap-4 sm:grid-cols-2">
      {state?.error && <p className="sm:col-span-2 text-sm text-red-400">{state.error}</p>}
      <AdminZodIssues issues={state?.issues} />

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
      <AdminRmbSellingPriceField
        label="Base selling price (CNY / RMB)"
        description="Canonical price — reference GHS below is stored on the vehicle when you create the listing."
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
      <div className="sm:col-span-2">
        <Label htmlFor="supplierCostRmb">Supplier / dealership cost (CNY)</Label>
        <p className="mt-0.5 text-xs text-zinc-500">Admin-only — not shown to customers. Leave blank if unknown.</p>
        <Input id="supplierCostRmb" name="supplierCostRmb" type="number" step="0.01" min={0} className="mt-1" />
      </div>
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
