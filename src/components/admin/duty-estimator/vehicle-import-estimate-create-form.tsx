"use client";

import { EngineType } from "@prisma/client";
import { createVehicleImportEstimateAction } from "@/actions/vehicle-import-estimate-admin";
import {
  buildCarLinkItems,
  buildInquiryLinkItems,
  buildOrderLinkItems,
  buildUserLinkItems,
  EstimateLinkCombobox,
} from "@/components/admin/duty-estimator/estimate-link-combobox";
import { ENGINE_TYPE_ORDER, engineTypeLabel } from "@/lib/engine-type-ui";
import { useEffect, useMemo, useState } from "react";

type OptionUser = { id: string; name: string | null; email: string | null };
type OptionOrder = { id: string; reference: string } & {
  user: { name: string | null; email: string | null } | null;
  car: { title: string } | null;
};
type OptionInquiry = { id: string; message: string; createdAt: Date } & {
  user: { name: string | null; email: string | null } | null;
};
type OptionCar = { id: string; title: string; year: number; engineType: EngineType };

type Props = {
  users: OptionUser[];
  orders: OptionOrder[];
  inquiries: OptionInquiry[];
  cars: OptionCar[];
  defaults?: {
    clientName?: string;
    clientContact?: string;
    vehicleName?: string;
    customerId?: string;
    orderId?: string;
    inquiryId?: string;
    carId?: string;
  };
};

function formatMoney(value: string) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "-";
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "GHS", minimumFractionDigits: 2 }).format(num);
}

