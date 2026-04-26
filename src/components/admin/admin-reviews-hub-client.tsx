"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  adminDeleteReviewAction,
  adminReassignPartReviewUserAction,
  adminUpsertPartReviewAsUserAction,
} from "@/actions/admin-reviews";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export type AdminReviewRow = {
  id: string;
  status: string;
  rating: number;
  body: string;
  authorName?: string | null;
  verifiedPurchase: boolean;
  createdAt: string;
  part: { id: string; title: string; slug: string } | null;
  user: { name: string | null } | null;
};

export type AdminReviewPartOption = { id: string; title: string; slug: string };

type Props = { rows: AdminReviewRow[]; partOptions: AdminReviewPartOption[] };

function Stars({ rating }: { rating: number }) {
  const n = Math.min(5, Math.max(0, rating));
  return (
    <span className="text-amber-400" aria-hidden>
      {"★".repeat(n)}
      <span className="text-zinc-600">{"☆".repeat(5 - n)}</span>
    </span>
  );
}

export function AdminReviewsHubClient({ rows, partOptions }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [openId, setOpenId] = useState<string | null>(rows[0]?.id ?? null);

  const sorted = useMemo(
    () => [...rows].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [rows],
  );
  const groupedByPart = useMemo(() => {
    const m = new Map<string, AdminReviewRow[]>();
    for (const row of sorted) {
      const key = row.part ? `${row.part.id}:${row.part.title}` : "legacy:No linked product";
      const arr = m.get(key) ?? [];
      arr.push(row);
      m.set(key, arr);
    }
    return [...m.entries()];
  }, [sorted]);

  const selected = useMemo(() => sorted.find((r) => r.id === openId) ?? null, [sorted, openId]);

  useEffect(() => {
    if (openId && !rows.some((r) => r.id === openId)) {
      setOpenId(rows[0]?.id ?? null);
    }
  }, [rows, openId]);

  function run(action: () => Promise<{ ok?: boolean; error?: string }>, okMsg: string) {
    start(async () => {
      const res = await action();
      if (res.error) toast.error(res.error);
      else {
        toast.success(okMsg);
        router.refresh();
      }
    });
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="space-y-6">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h2 className="text-sm font-semibold text-white">Publish review (customer view)</h2>
          <p className="mt-1 text-xs leading-relaxed text-zinc-500">
            Adds a live review directly to product inventory. Optionally link it to a system account, or leave account
            empty and publish with a custom display name only.
          </p>
          <form
            className="mt-4 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              run(async () => adminUpsertPartReviewAsUserAction(null, fd), "Review saved");
            }}
          >
            <div className="space-y-1">
              <Label className="text-xs text-zinc-500">Product</Label>
              <select
                name="partId"
                required
                className="h-10 w-full max-w-md rounded-lg border border-white/15 bg-black/40 px-3 text-sm text-white"
              >
                <option value="">Select part…</option>
                {partOptions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-zinc-500">Reviewer display name</Label>
              <Input
                name="authorName"
                required
                placeholder="e.g. Kofi Mensah"
                className="max-w-md border-white/15 bg-black/40"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-zinc-500">Optional linked account username</Label>
              <Input
                name="userName"
                placeholder="e.g. Kofi Mensah (optional)"
                className="max-w-md border-white/15 bg-black/40"
              />
            </div>
            <div className="flex flex-wrap gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-zinc-500">Rating</Label>
                <select name="rating" required className="h-10 rounded-lg border border-white/15 bg-black/40 px-3 text-sm text-white">
                  {[5, 4, 3, 2, 1].map((n) => (
                    <option key={n} value={n}>
                      {n} stars
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-zinc-500">Review text</Label>
              <Textarea name="body" required rows={4} className="border-white/15 bg-black/40 text-sm" placeholder="Text shown on the storefront…" />
            </div>
            <Button type="submit" disabled={pending}>
              Publish review now
            </Button>
          </form>
        </div>

        <div>
          <h2 className="text-sm font-semibold text-white">Inventory-organized reviews</h2>
          <p className="mt-1 text-xs text-zinc-500">Grouped by product so stars and comments are easy to scan.</p>
          <div className="mt-3 max-h-[min(70vh,560px)] space-y-3 overflow-y-auto rounded-xl border border-white/10 p-2">
            {groupedByPart.map(([group, entries]) => {
              const groupTitle = group.split(":").slice(1).join(":");
              return (
                <div key={group} className="rounded-lg border border-white/10 bg-black/20 p-2">
                  <p className="px-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                    {groupTitle} ({entries.length})
                  </p>
                  <ul className="mt-2 space-y-1">
                    {entries.map((r) => (
                      <li key={r.id}>
                        <button
                          type="button"
                          onClick={() => setOpenId(r.id)}
                          className={`flex w-full flex-col items-start rounded-lg px-3 py-2 text-left text-sm transition hover:bg-white/5 ${
                            r.id === openId ? "bg-white/10 text-white" : "text-zinc-300"
                          }`}
                        >
                          <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                            <Stars rating={r.rating} /> · {r.status}
                          </span>
                          <span className="mt-0.5 line-clamp-2 text-xs text-zinc-400">{r.body}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        {!selected ? (
          <p className="text-sm text-zinc-500">Select a review.</p>
        ) : (
          <div className="space-y-5">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Status</p>
              <p className="text-sm font-medium text-white">{selected.status}</p>
              <div className="mt-2 flex items-center gap-2">
                <Stars rating={selected.rating} />
                {selected.verifiedPurchase ? (
                  <span className="text-[10px] uppercase tracking-wide text-emerald-400/90">Verified purchase</span>
                ) : null}
              </div>
              <p className="mt-3 text-sm leading-relaxed text-zinc-300">{selected.body}</p>
              <p className="mt-2 text-xs text-zinc-500">
                {selected.authorName?.trim() || selected.user?.name?.trim() || "Customer"}
                {selected.user?.name?.trim() ? "" : " · no linked account"}
              </p>
              {selected.part ? (
                <p className="mt-2 text-xs">
                  <Link className="text-[var(--brand)] hover:underline" href={`/parts/${selected.part.slug}`} target="_blank" rel="noreferrer">
                    Open product →
                  </Link>
                </p>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-2 border-t border-white/10 pt-4">
              <Button
                type="button"
                size="sm"
                variant="destructive"
                disabled={pending}
                onClick={() => {
                  if (!confirm("Permanently delete this review?")) return;
                  const fd = new FormData();
                  fd.set("reviewId", selected.id);
                  run(async () => adminDeleteReviewAction(null, fd), "Deleted");
                }}
              >
                Delete
              </Button>
            </div>

            {selected.part ? (
              <form
                className="space-y-2 border-t border-white/10 pt-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  run(async () => adminReassignPartReviewUserAction(null, fd), "Author updated");
                }}
              >
                <input type="hidden" name="reviewId" value={selected.id} />
                <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Reassign to another account</h3>
                <p className="text-[11px] text-zinc-600">Use the target username (display name). Storefront shows username only.</p>
                <Input
                  name="userName"
                  required
                  placeholder="e.g. Kofi Mensah"
                  className="max-w-sm border-white/15 bg-black/40"
                />
                <Button type="submit" size="sm" disabled={pending}>
                  Reassign author
                </Button>
              </form>
            ) : (
              <p className="border-t border-white/10 pt-4 text-xs text-zinc-600">
                Legacy reviews without a product link cannot be reassigned here.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
