"use client";

import { useEffect, useState } from "react";

import { PolicyVersionBadge } from "@/components/legal/policy-version-badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type PolicyPayload = {
  policyKey: string;
  version: string;
  title: string | null;
  content: string | null;
};

export function PolicyViewerModal({
  policyKey,
  open,
  onOpenChange,
}: {
  policyKey: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [policy, setPolicy] = useState<PolicyPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setError(null);
      const res = await fetch(`/api/legal/policy/active?policyKey=${encodeURIComponent(policyKey)}`);
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; policy?: PolicyPayload; error?: string };
      if (cancelled) return;
      if (!res.ok || !data.ok || !data.policy) {
        setError(data.error ?? "Could not load policy.");
        return;
      }
      setPolicy(data.policy);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, policyKey]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>{policy?.title?.trim() || policyKey}</DialogTitle>
          <DialogDescription>
            Active version: {policy?.version ? <PolicyVersionBadge version={policy.version} /> : <span className="font-mono">-</span>}
          </DialogDescription>
        </DialogHeader>
        {error ? <p className="text-sm text-red-500">{error}</p> : null}
        <pre className="whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">
          {policy?.content?.trim() || "No body content published for this policy."}
        </pre>
      </DialogContent>
    </Dialog>
  );
}
