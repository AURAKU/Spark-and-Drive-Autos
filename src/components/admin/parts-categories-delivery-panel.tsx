"use client";

import { DeliveryFeeCurrency, DeliveryMode } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  createPartCategoryAction,
  setPartCategoryActiveAction,
  upsertDeliveryTemplateAction,
  type PartsAdminFormState,
} from "@/actions/parts-admin";
import { CategoryRemoveForm } from "@/components/admin/category-remove-form";

type CategoryRow = { id: string; name: string; slug: string; active: boolean };

type DeliveryDefaults = Record<DeliveryMode, { name: string; etaLabel: string }>;

type DeliveryRow = {
  mode: DeliveryMode;
  name: string;
  etaLabel: string;
  feeGhs: number;
  feeRmb: number;
  feeCurrency: DeliveryFeeCurrency;
  feeAmount: number;
  weightKg: number | null;
  volumeCbm: number | null;
} | null;

function usePartsAdminToast(state: PartsAdminFormState | undefined, okMsg: string) {
  useEffect(() => {
    if (state?.ok) {
      toast.success(okMsg);
    }
    if (state?.error) {
      toast.error(state.error);
    }
  }, [state, okMsg]);
}

export function PartsCategoriesPanel({ categories }: { categories: CategoryRow[] }) {
  const router = useRouter();
  const [formKey, setFormKey] = useState(0);
  const [state, action] = useActionState(createPartCategoryAction, null as PartsAdminFormState);

  usePartsAdminToast(state, "Category added");

  useEffect(() => {
    if (state?.ok) {
      setFormKey((k) => k + 1);
      router.refresh();
    }
  }, [state?.ok, router]);

  return (
    <div className="mt-6 space-y-6">
      <form key={formKey} action={action} className="flex max-w-xl gap-2">
        <input
          name="name"
          required
          className="h-10 flex-1 rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white outline-none"
          placeholder="New category name"
        />
        <button type="submit" className="h-10 rounded-lg bg-[var(--brand)] px-4 text-sm font-semibold text-black">
          Add
        </button>
      </form>

      <div className="overflow-hidden rounded-2xl border border-white/10">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-white/10 bg-white/[0.03] text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Slug</th>
              <th className="px-4 py-3">Active</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((c) => (
              <CategoryRow key={c.id} category={c} />
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-zinc-500">Categories still linked to parts are deactivated instead of deleted.</p>
    </div>
  );
}

function CategoryRow({ category: c }: { category: CategoryRow }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function toggle() {
    start(async () => {
      const fd = new FormData();
      fd.set("id", c.id);
      fd.set("active", c.active ? "false" : "true");
      const r = await setPartCategoryActiveAction(null, fd);
      if (r?.error) toast.error(r.error);
      else {
        toast.success(c.active ? "Category deactivated" : "Category activated");
        router.refresh();
      }
    });
  }

  return (
    <tr className="border-b border-white/5">
      <td className="px-4 py-3 text-zinc-100">{c.name}</td>
      <td className="px-4 py-3 font-mono text-xs text-zinc-500">{c.slug}</td>
      <td className="px-4 py-3 text-zinc-300">{c.active ? "Yes" : "No"}</td>
      <td className="px-4 py-3 text-right">
        <button
          type="button"
          disabled={pending}
          onClick={() => void toggle()}
          className="text-xs text-[var(--brand)] hover:underline disabled:opacity-50"
        >
          {c.active ? "Deactivate" : "Activate"}
        </button>
        {" · "}
        <CategoryRemoveForm categoryId={c.id} />
      </td>
    </tr>
  );
}

export function PartsDeliveryTemplatesPanel({
  modes,
  deliveryDefaults,
  rowsByMode,
}: {
  modes: DeliveryMode[];
  deliveryDefaults: DeliveryDefaults;
  rowsByMode: Record<string, DeliveryRow>;
}) {
  return (
    <div className="mt-6 space-y-4">
      <p className="text-sm text-zinc-400">
        China stock shipping templates: delivery type, estimated duration, fee (enter in <strong className="text-zinc-300">GHS</strong> or{" "}
        <strong className="text-zinc-300">USD</strong>; we normalize to GHS + RMB for checkout), and optional weight (kg) or CBM for
        your records. Per-SKU overrides stay on the part edit screen.
      </p>
      {modes.map((mode) => (
        <DeliveryTemplateForm
          key={mode}
          mode={mode}
          defaults={deliveryDefaults[mode]}
          row={rowsByMode[mode] ?? null}
        />
      ))}
    </div>
  );
}

function DeliveryTemplateForm({
  mode,
  defaults,
  row,
}: {
  mode: DeliveryMode;
  defaults: { name: string; etaLabel: string };
  row: DeliveryRow;
}) {
  const router = useRouter();
  const [state, action] = useActionState(upsertDeliveryTemplateAction, null as PartsAdminFormState);

  usePartsAdminToast(state, "Delivery option saved");

  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state?.ok, router]);

  const feeCurrency = row?.feeCurrency ?? DeliveryFeeCurrency.GHS;

  return (
    <form action={action} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <input type="hidden" name="mode" value={mode} />
      <p className="text-xs uppercase tracking-wide text-zinc-500">System mode · {mode}</p>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <div>
          <label className="text-xs font-medium text-zinc-500">Delivery type</label>
          <input
            name="name"
            required
            defaultValue={row?.name ?? defaults.name}
            className="mt-1 h-10 w-full rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white"
            placeholder="e.g. Air express"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-zinc-500">Estimated duration</label>
          <input
            name="etaLabel"
            required
            defaultValue={row?.etaLabel ?? defaults.etaLabel}
            className="mt-1 h-10 w-full rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white"
            placeholder="e.g. 5–10 business days"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-zinc-500">Fee</label>
          <div className="mt-1 flex gap-2">
            <input
              name="feeAmount"
              type="number"
              step="any"
              min="0"
              required
              defaultValue={row ? row.feeAmount : 0}
              className="h-10 min-w-0 flex-1 rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white"
            />
            <select
              name="feeCurrency"
              defaultValue={feeCurrency}
              className="h-10 shrink-0 rounded-lg border border-white/10 bg-black/30 px-2 text-sm text-white"
            >
              <option value={DeliveryFeeCurrency.GHS}>GHS</option>
              <option value={DeliveryFeeCurrency.USD}>USD</option>
            </select>
          </div>
          {row ? (
            <p className="mt-1 text-[11px] text-zinc-600">
              Stored: GHS {row.feeGhs.toLocaleString()} · RMB {row.feeRmb.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </p>
          ) : null}
        </div>
        <div className="grid grid-cols-2 gap-3 sm:col-span-2 sm:grid-cols-2">
          <div>
            <label className="text-xs font-medium text-zinc-500">Weight (kg)</label>
            <input
              name="weightKg"
              type="number"
              step="0.001"
              min="0"
              defaultValue={row?.weightKg != null ? row.weightKg : ""}
              placeholder="Optional"
              className="mt-1 h-10 w-full rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-zinc-500">Volume (CBM)</label>
            <input
              name="volumeCbm"
              type="number"
              step="0.000001"
              min="0"
              defaultValue={row?.volumeCbm != null ? row.volumeCbm : ""}
              placeholder="Optional"
              className="mt-1 h-10 w-full rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white"
            />
          </div>
        </div>
      </div>
      <button type="submit" className="mt-4 h-9 rounded-lg bg-[var(--brand)] px-4 text-sm font-semibold text-black">
        Save option
      </button>
    </form>
  );
}
