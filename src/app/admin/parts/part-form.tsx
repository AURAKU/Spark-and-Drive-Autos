"use client";

import { PartListingState, PartOrigin, PartStockStatus } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { createPart, updatePart, type PartActionState } from "@/actions/parts";
import { AutofillUnmappedHint } from "@/components/admin/autofill-unmapped-hint";
import { PasteSummaryAutofill } from "@/components/admin/paste-summary-autofill";
import { AdminGhsSellingPriceField } from "@/components/admin/admin-ghs-selling-price-field";
import { AdminRmbSellingPriceField } from "@/components/admin/admin-rmb-selling-price-field";
import { AdminZodIssues } from "@/components/admin/admin-zod-issues";
import { PartCoverField } from "@/components/admin/part-cover-field";
import { profitAmountRmb, profitMarginPercent } from "@/lib/admin-profit";
import {
  AUTOFILL_TOAST_REVIEW,
  getFormCheckboxChecked,
  getFormControlString,
  parsePartSummaryForAutofill,
  setFormControlString,
  shouldApplyAutofillCheckbox,
  shouldApplyAutofillEnum,
  shouldApplyAutofillNumber,
  shouldApplyAutofillText,
} from "@/lib/admin-summary-autofill";
import { partStockStatusLabel } from "@/lib/part-stock";
import { parsePartOptionsMeta } from "@/lib/part-variant-options";
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
  part?: {
    id: string;
    slug: string;
    title: string;
    shortDescription: string | null;
    description: string | null;
    category: string;
    categoryId: string | null;
    origin: PartOrigin;
    sku: string | null;
    basePriceRmb: number;
    supplierCostRmb: number | null;
    priceGhs: number;
    stockQty: number;
    stockStatus: PartStockStatus;
    stockStatusLocked: boolean;
    listingState: PartListingState;
    tags: unknown;
    coverImageUrl: string | null;
    coverImagePublicId: string | null;
    featured: boolean;
    metaJson: Prisma.JsonValue | null;
    supplierDistributorRef: string | null;
    supplierDistributorPhone: string | null;
  };
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
  const formRef = useRef<HTMLFormElement>(null);
  const action = mode === "create" ? createPart : updatePart;
  const [state, formAction] = useActionState(action, null as PartActionState);
  const [originLane, setOriginLane] = useState<PartOrigin>(part?.origin ?? PartOrigin.GHANA);
  const [listingPriceKey, setListingPriceKey] = useState(0);
  const [priceGhsSeed, setPriceGhsSeed] = useState<number | undefined>(undefined);
  const [priceRmbSeed, setPriceRmbSeed] = useState<number | undefined>(undefined);
  const [autofillUnmapped, setAutofillUnmapped] = useState<string[]>([]);

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

  useEffect(() => {
    if (part?.origin) setOriginLane(part.origin);
  }, [part?.origin]);

  const select =
    "mt-1 h-10 w-full rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white outline-none ring-[var(--brand)]/30 focus:ring-2";

  const baseRmb = part != null ? part.basePriceRmb : 0;
  const costRmb = part?.supplierCostRmb ?? null;
  const profitRmb = part != null ? profitAmountRmb(baseRmb, costRmb) : null;
  const marginPct = part != null ? profitMarginPercent(baseRmb, costRmb) : null;
  const optionDefaults = part ? parsePartOptionsMeta(part.metaJson) : { colors: [], sizes: [], types: [] };
  const optionLines = (list: string[]) => list.join("\n");

  const initialTextFields = useMemo(() => {
    const opts = part ? parsePartOptionsMeta(part.metaJson) : { colors: [], sizes: [], types: [] };
    const s: Record<string, string> = {
      title: part?.title ?? "",
      category: part?.category ?? "",
      sku: part?.sku ?? "",
      shortDescription: part?.shortDescription ?? "",
      description: part?.description ?? "",
      tags: part ? tagsToString(part.tags) : "",
      supplierDistributorRef: part?.supplierDistributorRef ?? "",
      supplierDistributorPhone: part?.supplierDistributorPhone ?? "",
      optionColors: optionLines(opts.colors),
      optionSizes: optionLines(opts.sizes),
    };
    if (mode === "edit" && part) s.slug = part.slug;
    return s;
  }, [part, mode]);

  const initialOrigin = part?.origin ?? PartOrigin.GHANA;
  const initialStockQtyStr = part != null ? String(part.stockQty) : "0";
  const initialSupplierCostStr = part?.supplierCostRmb != null ? String(part.supplierCostRmb) : "";
  const initialFeatured = part?.featured ?? false;
  const initialStockLocked = part?.stockStatusLocked ?? false;
  const initialPriceGhsStr = part != null ? String(Math.round(Number(part.priceGhs))) : "";
  const initialPriceRmbStr = part != null ? String(part.basePriceRmb) : "";

  function applyPartSummary(raw: string) {
    const trimmed = raw.trim();
    if (!trimmed) {
      setAutofillUnmapped([]);
      toast.error("Paste or type something in the summary box first.");
      return;
    }
    const parsed = parsePartSummaryForAutofill(trimmed);
    setAutofillUnmapped(parsed.unmappedConcepts);
    const form = formRef.current;
    if (!form) return;

    if (
      parsed.originEnum &&
      shouldApplyAutofillEnum(
        originLane,
        initialOrigin,
        { value: parsed.originEnum.value, confidence: parsed.originEnum.confidence },
      )
    ) {
      setOriginLane(parsed.originEnum.value);
    }

    let bumpPrice = false;
    if (
      parsed.basePriceGhs &&
      shouldApplyAutofillNumber(getFormControlString(form, "basePriceGhs"), initialPriceGhsStr, parsed.basePriceGhs)
    ) {
      setPriceGhsSeed(parsed.basePriceGhs.value);
      bumpPrice = true;
    }
    if (
      parsed.basePriceRmb &&
      shouldApplyAutofillNumber(getFormControlString(form, "basePriceRmb"), initialPriceRmbStr, parsed.basePriceRmb)
    ) {
      setPriceRmbSeed(parsed.basePriceRmb.value);
      bumpPrice = true;
    }
    if (bumpPrice) setListingPriceKey((k) => k + 1);

    const supCost = parsed.numberFields.supplierCostRmb;
    if (
      supCost &&
      shouldApplyAutofillNumber(getFormControlString(form, "supplierCostRmb"), initialSupplierCostStr, supCost)
    ) {
      setFormControlString(form, "supplierCostRmb", String(supCost.value));
    }

    const stockN = parsed.numberFields.stockQty;
    if (
      stockN &&
      shouldApplyAutofillNumber(getFormControlString(form, "stockQty"), initialStockQtyStr, stockN)
    ) {
      setFormControlString(form, "stockQty", String(stockN.value));
    }

    for (const [key, proposed] of Object.entries(parsed.stringFields)) {
      if (!proposed?.value) continue;
      const initial = initialTextFields[key] ?? "";
      const current = getFormControlString(form, key);
      let val = proposed.value;
      if (key === "optionColors" || key === "optionSizes") {
        val = val.includes("\n") ? val : val.split(",").map((s) => s.trim()).filter(Boolean).join("\n");
      }
      if (shouldApplyAutofillText(current, initial, { ...proposed, value: val })) {
        setFormControlString(form, key, val);
      }
    }

    if (
      parsed.featured &&
      shouldApplyAutofillCheckbox(getFormCheckboxChecked(form, "featured"), initialFeatured, parsed.featured)
    ) {
      setFormControlString(form, "featured", parsed.featured.value ? "on" : "");
    }
    if (
      parsed.stockStatusLocked &&
      shouldApplyAutofillCheckbox(
        getFormCheckboxChecked(form, "stockStatusLocked"),
        initialStockLocked,
        parsed.stockStatusLocked,
      )
    ) {
      setFormControlString(form, "stockStatusLocked", parsed.stockStatusLocked.value ? "on" : "");
    }

    toast.info(AUTOFILL_TOAST_REVIEW);
  }

  return (
    <form ref={formRef} action={formAction} className="mt-4 grid max-w-3xl gap-4 sm:grid-cols-2">
      {mode === "edit" && part ? <input type="hidden" name="id" value={part.id} /> : null}

      {state?.error && <p className="sm:col-span-2 text-sm text-red-400">{state.error}</p>}
      <AdminZodIssues issues={state?.issues} />

      <div className="sm:col-span-2 rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <PasteSummaryAutofill onAutofill={applyPartSummary} />
        <AutofillUnmappedHint items={autofillUnmapped} />
        <p className="mt-2 text-xs text-zinc-500">
          Labeled lines (e.g. <span className="font-mono text-zinc-400">Title:</span>,{" "}
          <span className="font-mono text-zinc-400">SKU:</span>, <span className="font-mono text-zinc-400">price GHS:</span>)
          are applied first; free text fills short description when safe. Origin, stock, and checkboxes respect your edits unless
          the summary line is clearly labeled.
        </p>
      </div>

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
        <select
          id="origin"
          name="origin"
          className={select}
          required
          value={originLane}
          onChange={(e) => setOriginLane(e.target.value as PartOrigin)}
        >
          <option value={PartOrigin.GHANA}>Available in Ghana</option>
          <option value={PartOrigin.CHINA}>China (Pre-order)</option>
        </select>
        <p className="mt-1 text-xs text-zinc-500">
          <span className="text-zinc-300">Ghana stock:</span> set the list price in{" "}
          <span className="font-medium text-zinc-200">Ghana cedis (GHS)</span> below.{" "}
          <span className="text-zinc-300">China:</span> list price in RMB. For China, the public badge still reflects
          in-stock vs pre-order from <span className="text-zinc-400">stock status</span> below. Lock status if you use
          &quot;Pre Order on Request&quot;.
        </p>
      </div>
      <div>
        <Label htmlFor="sku">SKU (optional)</Label>
        <Input id="sku" name="sku" className="mt-1" defaultValue={part?.sku ?? ""} />
      </div>

      <p className="sm:col-span-2 mt-2 text-xs font-medium tracking-wide text-zinc-500 uppercase">Pricing (admin)</p>
      {originLane === PartOrigin.GHANA ? (
        <AdminGhsSellingPriceField
          key={`ghs-${listingPriceKey}`}
          label="Base selling price (GHS / cedis)"
          description="Set the customer-facing list price in Ghana cedis. The system also stores the matching RMB equivalent for the catalog."
          defaultValue={priceGhsSeed ?? (part != null ? Number(part.priceGhs) : undefined)}
        />
      ) : (
        <AdminRmbSellingPriceField
          key={`rmb-${listingPriceKey}`}
          label="Base selling price (RMB only)"
          description="Canonical list price in RMB — reference GHS is written to priceGhs on every save for admin and storefront quoting."
          defaultValue={priceRmbSeed ?? (part != null ? Number(part.basePriceRmb) : undefined)}
          lastSavedReferenceGhs={part != null ? Number(part.priceGhs) : null}
        />
      )}
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
          defaultValue={part?.supplierCostRmb ?? ""}
        />
      </div>
      <p className="sm:col-span-2 text-xs text-zinc-500">
        Checkout and Paystack charge in GHS; the saved reference amount tracks your last submitted conversion.
      </p>
      <p className="sm:col-span-2 mt-2 text-xs font-medium tracking-wide text-zinc-500 uppercase">Storefront options</p>
      <p className="sm:col-span-2 text-xs text-zinc-500">
        One value per line. Leave a field empty to hide that choice on the catalog. Customers will see color options on the
        product page and must pick from your list before adding to cart.
      </p>
      <div>
        <Label htmlFor="optionColors">Color options (optional)</Label>
        <Textarea
          id="optionColors"
          name="optionColors"
          rows={3}
          className="mt-1 font-mono text-sm"
          placeholder={"Red\nBlack\nSilver"}
          defaultValue={optionLines(optionDefaults.colors)}
        />
      </div>
      <div>
        <Label htmlFor="optionSizes">Size options (optional)</Label>
        <Textarea
          id="optionSizes"
          name="optionSizes"
          rows={3}
          className="mt-1 font-mono text-sm"
          placeholder={"M\nL\nXL"}
          defaultValue={optionLines(optionDefaults.sizes)}
        />
      </div>
      <p className="sm:col-span-2 mt-2 text-xs font-medium tracking-wide text-zinc-500 uppercase">Internal — supplier / distributor</p>
      <p className="sm:col-span-2 text-xs text-zinc-500">
        Admin-only — not shown on the storefront (same as supplier cost above). Use to record where you sourced the
        product and a contact number for your own follow-up.
      </p>
      <div className="sm:col-span-2">
        <Label htmlFor="supplierDistributorRef">Reference / source note</Label>
        <Textarea
          id="supplierDistributorRef"
          name="supplierDistributorRef"
          rows={2}
          className="mt-1"
          placeholder="e.g. Supplier name, order #, WeChat / platform"
          defaultValue={part?.supplierDistributorRef ?? ""}
        />
      </div>
      <div>
        <Label htmlFor="supplierDistributorPhone">Supplier / distributor phone</Label>
        <Input
          id="supplierDistributorPhone"
          name="supplierDistributorPhone"
          type="tel"
          className="mt-1"
          placeholder="+86 …"
          defaultValue={part?.supplierDistributorPhone ?? ""}
        />
      </div>
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
        <PartCoverField
          key={part?.id ?? "new-part-cover"}
          initialUrl={part?.coverImageUrl ?? null}
          initialPublicId={part?.coverImagePublicId ?? null}
        />
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
