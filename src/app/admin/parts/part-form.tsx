"use client";

import { PartListingState, PartOrigin, PartStockStatus } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import type { DisplayCurrency } from "@/lib/currency";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { createPart, updatePart, type PartActionState } from "@/actions/parts";
import { AutofillUnmappedHint } from "@/components/admin/autofill-unmapped-hint";
import { AdminVehicleListPriceField } from "@/components/admin/admin-vehicle-list-price-field";
import { PasteSummaryAutofill } from "@/components/admin/paste-summary-autofill";
import { AdminZodIssues } from "@/components/admin/admin-zod-issues";
import { PartCoverField } from "@/components/admin/part-cover-field";
import { profitAmountRmb, profitMarginPercent } from "@/lib/admin-profit";
import {
  AUTOFILL_TOAST_REVIEW,
  getFormCheckboxChecked,
  getFormControlString,
  parsePartSummaryForAutofill,
  previewRowsFromPartParse,
  setFormControlString,
  shouldApplyAutofillCheckbox,
  shouldApplyAutofillEnum,
  shouldApplyAutofillNumber,
  shouldApplyAutofillText,
  shouldApplyListingPrice,
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
    partNumber: string | null;
    oemNumber: string | null;
    compatibleMake: string | null;
    compatibleModel: string | null;
    compatibleYearNote: string | null;
    brand: string | null;
    condition: string | null;
    warehouseLocation: string | null;
    countryOfOrigin: string | null;
    internalNotes: string | null;
    basePriceRmb: number;
    supplierCostRmb: number | null;
    priceGhs: number;
    sellingPriceCurrency: DisplayCurrency;
    supplierCostCurrency: DisplayCurrency;
    sellingDisplayAmount: number;
    supplierDisplayAmount: number | null;
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

const PART_PASTE_PLACEHOLDER = `Paste supplier or catalog text (10–30 lines), e.g.:
title: Honda CRV 2020 brake pads
part number: BP-2020-CRV
OEM: 45022-TLA-A00
supplier cost: CNY 120
selling price: GHS 350
quantity: 12
compatible vehicle: Honda CRV 2017-2022
brand: Bosch
condition: New
location: Shelf A2`;

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
  const [supplierCostKey, setSupplierCostKey] = useState(0);
  const [sellingSeed, setSellingSeed] = useState<{ amount?: number; currency?: DisplayCurrency } | undefined>(undefined);
  const [supplierSeed, setSupplierSeed] = useState<{ amount?: number; currency?: DisplayCurrency } | undefined>(undefined);
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
      partNumber: part?.partNumber ?? "",
      oemNumber: part?.oemNumber ?? "",
      compatibleMake: part?.compatibleMake ?? "",
      compatibleModel: part?.compatibleModel ?? "",
      compatibleYearNote: part?.compatibleYearNote ?? "",
      brand: part?.brand ?? "",
      condition: part?.condition ?? "",
      warehouseLocation: part?.warehouseLocation ?? "",
      countryOfOrigin: part?.countryOfOrigin ?? "",
      internalNotes: part?.internalNotes ?? "",
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
  const initialFeatured = part?.featured ?? false;
  const initialStockLocked = part?.stockStatusLocked ?? false;
  const initialSellingAmountStr =
    part != null && Number.isFinite(part.sellingDisplayAmount) ? String(part.sellingDisplayAmount) : "";
  const initialSellingCurrency = part?.sellingPriceCurrency ?? "GHS";
  const initialSupplierAmountStr =
    part?.supplierDisplayAmount != null && Number.isFinite(part.supplierDisplayAmount)
      ? String(part.supplierDisplayAmount)
      : "";
  const initialSupplierCurrency = part?.supplierCostCurrency ?? "GHS";

  async function applyPartSummary(raw: string, opts?: { overwrite?: boolean }) {
    const overwrite = opts?.overwrite ?? false;
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
        overwrite,
      )
    ) {
      setOriginLane(parsed.originEnum.value);
    }

    let bumpSelling = false;
    if (parsed.listPrice) {
      const applyAmount = shouldApplyListingPrice(
        getFormControlString(form, "sellingPriceAmount"),
        initialSellingAmountStr,
        parsed.listPrice,
        overwrite,
      );
      const applyCur = shouldApplyAutofillEnum(
        getFormControlString(form, "sellingPriceCurrency"),
        initialSellingCurrency,
        { value: parsed.listPrice.currency, confidence: parsed.listPrice.confidence },
        overwrite,
      );
      if (applyAmount || applyCur) {
        setSellingSeed({ amount: parsed.listPrice.amount, currency: parsed.listPrice.currency });
        bumpSelling = true;
      }
    }
    if (bumpSelling) setListingPriceKey((k) => k + 1);

    let bumpSupplier = false;
    if (parsed.supplierCost) {
      const applyAmount = shouldApplyListingPrice(
        getFormControlString(form, "supplierCostAmount"),
        initialSupplierAmountStr,
        parsed.supplierCost,
        overwrite,
      );
      const applyCur = shouldApplyAutofillEnum(
        getFormControlString(form, "supplierCostCurrency"),
        initialSupplierCurrency,
        { value: parsed.supplierCost.currency, confidence: parsed.supplierCost.confidence },
        overwrite,
      );
      if (applyAmount || applyCur) {
        setSupplierSeed({ amount: parsed.supplierCost.amount, currency: parsed.supplierCost.currency });
        bumpSupplier = true;
      }
    }
    if (bumpSupplier) setSupplierCostKey((k) => k + 1);

    const stockN = parsed.numberFields.stockQty;
    if (
      stockN &&
      shouldApplyAutofillNumber(getFormControlString(form, "stockQty"), initialStockQtyStr, stockN, overwrite)
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
      if (shouldApplyAutofillText(current, initial, { ...proposed, value: val }, overwrite)) {
        setFormControlString(form, key, val);
      }
    }

    if (
      parsed.featured &&
      shouldApplyAutofillCheckbox(getFormCheckboxChecked(form, "featured"), initialFeatured, parsed.featured, overwrite)
    ) {
      setFormControlString(form, "featured", parsed.featured.value ? "on" : "");
    }
    if (
      parsed.stockStatusLocked &&
      shouldApplyAutofillCheckbox(
        getFormCheckboxChecked(form, "stockStatusLocked"),
        initialStockLocked,
        parsed.stockStatusLocked,
        overwrite,
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
        <PasteSummaryAutofill
          buildPreviewRows={(t) => previewRowsFromPartParse(parsePartSummaryForAutofill(t))}
          onApply={(t, o) => void applyPartSummary(t, o)}
          placeholder={PART_PASTE_PLACEHOLDER}
        />
        <AutofillUnmappedHint items={autofillUnmapped} />
        <p className="mt-2 text-xs text-zinc-500">
          Labeled lines (e.g. <span className="font-mono text-zinc-400">OEM:</span>,{" "}
          <span className="font-mono text-zinc-400">selling price: GHS 350</span>) take priority. Values stop at commas or the
          next label. Heuristic rows are marked—please verify. Use <span className="font-medium text-zinc-300">Overwrite</span>{" "}
          only when you intend to replace fields you already filled.
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
          Lane controls pre-order badges and delivery templates. Selling price can be entered in{" "}
          <span className="font-medium text-zinc-300">GHS</span>, <span className="font-medium text-zinc-300">USD</span>, or{" "}
          <span className="font-medium text-zinc-300">CNY</span> regardless of lane; canonical valuation is stored as RMB.
        </p>
      </div>
      <div>
        <Label htmlFor="sku">SKU (optional)</Label>
        <Input id="sku" name="sku" className="mt-1" defaultValue={part?.sku ?? ""} />
      </div>
      <div>
        <Label htmlFor="partNumber">Part number (optional)</Label>
        <Input id="partNumber" name="partNumber" className="mt-1" defaultValue={part?.partNumber ?? ""} />
      </div>
      <div>
        <Label htmlFor="oemNumber">OEM number (optional)</Label>
        <Input id="oemNumber" name="oemNumber" className="mt-1" placeholder="e.g. 45022-TLA-A00" defaultValue={part?.oemNumber ?? ""} />
      </div>
      <div>
        <Label htmlFor="brand">Brand / manufacturer (optional)</Label>
        <Input id="brand" name="brand" className="mt-1" placeholder="e.g. Bosch" defaultValue={part?.brand ?? ""} />
      </div>

      <p className="sm:col-span-2 mt-2 text-xs font-medium tracking-wide text-zinc-500 uppercase">Compatibility</p>
      <div>
        <Label htmlFor="compatibleMake">Compatible make (optional)</Label>
        <Input id="compatibleMake" name="compatibleMake" className="mt-1" defaultValue={part?.compatibleMake ?? ""} />
      </div>
      <div>
        <Label htmlFor="compatibleModel">Compatible model (optional)</Label>
        <Input id="compatibleModel" name="compatibleModel" className="mt-1" defaultValue={part?.compatibleModel ?? ""} />
      </div>
      <div className="sm:col-span-2">
        <Label htmlFor="compatibleYearNote">Compatible years (optional)</Label>
        <Input
          id="compatibleYearNote"
          name="compatibleYearNote"
          className="mt-1"
          placeholder="e.g. 2017-2022 or 2020"
          defaultValue={part?.compatibleYearNote ?? ""}
        />
      </div>

      <p className="sm:col-span-2 mt-2 text-xs font-medium tracking-wide text-zinc-500 uppercase">Pricing (admin)</p>
      <AdminVehicleListPriceField
        key={`sell-${listingPriceKey}`}
        amountName="sellingPriceAmount"
        currencyName="sellingPriceCurrency"
        label="Selling price (list)"
        description="Amount and currency for the customer-facing list price. Checkout still settles in GHS from the derived RMB valuation."
        defaultAmount={sellingSeed?.amount ?? part?.sellingDisplayAmount}
        defaultCurrency={sellingSeed?.currency ?? part?.sellingPriceCurrency ?? "GHS"}
        lastSavedReferenceGhs={part != null ? Number(part.priceGhs) : null}
      />
      <AdminVehicleListPriceField
        key={`sup-${supplierCostKey}`}
        amountName="supplierCostAmount"
        currencyName="supplierCostCurrency"
        label="Supplier / distributor cost (optional)"
        description="Your landed or invoice cost — stored as RMB for margin; not shown to customers."
        defaultAmount={supplierSeed?.amount ?? part?.supplierDisplayAmount ?? undefined}
        defaultCurrency={supplierSeed?.currency ?? part?.supplierCostCurrency ?? "GHS"}
        required={false}
        previewVariant="supplier"
      />

      <p className="sm:col-span-2 text-xs text-zinc-500">
        Checkout and Paystack charge in GHS; reference GHS on the part row is updated whenever you save.
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
      <p className="sm:col-span-2 mt-2 text-xs font-medium tracking-wide text-zinc-500 uppercase">Inventory &amp; sourcing</p>
      <div>
        <Label htmlFor="condition">Condition (optional)</Label>
        <Input id="condition" name="condition" className="mt-1" placeholder="e.g. New, Used, Reman" defaultValue={part?.condition ?? ""} />
      </div>
      <div>
        <Label htmlFor="warehouseLocation">Location / warehouse (optional)</Label>
        <Input id="warehouseLocation" name="warehouseLocation" className="mt-1" defaultValue={part?.warehouseLocation ?? ""} />
      </div>
      <div>
        <Label htmlFor="countryOfOrigin">Country of origin (optional)</Label>
        <Input id="countryOfOrigin" name="countryOfOrigin" className="mt-1" defaultValue={part?.countryOfOrigin ?? ""} />
      </div>
      <div className="sm:col-span-2">
        <Label htmlFor="internalNotes">Internal notes (optional)</Label>
        <Textarea
          id="internalNotes"
          name="internalNotes"
          rows={3}
          className="mt-1"
          placeholder="Admin-only — not on the storefront"
          defaultValue={part?.internalNotes ?? ""}
        />
      </div>

      <p className="sm:col-span-2 mt-2 text-xs font-medium tracking-wide text-zinc-500 uppercase">Internal — supplier / distributor</p>
      <p className="sm:col-span-2 text-xs text-zinc-500">
        Admin-only — not shown on the storefront. Use to record where you sourced the product and a contact number for your
        own follow-up.
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
