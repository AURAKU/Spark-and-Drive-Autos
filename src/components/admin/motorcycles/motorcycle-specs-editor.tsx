"use client";

import { GripVertical, Plus, Trash2 } from "lucide-react";
import { useMemo } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MOTORCYCLE_SPEC_GROUP_PRESETS } from "@/lib/motorcycle-spec-parser";
import type { MotorcycleSpecRowInput } from "@/lib/motorcycle-specs";

type Props = {
  rows: MotorcycleSpecRowInput[];
  onRowsChange: (rows: MotorcycleSpecRowInput[]) => void;
  name?: string;
};

export function MotorcycleSpecsEditor({ rows, onRowsChange, name = "specificationsJson" }: Props) {
  const jsonPayload = useMemo(
    () =>
      JSON.stringify(
        rows
          .filter((r) => r.label.trim() && r.value.trim())
          .map((r, i) => ({
            groupName: r.groupName?.trim() || undefined,
            label: r.label.trim(),
            value: r.value.trim(),
            unit: r.unit?.trim() || undefined,
            sortOrder: i,
            isPublic: r.isPublic !== false,
          })),
      ),
    [rows],
  );

  function update(idx: number, patch: Partial<MotorcycleSpecRowInput>) {
    onRowsChange(rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }

  function addRow(presetGroup?: string) {
    onRowsChange([
      ...rows,
      {
        groupName: presetGroup ?? "",
        label: "",
        value: "",
        unit: "",
        sortOrder: rows.length,
        isPublic: true,
      },
    ]);
  }

  function removeRow(idx: number) {
    onRowsChange(rows.filter((_, i) => i !== idx));
  }

  function move(idx: number, dir: -1 | 1) {
    const j = idx + dir;
    if (j < 0 || j >= rows.length) return;
    const next = [...rows];
    const tmp = next[idx]!;
    next[idx] = next[j]!;
    next[j] = tmp;
    onRowsChange(next);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <Label>Advanced specifications</Label>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Custom groups, labels, values, units, order, and public/internal visibility.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {MOTORCYCLE_SPEC_GROUP_PRESETS.slice(0, 4).map((g) => (
            <Button key={g} type="button" size="sm" variant="outline" onClick={() => addRow(g)}>
              + {g}
            </Button>
          ))}
          <Button type="button" size="sm" variant="secondary" onClick={() => addRow()}>
            <Plus className="mr-1 size-3.5" />
            Row
          </Button>
        </div>
      </div>
      <input type="hidden" name={name} value={jsonPayload} />
      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground dark:border-white/10">
          No specification rows yet.
        </p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r, i) => (
            <li
              key={`spec-row-${i}`}
              className="grid gap-2 rounded-lg border border-border bg-muted/20 p-3 lg:grid-cols-[auto_minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,1.2fr)_auto_auto] dark:border-white/10"
            >
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  className="rounded p-1 text-muted-foreground hover:bg-muted disabled:opacity-40"
                  aria-label="Move up"
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                >
                  <GripVertical className="size-4" />
                </button>
                <button
                  type="button"
                  className="text-[10px] text-muted-foreground hover:underline disabled:opacity-40"
                  onClick={() => move(i, 1)}
                  disabled={i === rows.length - 1}
                >
                  ↓
                </button>
              </div>
              <Input
                placeholder="Group"
                list="motorcycle-spec-groups"
                value={r.groupName ?? ""}
                onChange={(e) => update(i, { groupName: e.target.value })}
              />
              <Input placeholder="Label" value={r.label} onChange={(e) => update(i, { label: e.target.value })} />
              <div className="flex gap-2">
                <Input
                  placeholder="Value"
                  value={r.value}
                  onChange={(e) => update(i, { value: e.target.value })}
                  className="flex-1"
                />
                <Input
                  placeholder="Unit"
                  value={r.unit ?? ""}
                  onChange={(e) => update(i, { unit: e.target.value })}
                  className="w-20"
                />
              </div>
              <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <input
                  type="checkbox"
                  checked={r.isPublic !== false}
                  onChange={(e) => update(i, { isPublic: e.target.checked })}
                />
                Public
              </label>
              <Button type="button" size="sm" variant="ghost" className="text-red-400" onClick={() => removeRow(i)}>
                <Trash2 className="size-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <datalist id="motorcycle-spec-groups">
        {MOTORCYCLE_SPEC_GROUP_PRESETS.map((g) => (
          <option key={g} value={g} />
        ))}
      </datalist>
    </div>
  );
}
