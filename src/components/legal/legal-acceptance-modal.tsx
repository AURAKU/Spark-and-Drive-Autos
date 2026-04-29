"use client";

import { useState } from "react";

import { PolicyViewerModal } from "@/components/legal/policy-viewer-modal";
import { RequiredLegalCheckbox } from "@/components/legal/required-legal-checkbox";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function LegalAcceptanceModal({
  open,
  onOpenChange,
  policyKey,
  context,
  title,
  description,
  checkboxLabel,
  onAccepted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  policyKey: string;
  context: string;
  title: string;
  description: string;
  checkboxLabel: string;
  onAccepted?: () => void;
}) {
  const [checked, setChecked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);

  async function accept() {
    if (!checked) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/legal/accept-policy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ policyKey, context }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Could not save acceptance.");
        return;
      }
      onAccepted?.();
      onOpenChange(false);
      setChecked(false);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <button type="button" className="text-xs text-[var(--brand)] hover:underline" onClick={() => setViewerOpen(true)}>
              View active policy
            </button>
            <RequiredLegalCheckbox
              checked={checked}
              onChange={(next) => {
                setChecked(next);
                if (next) void accept();
              }}
              disabled={loading}
              label={checkboxLabel}
            />
            {error ? <p className="text-xs text-red-500">{error}</p> : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            <Button onClick={() => void accept()} disabled={loading || !checked}>
              {loading ? "Saving..." : "Accept and continue"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PolicyViewerModal policyKey={policyKey} open={viewerOpen} onOpenChange={setViewerOpen} />
    </>
  );
}
