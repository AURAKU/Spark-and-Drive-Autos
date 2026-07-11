"use client";

import { useState, useTransition } from "react";

import { createFxRateAction } from "@/actions/duty-admin-os";
import { buildPageHref } from "@/lib/duty-admin/pagination";
import { isFxRateStale } from "@/lib/duty-admin/fx-rates";
import { ListPaginationFooter } from "@/components/ui/list-pagination";

type Props = {
  data: Awaited<ReturnType<typeof import("@/actions/duty-admin-os").listFxRatesData>>;
};

export function DutyFxRatesClient({ data }: Props) {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [form, setForm] = useState({
    fromCurrency: "USD",
    rate: "",
    effectiveDate: new Date().toISOString().slice(0, 10),
    source: "BANK_OF_GHANA" as const,
    isOverride: false,
    overrideReason: "",
  });

  function submit() {
    startTransition(async () => {
      setMsg(null);
      const result = await createFxRateAction({
        fromCurrency: form.fromCurrency,
        rate: Number(form.rate),
        effectiveDate: form.effectiveDate,
        source: form.source,
        isOverride: form.isOverride,
        overrideReason: form.overrideReason || undefined,
      });
      if (result.error) setMsg(result.error);
      else {
        setMsg("FX rate saved. Existing calculations retain their snapshot rates.");
        window.location.reload();
      }
    });
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Dated exchange rates with source. Manual overrides require a reason and are audited. Old calculations preserve snapshot FX — never retroactive.
      </p>

      <section className="max-w-xl space-y-3 rounded-xl border border-border p-4 dark:border-white/10">
        <h3 className="text-sm font-semibold">Add rate</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            From currency
            <input className="mt-1 w-full rounded-lg border px-3 py-2" value={form.fromCurrency} onChange={(e) => setForm({ ...form, fromCurrency: e.target.value.toUpperCase() })} />
          </label>
          <label className="block text-sm">
            Rate (to GHS)
            <input type="number" step="0.0001" className="mt-1 w-full rounded-lg border px-3 py-2" value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} />
          </label>
          <label className="block text-sm">
            Effective date
            <input type="date" className="mt-1 w-full rounded-lg border px-3 py-2" value={form.effectiveDate} onChange={(e) => setForm({ ...form, effectiveDate: e.target.value })} />
          </label>
          <label className="block text-sm">
            Source
            <select className="mt-1 w-full rounded-lg border px-3 py-2" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value as typeof form.source })}>
              <option value="BANK_OF_GHANA">Bank of Ghana</option>
              <option value="CUSTOMS">Customs / ICUMS</option>
              <option value="GLOBAL_CURRENCY">Global currency feed</option>
              <option value="MANUAL_OVERRIDE">Manual override</option>
            </select>
          </label>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.isOverride} onChange={(e) => setForm({ ...form, isOverride: e.target.checked })} />
          Manual override
        </label>
        {form.isOverride && (
          <label className="block text-sm">
            Override reason
            <input className="mt-1 w-full rounded-lg border px-3 py-2" value={form.overrideReason} onChange={(e) => setForm({ ...form, overrideReason: e.target.value })} />
          </label>
        )}
        <button type="button" disabled={pending || !form.rate} onClick={submit} className="rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-50">
          Save rate
        </button>
        {msg && <p className="text-sm text-muted-foreground">{msg}</p>}
      </section>

      <div className="overflow-x-auto rounded-xl border border-border dark:border-white/10">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs uppercase text-muted-foreground">
              <th className="px-3 py-2">Pair</th>
              <th className="px-3 py-2">Rate</th>
              <th className="px-3 py-2">Source</th>
              <th className="px-3 py-2">Effective</th>
              <th className="px-3 py-2">Override</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((row) => {
              const stale = isFxRateStale(row.effectiveDate, data.staleThresholdDays);
              return (
                <tr key={row.id} className="border-b border-border/50">
                  <td className="px-3 py-2 font-mono">{row.fromCurrency}/{row.toCurrency}</td>
                  <td className="px-3 py-2">{Number(row.rate)}</td>
                  <td className="px-3 py-2">
                    {row.source}
                    {stale && <span className="ml-2 text-amber-600">stale</span>}
                  </td>
                  <td className="px-3 py-2">{row.effectiveDate.toLocaleDateString()}</td>
                  <td className="px-3 py-2">{row.isOverride ? "Yes" : "No"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ListPaginationFooter
        page={data.page}
        pageSize={data.pageSize}
        totalPages={data.totalPages}
        totalItems={data.totalItems}
        itemLabel="FX rates"
        prevHref={data.page > 1 ? buildPageHref("/admin/duty/fx-rates", data.page - 1) : null}
        nextHref={data.page < data.totalPages ? buildPageHref("/admin/duty/fx-rates", data.page + 1) : null}
      />
    </div>
  );
}
