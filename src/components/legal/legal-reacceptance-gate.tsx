"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { RiskNoticeBanner } from "@/components/legal/risk-notice-banner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

type Props = {
  policies: Array<{
    id: string;
    policyKey: string;
    title: string | null;
    version: string;
    effectiveAt: string;
    content: string | null;
  }>;
  defaultRedirectTo: string;
};

export function LegalReacceptanceGate({ policies, defaultRedirectTo }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const target = useMemo(() => {
    const callbackUrl = searchParams.get("callbackUrl");
    const next = searchParams.get("next");
    return callbackUrl || next || pathname || defaultRedirectTo;
  }, [defaultRedirectTo, pathname, searchParams]);

  async function onAccept() {
    if (!agreed || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/legal/reaccept-required", { method: "POST" });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? "Could not record policy acceptance. Please try again.");
      }
      router.replace(target);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not record policy acceptance. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:py-16">
      <RiskNoticeBanner message="We have updated our Terms and Privacy Policy. To continue using Spark & Drive, review and accept the latest version." />

      <div className="mt-4 rounded-xl border border-border bg-card p-4 sm:p-5 dark:border-white/10 dark:bg-white/[0.03]">
        <h2 className="text-base font-semibold text-foreground">Review and accept</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Please review the active policy version(s) below before continuing.
        </p>

        <div className="mt-4 space-y-4">
          {policies.map((policy) => (
            <article key={policy.id} className="rounded-lg border border-border p-3 dark:border-white/10">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-foreground">{policy.title?.trim() || policy.policyKey}</p>
                <span className="rounded-md border border-[var(--brand)]/35 bg-[var(--brand)]/10 px-2 py-0.5 text-xs font-medium text-[var(--brand)]">
                  v{policy.version}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Effective: {new Date(policy.effectiveAt).toLocaleDateString()}
              </p>
              <div className="mt-3 max-h-56 overflow-y-auto rounded-md border border-border/80 bg-background/60 p-3 text-sm leading-relaxed text-foreground dark:border-white/10 dark:bg-black/20">
                <div className="whitespace-pre-wrap">{policy.content?.trim() || "Policy content is currently unavailable."}</div>
              </div>
            </article>
          ))}
        </div>

        <label className="mt-5 flex items-start gap-3">
          <Checkbox checked={agreed} onCheckedChange={(value) => setAgreed(value === true)} className="mt-0.5" />
          <span className="text-sm text-foreground">
            I have read and agree to the latest{" "}
            <span className="rounded-md bg-[var(--brand)]/12 px-1.5 py-0.5 font-semibold text-[var(--brand)] dark:bg-[var(--brand)]/20">
              Terms and Privacy Policy
            </span>
            .
          </span>
        </label>

        {error ? <p className="mt-3 text-sm text-red-500">{error}</p> : null}

        <div className="mt-4">
          <Button type="button" onClick={onAccept} disabled={!agreed || loading}>
            {loading ? "Accepting..." : "Review and accept"}
          </Button>
        </div>
      </div>
    </div>
  );
}
