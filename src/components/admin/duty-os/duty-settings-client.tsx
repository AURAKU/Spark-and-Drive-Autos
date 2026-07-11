"use client";

import { useState, useTransition } from "react";

import { updateDutySettingsAction } from "@/actions/duty-admin-os";
import type { DutyAdminSettings } from "@/lib/duty-admin/settings";

export function DutySettingsClient({ initial }: { initial: DutyAdminSettings }) {
  const [settings, setSettings] = useState(initial);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const result = await updateDutySettingsAction(settings);
      setMsg(result.error ?? "Settings saved.");
    });
  }

  return (
    <div className="max-w-2xl space-y-4 text-sm">
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={settings.publicCalculatorEnabled}
          onChange={(e) => setSettings({ ...settings, publicCalculatorEnabled: e.target.checked })}
        />
        Public calculator enabled
      </label>
      <label className="block">
        Disclaimer
        <textarea
          className="mt-1 w-full rounded-lg border px-3 py-2"
          rows={3}
          value={settings.disclaimer}
          onChange={(e) => setSettings({ ...settings, disclaimer: e.target.value })}
        />
      </label>
      <label className="block">
        Default estimate band (%)
        <input
          type="number"
          className="mt-1 w-full rounded-lg border px-3 py-2"
          value={settings.defaultEstimateBandPct}
          onChange={(e) => setSettings({ ...settings, defaultEstimateBandPct: Number(e.target.value) })}
        />
      </label>
      <label className="block">
        Stale FX threshold (days)
        <input
          type="number"
          className="mt-1 w-full rounded-lg border px-3 py-2"
          value={settings.staleFxThresholdDays}
          onChange={(e) => setSettings({ ...settings, staleFxThresholdDays: Number(e.target.value) })}
        />
      </label>
      <label className="block">
        Minimum calibration sample size
        <input
          type="number"
          className="mt-1 w-full rounded-lg border px-3 py-2"
          value={settings.minimumCalibrationSampleSize}
          onChange={(e) => setSettings({ ...settings, minimumCalibrationSampleSize: Number(e.target.value) })}
        />
      </label>
      <label className="block">
        High value threshold (GHS)
        <input
          type="number"
          className="mt-1 w-full rounded-lg border px-3 py-2"
          value={settings.highValueThresholdGhs}
          onChange={(e) => setSettings({ ...settings, highValueThresholdGhs: Number(e.target.value) })}
        />
      </label>
      <button type="button" disabled={pending} onClick={save} className="rounded-lg bg-primary px-4 py-2 text-primary-foreground">
        Save settings
      </button>
      {msg && <p className="text-muted-foreground">{msg}</p>}
    </div>
  );
}