export function VehicleImportEstimateCreateForm({ users, orders, inquiries, cars, defaults }: Props) {
  const [fob, setFob] = useState("");
  const [freight, setFreight] = useState("");
  const [insurance, setInsurance] = useState("");
  const [cif, setCif] = useState("");
  const [carId, setCarId] = useState(defaults?.carId ?? "");
  const [engineType, setEngineType] = useState<EngineType>(EngineType.GASOLINE_PETROL);

  const autoCif = useMemo(() => {
    const fv = Number(fob);
    const fr = Number(freight);
    const ins = Number(insurance);
    if (!Number.isFinite(fv) || !Number.isFinite(fr) || !Number.isFinite(ins)) return "";
    return String(fv + fr + ins);
  }, [fob, freight, insurance]);

  useEffect(() => {
    const c = cars.find((x) => x.id === carId);
    if (c) setEngineType(c.engineType);
  }, [carId, cars]);

  const userItems = useMemo(() => buildUserLinkItems(users), [users]);
  const orderItems = useMemo(() => buildOrderLinkItems(orders), [orders]);
  const inquiryItems = useMemo(() => buildInquiryLinkItems(inquiries), [inquiries]);
  const carItems = useMemo(() => buildCarLinkItems(cars), [cars]);

  return (
    <form action={createVehicleImportEstimateAction} className="space-y-6 rounded-2xl border border-border bg-card p-5 dark:border-white/10 dark:bg-white/[0.02]">
      <section className="rounded-xl border border-border/70 p-4 dark:border-white/10">
        <p className="text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">1. Client Details</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Client name</label>
            <input name="clientName" defaultValue={defaults?.clientName ?? ""} required className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm dark:border-white/15 dark:bg-black/30" />
          </div>
          <div>
            <label className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Client contact</label>
            <input name="clientContact" defaultValue={defaults?.clientContact ?? ""} required className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm dark:border-white/15 dark:bg-black/30" />
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border/70 p-4 dark:border-white/10">
        <p className="text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">2. Vehicle Details</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Vehicle name</label>
            <input name="vehicleName" defaultValue={defaults?.vehicleName ?? ""} required className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm dark:border-white/15 dark:bg-black/30" />
          </div>
          <div>
            <label className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Model year</label>
            <input name="modelYear" type="number" min={1900} max={2100} className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm dark:border-white/15 dark:bg-black/30" />
          </div>
          <div>
            <label className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Powertrain (duty planning)</label>
            <select
              name="engineType"
              value={engineType}
              onChange={(e) => setEngineType(e.target.value as EngineType)}
              className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm dark:border-white/15 dark:bg-black/30"
            >
              {ENGINE_TYPE_ORDER.map((v) => (
                <option key={v} value={v}>
                  {engineTypeLabel(v)}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">VIN</label>
            <input name="vin" className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm dark:border-white/15 dark:bg-black/30" />
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border/70 p-4 dark:border-white/10">
        <p className="text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">3. Cost Breakdown</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">FOB (GHS)</label>
            <input name="fob" type="number" step="0.01" min="0" value={fob} onChange={(e) => setFob(e.target.value)} className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm dark:border-white/15 dark:bg-black/30" />
            <p className="mt-1 text-[11px] text-zinc-500">{formatMoney(fob)}</p>
          </div>
          <div>
            <label className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Freight (GHS)</label>
            <input name="freight" type="number" step="0.01" min="0" value={freight} onChange={(e) => setFreight(e.target.value)} className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm dark:border-white/15 dark:bg-black/30" />
            <p className="mt-1 text-[11px] text-zinc-500">{formatMoney(freight)}</p>
          </div>
          <div>
            <label className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Insurance (GHS)</label>
            <input name="insurance" type="number" step="0.01" min="0" value={insurance} onChange={(e) => setInsurance(e.target.value)} className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm dark:border-white/15 dark:bg-black/30" />
            <p className="mt-1 text-[11px] text-zinc-500">{formatMoney(insurance)}</p>
          </div>
          <div>
            <label className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">CIF (GHS)</label>
            <input name="cif" type="number" step="0.01" min="0" value={cif} onChange={(e) => setCif(e.target.value)} className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm dark:border-white/15 dark:bg-black/30" />
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => setCif(autoCif)} className="rounded-md border border-border px-2 py-0.5 text-[11px] hover:bg-muted/50">Auto-calc CIF</button>
              <p className="text-[11px] text-zinc-500">Auto: {autoCif ? formatMoney(autoCif) : "-"}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border/70 p-4 dark:border-white/10">
        <p className="text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">4. Duty Estimate</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Estimated duty range min (GHS)</label>
            <input name="estimatedDutyRangeMin" type="number" step="0.01" min="0" className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm dark:border-white/15 dark:bg-black/30" />
          </div>
          <div>
            <label className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Estimated duty range max (GHS)</label>
            <input name="estimatedDutyRangeMax" type="number" step="0.01" min="0" className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm dark:border-white/15 dark:bg-black/30" />
          </div>
          <div className="md:col-span-2">
            <label className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Estimated landed cost (GHS)</label>
            <input name="estimatedLandedCost" type="number" step="0.01" min="0" className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm dark:border-white/15 dark:bg-black/30" />
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border/70 p-4 dark:border-white/10">
        <p className="text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">Linking and Integration Hooks</p>
        <p className="mt-2 text-[11px] leading-relaxed text-zinc-500">
          Type to search by reference, title, email, message text, or id. Vehicle orders list only{" "}
          <span className="text-zinc-400">car (vehicle)</span> orders.
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Link customer account</label>
            <EstimateLinkCombobox
              name="customerId"
              items={userItems}
              initialValue={defaults?.customerId ?? ""}
              placeholder="Search name, email, or user id…"
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Link vehicle order</label>
            <EstimateLinkCombobox
              name="orderId"
              items={orderItems}
              initialValue={defaults?.orderId ?? ""}
              placeholder="Search order ref, vehicle, customer…"
              className="mt-1"
            />
          </div>
          <div className="md:col-span-2">
            <label className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Link inquiry</label>
            <EstimateLinkCombobox
              name="inquiryId"
              items={inquiryItems}
              initialValue={defaults?.inquiryId ?? ""}
              placeholder="Search inquiry message, email, or id…"
              className="mt-1"
            />
          </div>
          <div className="md:col-span-2">
            <label className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Link admin vehicle</label>
            <EstimateLinkCombobox
              name="carId"
              items={carItems}
              initialValue={defaults?.carId ?? ""}
              placeholder="Search inventory title, year, or id…"
              className="mt-1"
              onValueChange={(id) => setCarId(id)}
            />
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-amber-400/30 bg-amber-500/[0.08] p-4">
        <p className="text-xs font-semibold tracking-[0.14em] text-amber-300 uppercase">5. Important Notice</p>
        <textarea
          name="importantNotice"
          rows={4}
          defaultValue="Important Notice: This document is an estimate only. Final duty and related import charges are determined by Ghana Customs and ICUMS at clearance."
          className="mt-1 w-full rounded-lg border border-amber-400/30 bg-amber-500/[0.07] px-3 py-2 text-sm text-amber-100 dark:text-amber-200"
        />
      </section>

      <section>
        <label className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Prepared by</label>
        <input name="preparedByName" defaultValue="Spark and Drive Autos" className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm dark:border-white/15 dark:bg-black/30" />
      </section>

      <div className="flex flex-wrap gap-2 pt-1">
        <button type="submit" name="intent" value="draft" className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted/60">Save draft</button>
        <button type="submit" name="intent" value="sent" className="rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-black hover:opacity-90">Finalize (mark sent)</button>
        <button type="submit" name="intent" value="preview" className="rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:bg-muted/60">Save and preview</button>
      </div>
    </form>
  );
}
