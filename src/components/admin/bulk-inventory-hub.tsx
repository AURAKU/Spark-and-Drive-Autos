"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CAR_BULK_COLUMNS, PART_BULK_COLUMNS } from "@/lib/inventory-bulk";
import { cn } from "@/lib/utils";

export type BulkInventoryRow = {
  id: string;
  slug: string;
  title: string;
  meta: string;
  updatedAt: string;
};

type Props = {
  inventory: "cars" | "parts";
  rows: BulkInventoryRow[];
  totalCount: number;
  q: string;
  sort: "updated" | "title";
  recentImports: Array<{ id: string; entity: string; status: string; summary: string | null }>;
};

export function BulkInventoryHub({ inventory, rows, totalCount, q, sort, recentImports }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const entityApi = inventory === "cars" ? "CARS" : "PARTS";

  const allIds = useMemo(() => rows.map((r) => r.id), [rows]);

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAllOnPage = useCallback(() => {
    setSelected(new Set(allIds));
  }, [allIds]);

  const clearSelection = useCallback(() => setSelected(new Set()), []);

  async function downloadExport(ids: string[] | null) {
    start(async () => {
      try {
        const res = await fetch("/api/admin/import-export/export", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            entity: entityApi,
            ...(ids && ids.length > 0 ? { ids } : {}),
            ...(q.trim() ? { q: q.trim() } : {}),
            sort,
          }),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          toast.error(typeof j.error === "string" ? j.error : "Export failed");
          return;
        }
        const blob = await res.blob();
        const cd = res.headers.get("content-disposition") ?? "";
        const m = /filename="([^"]+)"/.exec(cd);
        const filename = m?.[1] ?? (inventory === "cars" ? "cars-bulk.csv" : "parts-bulk.csv");
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        toast.success("Download started");
        router.refresh();
      } catch {
        toast.error("Export failed");
      }
    });
  }

  async function onImportFile(file: File) {
    const text = await file.text();
    if (!text.trim()) {
      toast.error("File is empty");
      return;
    }
    start(async () => {
      try {
        const res = await fetch("/api/admin/import-export/import", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ entity: entityApi, csv: text }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          toast.error(typeof data.error === "string" ? data.error : "Import failed");
          return;
        }
        toast.success(`Import finished: ${data.imported ?? 0} ok, ${data.failed ?? 0} failed`);
        clearSelection();
        router.refresh();
      } catch {
        toast.error("Import failed");
      }
    });
  }

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-1">
          <TabLink
            href={`/admin/import-export?inventory=cars${q.trim() ? `&q=${encodeURIComponent(q.trim())}` : ""}${sort !== "updated" ? `&sort=${sort}` : ""}`}
            active={inventory === "cars"}
          >
            Cars inventory
          </TabLink>
          <TabLink
            href={`/admin/import-export?inventory=parts${q.trim() ? `&q=${encodeURIComponent(q.trim())}` : ""}${sort !== "updated" ? `&sort=${sort}` : ""}`}
            active={inventory === "parts"}
          >
            Parts inventory
          </TabLink>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          <Link href={inventory === "cars" ? "/admin/cars" : "/admin/parts"} className="text-[var(--brand)] hover:underline">
            Open {inventory === "cars" ? "Cars" : "Parts"} management →
          </Link>
        </div>
      </div>

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <h2 className="text-sm font-semibold text-white">Filter &amp; sort (this page)</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Up to 2,000 rows loaded. Export uses the same filters when no rows are ticked — tick rows to export only those
          IDs.
        </p>
        <form className="mt-4 flex flex-wrap items-end gap-3" method="get">
          <input type="hidden" name="inventory" value={inventory} />
          <div className="space-y-1">
            <label className="text-[11px] text-zinc-500">Search</label>
            <Input name="q" defaultValue={q} placeholder="Title, slug, brand…" className="w-64 border-white/15 bg-black/40" />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] text-zinc-500">Sort</label>
            <select
              name="sort"
              defaultValue={sort}
              className="h-10 rounded-lg border border-white/15 bg-black/40 px-3 text-sm text-white"
            >
              <option value="updated">Recently updated</option>
              <option value="title">Title A–Z</option>
            </select>
          </div>
          <Button type="submit" variant="secondary" disabled={pending}>
            Apply
          </Button>
        </form>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-white">Selection</h2>
          <p className="text-xs text-zinc-500">
            {selected.size} selected · {rows.length} on page · {totalCount} total match
          </p>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="secondary" onClick={selectAllOnPage} disabled={pending || rows.length === 0}>
            Select all on page
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={clearSelection} disabled={pending || selected.size === 0}>
            Clear selection
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => void downloadExport(selected.size > 0 ? Array.from(selected) : null)}
            disabled={pending || rows.length === 0}
          >
            {selected.size > 0 ? `Export ${selected.size} selected` : "Export all (filtered)"}
          </Button>
        </div>

        <div className="mt-4 overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-white/10 bg-black/30 text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="w-10 px-3 py-2">
                  <input
                    type="checkbox"
                    aria-label="Select all on page"
                    checked={rows.length > 0 && selected.size === rows.length}
                    onChange={(e) => (e.target.checked ? selectAllOnPage() : clearSelection())}
                  />
                </th>
                <th className="px-3 py-2">Title</th>
                <th className="px-3 py-2">Details</th>
                <th className="px-3 py-2">Slug</th>
                <th className="px-3 py-2">Updated</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                  <td className="px-3 py-2">
                    <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)} aria-label={`Select ${r.title}`} />
                  </td>
                  <td className="px-3 py-2 font-medium text-zinc-200">{r.title}</td>
                  <td className="max-w-[240px] truncate px-3 py-2 text-zinc-500">{r.meta}</td>
                  <td className="px-3 py-2 font-mono text-xs text-zinc-500">{r.slug}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-zinc-500">{r.updatedAt.slice(0, 16)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 ? <p className="p-6 text-sm text-zinc-500">No rows match this filter.</p> : null}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h2 className="text-sm font-semibold text-white">Download template (CSV for Excel)</h2>
          <p className="mt-1 text-xs text-zinc-500">
            First row is headers — must match export. Leave <code className="rounded bg-black/40 px-1">id</code> empty to
            create; set <code className="rounded bg-black/40 px-1">id</code> to update an existing row.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <a
              href={`/api/admin/import-export/template?entity=${entityApi}`}
              className={buttonVariants({ variant: "secondary", size: "sm" })}
            >
              Template ({inventory})
            </a>
            <a
              href={`/api/admin/import-export/export?entity=${entityApi}&sort=${sort}${q.trim() ? `&q=${encodeURIComponent(q.trim())}` : ""}`}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Quick export CSV (GET)
            </a>
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h2 className="text-sm font-semibold text-white">Import CSV</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Save as CSV UTF-8 from Excel. Images: absolute HTTPS URLs only. Videos are not imported here.
          </p>
          <label className="mt-4 flex cursor-pointer flex-col gap-2">
            <span className="text-xs text-zinc-400">Choose file…</span>
            <Input
              type="file"
              accept=".csv,text/csv"
              disabled={pending}
              className="border-white/15 bg-black/40"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) void onImportFile(f);
              }}
            />
          </label>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <h2 className="text-sm font-semibold text-white">Column reference</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Enum values must match Prisma exactly (e.g. engineType: GASOLINE, ELECTRIC, HYBRID, PLUGIN_HYBRID).
        </p>
        <pre className="mt-3 max-h-48 overflow-auto rounded-lg bg-black/50 p-3 text-[11px] leading-relaxed text-zinc-400">
          {inventory === "cars" ? CAR_BULK_COLUMNS.join(", ") : PART_BULK_COLUMNS.join(", ")}
        </pre>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <h2 className="text-sm font-semibold text-white">Recent imports</h2>
        <ul className="mt-3 space-y-2 text-sm text-zinc-300">
          {recentImports.length === 0 ? (
            <li className="text-zinc-500">No jobs yet.</li>
          ) : (
            recentImports.map((j) => (
              <li key={j.id} className="flex flex-wrap justify-between gap-2">
                <span>{j.entity}</span>
                <span className="text-zinc-500">{j.status}</span>
                <span className="w-full text-xs text-zinc-600">{j.summary}</span>
              </li>
            ))
          )}
        </ul>
      </section>
    </div>
  );
}

function TabLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={cn(
        "rounded-lg px-4 py-2 text-sm font-medium transition",
        active ? "bg-[var(--brand)]/15 text-white" : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200",
      )}
    >
      {children}
    </Link>
  );
}
