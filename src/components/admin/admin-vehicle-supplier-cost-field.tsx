"use client";

import type { DisplayCurrency } from "@/lib/currency";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const OPTIONS: { value: DisplayCurrency; label: string }[] = [
  { value: "GHS", label: "GHS" },
  { value: "USD", label: "USD" },
  { value: "CNY", label: "CNY (RMB)" },
];

type Props = {
  defaultAmount?: number | null;
  defaultCurrency?: DisplayCurrency | null;
  amountName?: string;
  currencyName?: string;
};

/** Supplier / dealership cost with preserved admin currency (RMB equivalent computed on server). */
export function AdminVehicleSupplierCostField({
  defaultAmount,
  defaultCurrency = "GHS",
  amountName = "supplierCostAmount",
  currencyName = "supplierCostCurrency",
}: Props) {
  const amt = defaultAmount != null && Number.isFinite(defaultAmount) ? String(defaultAmount) : "";
  const cur = defaultCurrency ?? "GHS";

  return (
    <div className="sm:col-span-2 space-y-2">
      <Label htmlFor={amountName}>Supplier / dealership cost</Label>
      <p className="text-xs text-zinc-500">Admin-only — not shown to customers. Currency is stored for sourcing / accounting.</p>
      <div className="flex flex-wrap gap-2">
        <select
          id={currencyName}
          name={currencyName}
          defaultValue={cur}
          className="h-10 min-w-[8rem] rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white outline-none ring-[var(--brand)]/30 focus:ring-2"
        >
          {OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <Input
          id={amountName}
          name={amountName}
          type="number"
          step="0.01"
          min={0}
          defaultValue={amt}
          className="min-w-0 flex-1"
          autoComplete="off"
          placeholder="Optional"
        />
      </div>
    </div>
  );
}
