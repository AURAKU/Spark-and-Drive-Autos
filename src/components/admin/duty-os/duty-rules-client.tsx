"use client";

import { useState, useTransition } from "react";
import Link from "next/link";

import {
  cloneRuleSetAction,
  publishRulesAction,
  retireRuleAction,
  runRegressionPreviewAction,
} from "@/actions/duty-admin-os";
import { buildPageHref } from "@/lib/duty-admin/pagination";
import { ListPaginationFooter } from "@/components/ui/list-pagination";
import { formatMoney } from "@/lib/format";

type Props = {
  data: Awaited<ReturnType<typeof import("@/actions/duty-admin-os").getDutyAdminRulesData>>;
};

export function DutyRulesClient({ data }: Props) {
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const draftIds = data.items.filter((r) => r.status === "DRAFT").map((r) => r.id);

  function handlePublish() {
    if (!window.confirm("Publish draft rules after regression passes? This supersedes active rules.")) return;
    startTransition(async () => {
      const result = await publishRulesAction({ ruleIds: draftIds, confirmRegression: true });
      if (result.error) setMsg(result.error);
      else {
        setMsg("Rules published successfully.");
        window.location.reload();
      }
    });
  }

  function handleRegression() {
    startTransition(async () => {
      const preview = await runRegressionPreviewAction();
      setMsg(
        preview.allPassed
          ? "All verified fixtures passed regression."
          : `Regression failed: ${preview.regressionResults.filter((r) => !r.ok).map((r) => r.fixtureId).join(", ")}`,
      );
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={handleRegression} disabled={pending} className="rounded-lg border px-3 py-2 text-sm">
          Run regression preview
        </button>
        <button
          type="button"
          onClick={handlePublish}
          disabled={pending || draftIds.length === 0}
          className="rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-50"
        >
          Publish draft rules ({draftIds.length})
        </button>
      </div>

      {msg && <p className="text-sm text-muted-foreground">{msg}</p>}

      <div className="rounded-xl border border-border dark:border-white/10">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-3 py-2">Charge</th>
                <th className="px-3 py-2">Profile</th>
                <th className="px-3 py-2">Rate</th>
                <th className="px-3 py-2">Base expression</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((rule) => (
                <tr key={rule.id} className="border-b border-border/50">
                  <td className="px-3 py-2 font-mono text-xs">{rule.chargeKey}</td>
                  <td className="px-3 py-2">{rule.profile?.make ? `${rule.profile.make} ${rule.profile.model}` : rule.profileId ?? "Global"}</td>
                  <td className="px-3 py-2">
                    {rule.rateType === "PERCENTAGE" ? `${Number(rule.rateValue) * 100}%` : formatMoney(Number(rule.flatAmount ?? 0))}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{rule.taxableBaseExpression}</td>
                  <td className="px-3 py-2">{rule.status}</td>
                  <td className="px-3 py-2">
                    {rule.status === "ACTIVE" && (
                      <button
                        type="button"
                        className="text-xs text-destructive"
                        onClick={() => startTransition(async () => { await retireRuleAction(rule.id); window.location.reload(); })}
                      >
                        Retire
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <section className="rounded-xl border border-border p-4 dark:border-white/10">
        <h3 className="text-sm font-semibold">Verified fixture regression (current engine)</h3>
        <ul className="mt-3 space-y-2 text-sm">
          {data.regression.regressionResults.map((r) => (
            <li key={r.fixtureId} className="flex justify-between gap-2">
              <span>{r.make} {r.model}</span>
              <span className={r.ok ? "text-emerald-600" : "text-destructive"}>
                {r.ok ? "PASS" : "FAIL"} {r.errorGhs != null ? `(Δ ${r.errorGhs} GHS)` : r.message}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <ListPaginationFooter
        page={data.page}
        pageSize={data.pageSize}
        totalPages={Math.max(1, Math.ceil(data.totalItems / data.pageSize))}
        totalItems={data.totalItems}
        itemLabel="rules"
        prevHref={data.page > 1 ? buildPageHref("/admin/duty/rules", data.page - 1) : null}
        nextHref={data.page < Math.ceil(data.totalItems / data.pageSize) ? buildPageHref("/admin/duty/rules", data.page + 1) : null}
      />
    </div>
  );
}
