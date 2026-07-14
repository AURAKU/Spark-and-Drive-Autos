"use client";

import { useMemo, useState } from "react";

import type { AutofillConfidence } from "@/lib/admin-summary-autofill";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { MotorcycleSummaryAutofillResult } from "@/lib/motorcycle-summary-autofill";
import {
  parseMotorcycleSummaryForAutofill,
  previewRowsFromMotorcycleParse,
} from "@/lib/motorcycle-summary-autofill";

export type MotorcycleAutofillReviewRow = {
  key: string;
  field: string;
  value: string;
  confidence?: AutofillConfidence;
  currentValue?: string;
  conflict: boolean;
};

type Props = {
  className?: string;
  placeholder?: string;
  /** Current form values keyed by form field name (for conflict detection). */
  getCurrentValues: () => Record<string, string>;
  /** Apply selected parsed fields. Keys are stable field keys from review rows. */
  onApplySelected: (
    parsed: MotorcycleSummaryAutofillResult,
    selectedKeys: Set<string>,
    options: { overwrite: boolean },
  ) => void | Promise<void>;
};

function buildReviewRows(
  parsed: MotorcycleSummaryAutofillResult,
  current: Record<string, string>,
): MotorcycleAutofillReviewRow[] {
  const rows: MotorcycleAutofillReviewRow[] = [];
  if (parsed.listingPrice) {
    const key = "listingPrice";
    const currentValue = current.basePriceAmount
      ? `${current.basePriceAmount} ${current.basePriceCurrency ?? ""}`.trim()
      : "";
    const value = `${parsed.listingPrice.amount.toLocaleString()} ${parsed.listingPrice.currency}`;
    rows.push({
      key,
      field: "Price",
      value,
      confidence: parsed.listingPrice.confidence,
      currentValue: currentValue || undefined,
      conflict: Boolean(currentValue && currentValue !== value),
    });
  }
  for (const [k, v] of Object.entries(parsed.stringFields)) {
    if (!v?.value) continue;
    const cur = current[k]?.trim() ?? "";
    rows.push({
      key: `str:${k}`,
      field: k,
      value: v.value,
      confidence: v.confidence,
      currentValue: cur || undefined,
      conflict: Boolean(cur && cur !== v.value),
    });
  }
  for (const [k, v] of Object.entries(parsed.numberFields)) {
    if (v == null) continue;
    const cur = current[k]?.trim() ?? "";
    rows.push({
      key: `num:${k}`,
      field: k,
      value: String(v.value),
      confidence: v.confidence,
      currentValue: cur || undefined,
      conflict: Boolean(cur && cur !== String(v.value)),
    });
  }
  if (parsed.engineTypeEnum) {
    const cur = current.engineType ?? "";
    rows.push({
      key: "enum:engineType",
      field: "Fuel / engine type",
      value: parsed.engineTypeEnum.value,
      confidence: parsed.engineTypeEnum.confidence,
      currentValue: cur || undefined,
      conflict: Boolean(cur && cur !== parsed.engineTypeEnum.value),
    });
  }
  if (parsed.motorcycleTypeEnum) {
    const cur = current.motorcycleType ?? "";
    rows.push({
      key: "enum:motorcycleType",
      field: "Motorcycle type",
      value: parsed.motorcycleTypeEnum.value,
      confidence: parsed.motorcycleTypeEnum.confidence,
      currentValue: cur || undefined,
      conflict: Boolean(cur && cur !== parsed.motorcycleTypeEnum.value),
    });
  }
  if (parsed.sourceTypeEnum) {
    const cur = current.sourceType ?? "";
    rows.push({
      key: "enum:sourceType",
      field: "Stock location",
      value: parsed.sourceTypeEnum.value,
      confidence: parsed.sourceTypeEnum.confidence,
      currentValue: cur || undefined,
      conflict: Boolean(cur && cur !== parsed.sourceTypeEnum.value),
    });
  }
  if (parsed.listingStateEnum) {
    const cur = current.listingState ?? "";
    rows.push({
      key: "enum:listingState",
      field: "Listing state",
      value: parsed.listingStateEnum.value,
      confidence: parsed.listingStateEnum.confidence,
      currentValue: cur || undefined,
      conflict: Boolean(cur && cur !== parsed.listingStateEnum.value),
    });
  }
  parsed.specLines.forEach((s, i) => {
    rows.push({
      key: `spec:${i}:${s.label}`,
      field: s.groupName ? `${s.groupName} · ${s.label}` : s.label,
      value: s.value,
      confidence: s.confidence,
      conflict: false,
    });
  });
  return rows;
}

