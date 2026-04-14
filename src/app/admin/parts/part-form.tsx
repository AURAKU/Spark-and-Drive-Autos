"use client";

import { PartListingState, PartOrigin, PartStockStatus, type Part } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";
import { toast } from "sonner";

import { createPart, updatePart, type PartActionState } from "@/actions/parts";
import { AdminRmbSellingPriceField } from "@/components/admin/admin-rmb-selling-price-field";
import { AdminZodIssues } from "@/components/admin/admin-zod-issues";
import { PartCoverField } from "@/components/admin/part-cover-field";
import { profitAmountRmb, profitMarginPercent } from "@/lib/admin-profit";
import { partStockStatusLabel } from "@/lib/part-stock";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

function tagsToString(tags: unknown): string {
  if (!Array.isArray(tags)) return "";
  return tags.filter((t): t is string => typeof t === "string").join(", ");
}

type Props = {
  mode: "create" | "edit";
  part?: Part;
  categories?: Array<{ id: string; name: string }>;
  onCreated?: (id: string) => void;
  cancelHref?: string;
};

export function PartForm({
  mode,
  part,
  categories = [],
  onCreated,
  cancelHref = "/admin/parts",
}: Props) {
  const router = useRouter();
  const action = mode === "create" ? createPart : updatePart;
  const [state, formAction] = useActionState(action, null as PartActionState);

  useEffect(() => {
    if (state?.ok && state.id && mode === "create") {
      toast.success("Part created");
      if (onCreated) {
        onCreated(state.id);
        return;
      }
      router.push(`/admin/parts/${state.id}/edit`);
    }
  }, [state, mode, router, onCreated]);

  useEffect(() => {
    if (state?.warning) {
      toast.warning(state.warning);
    }
  }, [state?.warning]);

  useEffect(() => {
    if (state?.ok && mode === "edit") {
      toast.success("Part saved");
      router.refresh();
    }
  }, [state?.ok, mode, router]);

  const select =
    "mt-1 h-10 w-full rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white outline-none ring-[var(--brand)]/30 focus:ring-2";

  const baseRmb = part != null ? Number(part.basePriceRmb) : 0;
  const costRmb = part?.supplierCostRmb != null ? Number(part.supplierCostRmb) : null;
  const profitRmb = part != null ? profitAmountRmb(baseRmb, costRmb) : null;
  const marginPct = part != null ? profitMarginPercent(baseRmb, costRmb) : null;

  return (
    <form action={formAction} className="mt-4 grid max-w-3xl gap-4 sm:grid-cols-2">
      {mode === "edit" && part ? <input type="hidden" name="id" value={part.id} /> : null}

      {state?.error && <p className="sm:col-span-2 text-sm text-red-400">{state.error}</p>}
      <AdminZodIssues issues={state?.issues} />

      <p className="sm:col-span-2 text-xs font-medium tracking-wide text-zinc-500 uppercase">Basics</p>
      <div className="sm:col-span-2">
        <Label htmlFor="title">Title</Label>
        <Input id="title" name="title" required className="mt-1" defaultValue={part?.title} />
      </div>
      {mode === "edit" && part ? (
        <div className="sm:col-span-2">
          <Label htmlFor="slug">URL slug</Label>
          <Input
            id="slug"
            name="slug"
            className="mt-1 font-mono text-sm"
            defaultValue={part.slug}
            placeholder="lowercase-with-hyphens"
          />
          <p className="mt-1 text-xs text-zinc-500">Public URL: /parts/{part.slug}</p>
        </div>
      ) : null}
      <div>
        <Label htmlFor="category">Category</Label>
        {categories.length > 0 ? (
          <select id="categoryId" name="categoryId" className={select} defaultValue={part?.categoryId ?? ""}>
            <option value="">Custom / text category</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        ) : null}
        <Input
          id="category"
          name="category"
          placeholder="e.g. Filters, Interior, Electronics"
          className="mt-1"
          defaultValue={part?.category}
        />
      </div>
      <div>
        <Label htmlFor="origin">Origin / availability lane</Label>
        <select id="origin" name="origin" className={select} required defaultValue={part?.origin ?? PartOrigin.GHANA}>
          {Object.values(PartOrigin).map((v) => (
            <option key={v} value={v}>
              {v === "GHANA" ? "Ghana-listed" : "China-listed"}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-zinc-500">
          China + &quot;Pre Order on Request&quot; auto-links air/sea delivery options from your templates.
        </p>
      </div>
      <div>
        <Label htmlFor="sku">SKU (optional)</Label>
        <Input id="sku" name="sku" className="mt-1" defaultValue={part?.sku ?? ""} />
      </div>

      <p className="sm:col-span-2 mt-2 text-xs font-medium tracking-wide text-zinc-500 uppercase">Pricing (admin)</p>
      <AdminRmbSellingPriceField
        label="Base selling price (RMB only)"
        description="Canonical list price — reference GHS is written to priceGhs on every save for admin and storefront quoting."
        defaultValue={part != null ? Number(part.basePriceRmb) : undefined}
        lastSavedReferenceGhs={part != null ? Number(part.priceGhs) : null}
      />
      <div>
        <Label htmlFor="supplierCostRmb">Supplier / distributor cost (RMB)</Label>
        <p className="mt-0.5 text-xs text-zinc-500">Admin-only — not shown to customers.</p>
        <Input
          id="supplierCostRmb"
          name="supplierCostRmb"
          type="number"
          min={0}
          step="0.01"
          className="mt-1"
          defaultValue={part?.supplierCostRmb != null ? Number(part.supplierCostRmb) : ""}
        />
      </div>
      <p className="sm:col-span-2 text-xs text-zinc-500">
        Checkout and Paystack charge in GHS; the saved reference amount tracks your last submitted conversion.
      </p>
      {mode === "edit" && part ? (
        <div className="sm:col-span-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-emerald-200/80">Admin profit (RMB)</p>
          <p className="mt-1 text-sm text-zinc-300">
            {profitRmb != null ? (
              <>
                <span className="font-semibold text-white">
                  CN¥{profitRmb.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </span>
                {marginPct != null ? (
                  <span className="text-zinc-500"> · margin {marginPct.toFixed(1)}% of list</span>
                ) : null}
              </>
            ) : (
              <span className="text-zinc-500">Enter supplier cost to see margin.</span>
            )}
          </p>
        </div>
      ) : null}

      <p className="sm:col-span-2 mt-2 text-xs font-medium tracking-wide text-zinc-500 uppercase">Availability</p>
      <div>
        <Label htmlFor="stockQty">Stock quantity</Label>
        <Input
          id="stockQty"
          name="stockQty"
          type="number"
          min={0}
          required
          className="mt-1"
          defaultValue={part?.stockQty ?? 0}
        />
        <p className="mt-1 text-xs text-zinc-500">Auto status: 0 = out,1–4 = low, 5+ = in stock (unless locked).</p>
      </div>
      <div>
        <Label htmlFor="stockStatus">Stock status</Label>
        <select
          id="stockStatus"
          name="stockStatus"
          className={select}
          required
          defaultValue={part?.stockStatus ?? PartStockStatus.IN_STOCK}
        >
          {Object.values(PartStockStatus).map((v) => (
            <option key={v} value={v}>
              {partStockStatusLabel(v)}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-end pb-2 sm:col-span-2">
        <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-300">
          <input
            type="checkbox"
            name="stockStatusLocked"
            value="on"
            defaultChecked={part?.stockStatusLocked ?? false}
            className="rounded border-white/20"
          />
          Lock stock status (manual override — required for &quot;Pre Order on Request&quot;)
        </label>
      </div>
      <div>
        <Label htmlFor="listingState">Listing state</Label>
        <select
          id="listingState"
          name="listingState"
          className={select}
          required
          defaultValue={part?.listingState ?? PartListingState.DRAFT}
        >
          {Object.values(PartListingState).map((v) => (
            <option key={v} value={v}>
              {v.replaceAll("_", " ")}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-end pb-2">
        <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-300">
          <input type="checkbox" name="featured" value="on" defaultChecked={part?.featured} className="rounded border-white/20" />
          Featured on storefront
        </label>
      </div>

      <p className="sm:col-span-2 mt-2 text-xs font-medium tracking-wide text-zinc-500 uppercase">Content</p>
      <div className="sm:col-span-2">
        <Label htmlFor="shortDescription">Short description</Label>
        <Textarea
          id="shortDescription"
          name="shortDescription"
          rows={2}
          className="mt-1"
          defaultValue={part?.shortDescription ?? ""}
          placeholder="One line for cards and search results"
        />
      </div>
      <div className="sm:col-span-2">
        <Label htmlFor="description">Full description</Label>
        <Textarea id="description" name="description" rows={6} className="mt-1" defaultValue={part?.description ?? ""} />
      </div>
      <div className="sm:col-span-2">
        <Label htmlFor="tags">Tags</Label>
        <Input
          id="tags"
          name="tags"
          className="mt-1"
          placeholder="Comma-separated: OEM, alloy, winter"
          defaultValue={part ? tagsToString(part.tags) : ""}
        />
      </div>

      <div className="sm:col-span-2 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <PartCoverField initialUrl={part?.coverImageUrl} initialPublicId={part?.coverImagePublicId} />
      </div>

      <div className="sm:col-span-2 flex flex-wrap gap-3">
        <Button type="submit">{mode === "create" ? "Create part" : "Save changes"}</Button>
        <Button type="button" variant="outline" className="border-white/15" onClick={() => router.push(cancelHref)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
