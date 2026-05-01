"use client";

import { useState } from "react";

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

const DEFAULT_PLACEHOLDER =
  "Paste 10–30 lines: title: Toyota Corolla, year: 2012, price GHS 95,000, supplier cost CNY 12000, VIN …";

export type PasteSummaryPreviewRow = { field: string; value: string; confidence?: AutofillConfidence };

type Props = {
  /** Derive preview table from current textarea text. */
  buildPreviewRows: (text: string) => PasteSummaryPreviewRow[];
  onApply: (text: string, options: { overwrite: boolean }) => void | Promise<void>;
  className?: string;
  placeholder?: string;
};

function confidenceHint(c: AutofillConfidence | undefined): string {
  if (c === "heuristic") return "Verify — inferred from free text";
  if (c === "explicit") return "Labeled line";
  return "";
}

export function PasteSummaryAutofill({ buildPreviewRows, onApply, className, placeholder }: Props) {
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [previewRows, setPreviewRows] = useState<PasteSummaryPreviewRow[]>([]);

  function openPreview() {
    const trimmed = text.trim();
    if (!trimmed) return;
    setPreviewRows(buildPreviewRows(trimmed));
    setOpen(true);
  }

  async function runApply(overwrite: boolean) {
    const trimmed = text.trim();
    if (!trimmed) return;
    await Promise.resolve(onApply(trimmed, { overwrite }));
    setOpen(false);
  }

  return (
    <div className={className}>
      <Label htmlFor="paste-summary-autofill">Paste summary</Label>
      <Textarea
        id="paste-summary-autofill"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder ?? DEFAULT_PLACEHOLDER}
        className="mt-1 min-h-[100px] resize-y"
        rows={4}
      />
      <div className="mt-2 flex flex-wrap gap-2">
        <Button type="button" variant="secondary" onClick={openPreview}>
          Preview detected fields
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg" showCloseButton>
          <DialogHeader>
            <DialogTitle>Preview detected fields</DialogTitle>
            <DialogDescription>
              Review extracted values before applying. Heuristic matches may need a quick check. Applying only fills empty
              fields unless you choose overwrite.
            </DialogDescription>
          </DialogHeader>
          {previewRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nothing detected — try clearer labels (e.g. part number: ABC, selling price: GHS 350, OEM: 45022-TLA-A00).
            </p>
          ) : (
            <ul className="max-h-[40vh] space-y-2 overflow-y-auto rounded-lg border border-border bg-muted/30 p-3 text-xs dark:border-white/10">
              {previewRows.map((r) => (
                <li key={`${r.field}-${r.value.slice(0, 24)}`} className="flex flex-col gap-0.5 border-b border-border/40 pb-2 last:border-b-0 dark:border-white/10">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="shrink-0 font-medium text-foreground/90">{r.field}</span>
                    {r.confidence === "heuristic" ? (
                      <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400">
                        verify
                      </span>
                    ) : r.confidence === "explicit" ? (
                      <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-400">
                        labeled
                      </span>
                    ) : null}
                  </div>
                  <span className="break-all text-muted-foreground">{r.value}</span>
                  {r.confidence ? (
                    <span className="text-[10px] text-muted-foreground/80">{confidenceHint(r.confidence)}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          <DialogFooter className="flex-col gap-2 border-t-0 sm:items-stretch sm:justify-end">
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="button" variant="secondary" onClick={() => void runApply(false)}>
                Apply to empty fields
              </Button>
              <Button type="button" variant="default" className="bg-amber-600 hover:bg-amber-700" onClick={() => void runApply(true)}>
                Overwrite all detected fields
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