export function MotorcycleSummaryAutofill({
  className,
  placeholder,
  getCurrentValues,
  onApplySelected,
}: Props) {
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [parsed, setParsed] = useState<MotorcycleSummaryAutofillResult | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const reviewRows = useMemo(() => {
    if (!parsed) return [];
    return buildReviewRows(parsed, getCurrentValues());
  }, [parsed, getCurrentValues]);

  function openAnalyze() {
    const trimmed = text.trim();
    if (!trimmed) return;
    const next = parseMotorcycleSummaryForAutofill(trimmed);
    setParsed(next);
    const rows = buildReviewRows(next, getCurrentValues());
    // Default: select empty/non-conflict fields; leave conflicts unchecked unless empty current
    const sel = new Set<string>();
    for (const r of rows) {
      if (!r.conflict || !r.currentValue) sel.add(r.key);
    }
    setSelected(sel);
    setOpen(true);
  }

  function toggle(key: string) {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });
  }

  async function apply(overwrite: boolean) {
    if (!parsed) return;
    await Promise.resolve(onApplySelected(parsed, selected, { overwrite }));
    setOpen(false);
  }

  const previewHint = text.trim()
    ? previewRowsFromMotorcycleParse(parseMotorcycleSummaryForAutofill(text)).length
    : 0;

  return (
    <div className={className}>
      <Label htmlFor="motorcycle-paste-summary">Paste Motorcycle Summary</Label>
      <Textarea
        id="motorcycle-paste-summary"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={
          placeholder ??
          "2025 Yamaha MT-07, 689cc parallel-twin petrol, 6-speed, 54 kW, 67 Nm, ABS, Accra…"
        }
        className="mt-1 min-h-[100px] resize-y"
        rows={4}
      />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Button type="button" variant="secondary" onClick={openAnalyze}>
          Analyze and Auto-Fill
        </Button>
        {previewHint > 0 ? (
          <span className="text-[11px] text-muted-foreground">{previewHint} signals detected</span>
        ) : null}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl" showCloseButton>
          <DialogHeader>
            <DialogTitle>Review parsed fields</DialogTitle>
            <DialogDescription>
              Select which fields to apply. Conflicts with existing values are highlighted — they stay unchecked unless
              you select them and choose overwrite.
            </DialogDescription>
          </DialogHeader>
          {reviewRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing detected in the pasted summary.</p>
          ) : (
            <ul className="max-h-[45vh] space-y-2 overflow-y-auto rounded-lg border border-border p-3 text-xs dark:border-white/10">
              {reviewRows.map((r) => (
                <li
                  key={r.key}
                  className={`rounded-md border px-2 py-2 ${
                    r.conflict
                      ? "border-amber-500/40 bg-amber-500/10"
                      : "border-border/60 dark:border-white/10"
                  }`}
                >
                  <label className="flex cursor-pointer gap-2">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={selected.has(r.key)}
                      onChange={() => toggle(r.key)}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-foreground">{r.field}</span>
                        {r.confidence === "heuristic" ? (
                          <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] text-amber-200">
                            verify
                          </span>
                        ) : (
                          <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] text-emerald-200">
                            labeled
                          </span>
                        )}
                        {r.conflict ? (
                          <span className="rounded bg-red-500/20 px-1.5 py-0.5 text-[10px] text-red-200">
                            conflict
                          </span>
                        ) : null}
                      </span>
                      <span className="mt-0.5 block break-all text-muted-foreground">→ {r.value}</span>
                      {r.currentValue ? (
                        <span className="mt-0.5 block break-all text-[10px] text-zinc-500">
                          current: {r.currentValue}
                        </span>
                      ) : null}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
          <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" variant="secondary" onClick={() => void apply(false)}>
              Apply selected (empty / no overwrite)
            </Button>
            <Button
              type="button"
              className="bg-amber-600 hover:bg-amber-700"
              onClick={() => void apply(true)}
            >
              Apply selected (overwrite conflicts)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
