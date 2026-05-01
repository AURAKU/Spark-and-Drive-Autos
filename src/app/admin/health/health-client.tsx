"use client";

import { useEffect, useState } from "react";

type Checks = Record<string, boolean | string | null>;

export function AdminHealthClient() {
  const [data, setData] = useState<{
    ok?: boolean;
    criticalOk?: boolean;
    fullStackReady?: boolean;
    checks?: Checks;
    error?: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/admin/health/readiness", { cache: "no-store" });
        const json = (await res.json()) as typeof data;
        if (!cancelled) {
          if (!res.ok) setData({ error: (json as { error?: string })?.error ?? res.statusText });
          else setData(json);
        }
      } catch (e) {
        if (!cancelled) setData({ error: e instanceof Error ? e.message : "Request failed" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!data) {
    return <p className="text-sm text-zinc-400">Loading readiness…</p>;
  }
  if (data.error) {
    return <p className="text-sm text-amber-200">Could not load readiness: {data.error}</p>;
  }

  const checks = data.checks ?? {};
  const entries = Object.entries(checks);
  const critical = data.criticalOk ?? data.ok;

  return (
    <div className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span
          className={`rounded-full px-3 py-1 font-medium ${
            critical ? "bg-emerald-500/20 text-emerald-200" : "bg-rose-500/20 text-rose-100"
          }`}
        >
          Critical path: {critical ? "OK" : "Check failures"}
        </span>
        {data.fullStackReady === false ? (
          <span className="rounded-full bg-amber-500/15 px-3 py-1 text-amber-100">
            Some optional services not configured (see table)
          </span>
        ) : null}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[320px] text-left text-sm">
          <thead className="border-b border-white/10 text-xs uppercase text-zinc-500">
            <tr>
              <th className="py-2 pr-3">Check</th>
              <th className="py-2">Status / value</th>
            </tr>
          </thead>
          <tbody>
            {entries.map(([k, v]) => (
              <tr key={k} className="border-b border-white/5">
                <td className="py-2 pr-3 font-mono text-xs text-zinc-400">{k}</td>
                <td className="py-2 text-zinc-200">
                  {typeof v === "boolean" ? (
                    <span className={v ? "text-emerald-300" : "text-rose-300"}>{v ? "yes" : "no"}</span>
                  ) : (
                    String(v ?? "—")
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
