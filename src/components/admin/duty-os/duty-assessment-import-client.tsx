"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { ingestBillOfEntryAction } from "@/actions/duty-assessment-admin";
import {
  BYD_SEALION6_CALIBRATION,
  JETOUR_DASHING_CALIBRATION,
} from "@/lib/duty-assessment/fixtures/calibration-cases";

export function DutyAssessmentImportClient() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"manual" | "fixture">("manual");

  function loadFixture(which: "jetour" | "byd") {
    const fixture = which === "jetour" ? JETOUR_DASHING_CALIBRATION : BYD_SEALION6_CALIBRATION;
    startTransition(async () => {
      setError(null);
      const result = await ingestBillOfEntryAction(fixture);
      if (result.error) setError(result.error);
      else if (result.assessmentId) router.push(`/admin/duty/assessments/${result.assessmentId}`);
    });
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Upload or enter Bill of Entry data. Every line is reviewable before verification — OCR is assistive only.
      </p>

      <div className="flex gap-2">
        <button type="button" onClick={() => setMode("manual")} className={`rounded-lg border px-3 py-2 text-sm ${mode === "manual" ? "bg-muted" : ""}`}>
          Manual entry
        </button>
        <button type="button" onClick={() => setMode("fixture")} className={`rounded-lg border px-3 py-2 text-sm ${mode === "fixture" ? "bg-muted" : ""}`}>
          Calibration fixtures
        </button>
      </div>

      {mode === "fixture" && (
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={pending} onClick={() => loadFixture("jetour")} className="rounded-lg border px-3 py-2 text-sm">
            Import Jetour Dashing fixture
          </button>
          <button type="button" disabled={pending} onClick={() => loadFixture("byd")} className="rounded-lg border px-3 py-2 text-sm">
            Import BYD Sealion 6 fixture
          </button>
        </div>
      )}

      {mode === "manual" && (
        <div className="rounded-xl border border-border p-4 text-sm text-muted-foreground dark:border-white/10">
          Manual BoE entry form: use calibration fixtures for development, or extend this form with vehicle details, value chain, and charge lines.
          For production BoE upload, integrate document storage and line-by-line review in a follow-up iteration.
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
