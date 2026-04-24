"use client";

import type { EngineType } from "@prisma/client";
import { updateVehicleImportEstimateAction } from "@/actions/vehicle-import-estimate-admin";
import type { VehicleImportEstimateRecord } from "@/lib/vehicle-import-estimate/data";
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
  estimate: VehicleImportEstimateRecord;
  users: OptionUser[];
  orders: OptionOrder[];
  inquiries: OptionInquiry[];
  cars: OptionCar[];
};

function n(value: unknown): string {
  if (value == null) return "";
  const num = Number(value);
  return Number.isFinite(num) ? String(num) : "";
}

export function VehicleImportEstimateEditorForm({ estimate, users, orders, inquiries, cars }: Props) {
  const [fob, setFob] = useState(n(estimate.fob));
  const [freight, setFreight] = useState(n(estimate.freight));
  const [insurance, setInsurance] = useState(n(estimate.insurance));
  const [cif, setCif] = useState(n(estimate.cif));
  const [carId, setCarId] = useState(estimate.carId ?? "");
  const [engineType, setEngineType] = useState<EngineType>(estimate.engineType ?? "GASOLINE");

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

  const formatMoney = (value: string) => {
    const num = Number(value);
    if (!Number.isFinite(num)) return "-";
    return new Intl.NumberFormat(undefined, { style: "currency", currency: "GHS", minimumFractionDigits: 2 }).format(num);
  };

  return (
    <form action={updateVehicleImportEstimateAction} className="space-y-6 rounded-2xl border border-border bg-card p-5 dark:border-white/10 dark:bg-white/[0.02]">
      <input type="hidden" name="id" value={estimate.id} />

      <section className="rounded-xl border border-border/70 p-4 dark:border-white/10">
        <p className="text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">1. Client Details</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div>
          <label className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Client name</label>
          <input
            name="clientName"
            defaultValue={estimate.clientName}
            required
            className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-[var(--brand)]/50 dark:border-white/15 dark:bg-black/30"
          />
        </div>
        <div>
          <label className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Client contact</label>
          <input
            name="clientContact"
            defaultValue={estimate.clientContact}
            required
            className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-[var(--brand)]/50 dark:border-white/15 dark:bg-black/30"
          />
        </div>
        <div>
          <label className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Vehicle name</label>
          <input
            name="vehicleName"
            defaultValue={estimate.vehicleName}
            required
            className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-[var(--brand)]/50 dark:border-white/15 dark:bg-black/30"
          />
        </div>
        <div>
          <label className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Model year</label>
          <input
            name="modelYear"
            defaultValue={n(estimate.modelYear)}
            type="number"
            min={1900}
            max={2100}
            className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-[var(--brand)]/50 dark:border-white/15 dark:bg-black/30"
          />
        </div>
        <div>
          <label className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Powertrain (duty planning)</label>
          <select
            name="engineType"
            value={engineType}
            onChange={(e) => setEngineType(e.target.value as EngineType)}
            className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-[var(--brand)]/50 dark:border-white/15 dark:bg-black/30"
          >
            <option value="GASOLINE">Gasoline / diesel (ICE)</option>
            <option value="HYBRID">Hybrid (HEV)</option>
            <option value="PLUGIN_HYBRID">Plug-in hybrid (PHEV)</option>
            <option value="ELECTRIC">Battery electric (BEV)</option>
          </select>
          <p className="mt-1 text-[11px] text-zinc-500">Scales formula duty range; BEV aligns with ICUMS electric HS treatment (no engine cc).</p>
        </div>
        <div className="md:col-span-2">
          <label className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">VIN</label>
          <input
            name="vin"
            defaultValue={estimate.vin ?? ""}
            className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-[var(--brand)]/50 dark:border-white/15 dark:bg-black/30"
          />
        </div>
        </div>
      </section>

      <section className="rounded-xl border border-border/70 p-4 dark:border-white/10">
        <p className="text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">3. Cost Breakdown</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div>
          <label className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">FOB (GHS)</label>
          <input
            name="fob"
            type="number"
            step="0.01"
            min="0"
            value={fob}
            onChange={(e) => setFob(e.target.value)}
            className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm dark:border-white/15 dark:bg-black/30"
          />
          <p className="mt-1 text-[11px] text-zinc-500">{formatMoney(fob)}</p>
        </div>
        <div>
          <label className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Freight (GHS)</label>
          <input
            name="freight"
            type="number"
            step="0.01"
            min="0"
            value={freight}
            onChange={(e) => setFreight(e.target.value)}
            className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm dark:border-white/15 dark:bg-black/30"
          />
          <p className="mt-1 text-[11px] text-zinc-500">{formatMoney(freight)}</p>
        </div>
        <div>
          <label className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Insurance (GHS)</label>
          <input
            name="insurance"
            type="number"
            step="0.01"
            min="0"
            value={insurance}
            onChange={(e) => setInsurance(e.target.value)}
            className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm dark:border-white/15 dark:bg-black/30"
          />
          <p className="mt-1 text-[11px] text-zinc-500">{formatMoney(insurance)}</p>
        </div>
        <div>
          <label className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">CIF (GHS)</label>
          <input
            name="cif"
            type="number"
            step="0.01"
            min="0"
            value={cif}
            onChange={(e) => setCif(e.target.value)}
            className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm dark:border-white/15 dark:bg-black/30"
          />
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setCif(autoCif)}
              className="rounded-md border border-border px-2 py-0.5 text-[11px] hover:bg-muted/50"
            >
              Auto-calc CIF
            </button>
            <p className="text-[11px] text-zinc-500">Auto: {autoCif ? formatMoney(autoCif) : "-"}</p>
          </div>
        </div>
        </div>
      </section>

      <section className="rounded-xl border border-border/70 p-4 dark:border-white/10">
        <p className="text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">4. Duty Estimate</p>
        <p className="mt-2 text-xs leading-relaxed text-zinc-500">
          Enter a full manual duty range, or provide CIF and one/no duty boundary for hybrid/formula support.
          Admin-entered values remain the final displayed estimate values; this is always planning guidance, not legal customs truth.
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div>
          <label className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Estimated duty range min (GHS)</label>
          <input name="estimatedDutyRangeMin" type="number" step="0.01" min="0" defaultValue={n(estimate.estimatedDutyRangeMin)} className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm dark:border-white/15 dark:bg-black/30" />
        </div>
        <div>
          <label className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Estimated duty range max (GHS)</label>
          <input name="estimatedDutyRangeMax" type="number" step="0.01" min="0" defaultValue={n(estimate.estimatedDutyRangeMax)} className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm dark:border-white/15 dark:bg-black/30" />
        </div>
        <div className="md:col-span-2">
          <label className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Estimated landed cost (GHS)</label>
          <input name="estimatedLandedCost" type="number" step="0.01" min="0" defaultValue={n(estimate.estimatedLandedCost)} className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm dark:border-white/15 dark:bg-black/30" />
          <p className="mt-1 text-[11px] text-zinc-500">
            Leave blank to auto-derive landed cost from CIF + duty estimate midpoint. Fill manually to override.
          </p>
        </div>
        </div>
      </section>

      <section className="rounded-xl border border-border/70 p-4 dark:border-white/10">
        <p className="text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">Linking and Integration Hooks</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div>
          <label className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Link customer account</label>
          <select name="customerId" defaultValue={estimate.customerId ?? ""} className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm dark:border-white/15 dark:bg-black/30">
            <option value="">None</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {(u.name ?? "Unnamed")} - {u.email}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Link vehicle order</label>
          <select name="orderId" defaultValue={estimate.orderId ?? ""} className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm dark:border-white/15 dark:bg-black/30">
            <option value="">None</option>
            {orders.map((o) => (
              <option key={o.id} value={o.id}>
                {o.reference} - {o.car?.title ?? "No vehicle"} - {o.user?.email ?? "No customer"}
              </option>
            ))}
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Link inquiry</label>
          <select name="inquiryId" defaultValue={estimate.inquiryId ?? ""} className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm dark:border-white/15 dark:bg-black/30">
            <option value="">None</option>
            {inquiries.map((i) => (
              <option key={i.id} value={i.id}>
                {i.user?.email ?? "Guest"} - {i.message.slice(0, 64)}
              </option>
            ))}
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Link admin vehicle</label>
          <select
            name="carId"
            value={carId}
            onChange={(e) => setCarId(e.target.value)}
            className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm dark:border-white/15 dark:bg-black/30"
          >
            <option value="">None</option>
            {cars.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title} · {c.year}
              </option>
            ))}
          </select>
        </div>
        </div>
      </section>

      <section className="rounded-xl border border-amber-400/30 bg-amber-500/[0.08] p-4">
        <p className="text-xs font-semibold tracking-[0.14em] text-amber-300 uppercase">5. Important Notice</p>
        <label className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Important notice</label>
        <textarea
          name="importantNotice"
          defaultValue={estimate.importantNotice ?? ""}
          rows={4}
          className="mt-1 w-full rounded-lg border border-amber-400/30 bg-amber-500/[0.07] px-3 py-2 text-sm text-amber-100 dark:text-amber-200"
        />
      </section>

      <section>
        <label className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Prepared by</label>
        <input
          name="preparedByName"
          defaultValue={estimate.preparedByName}
          className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm dark:border-white/15 dark:bg-black/30"
        />
      </section>

      <div className="flex flex-wrap gap-2 pt-1">
        <button type="submit" name="intent" value="draft" className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted/60">
          Save draft
        </button>
        <button type="submit" name="intent" value="sent" className="rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-black hover:opacity-90">
          Save and mark sent
        </button>
        <button type="submit" name="intent" value="accepted" className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-black hover:opacity-90">
          Mark accepted
        </button>
        <button type="submit" name="intent" value="expired" className="rounded-lg border border-zinc-500/60 px-4 py-2 text-sm font-semibold text-zinc-300 hover:bg-zinc-500/10">
          Mark expired
        </button>
        <button type="submit" name="intent" value="superseded" className="rounded-lg border border-violet-500/60 px-4 py-2 text-sm font-semibold text-violet-300 hover:bg-violet-500/10">
          Mark superseded
        </button>
      </div>
    </form>
  );
}
