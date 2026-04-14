"use client";

import { DeliveryMode } from "@prisma/client";
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
        Admin-configurable shipping choices for China-listed parts. Fees are stored per template and can be overridden per
        SKU on the edit screen.
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

  return (
    <form action={action} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <input type="hidden" name="mode" value={mode} />
      <p className="text-xs uppercase tracking-wide text-zinc-500">{mode}</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <input
          name="name"
          required
          defaultValue={row?.name ?? defaults.name}
          className="h-10 rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white"
        />
        <input
          name="etaLabel"
          required
          defaultValue={row?.etaLabel ?? defaults.etaLabel}
          className="h-10 rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white"
        />
        <input
          name="feeGhs"
          type="number"
          step="0.01"
          min="0"
          required
          defaultValue={row ? row.feeGhs : 0}
          className="h-10 rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white"
        />
        <input
          name="feeRmb"
          type="number"
          step="0.01"
          min="0"
          required
          defaultValue={row ? row.feeRmb : 0}
          className="h-10 rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white"
        />
      </div>
      <button type="submit" className="mt-3 h-9 rounded-lg bg-[var(--brand)] px-4 text-sm font-semibold text-black">
        Save option
      </button>
    </form>
  );
}
