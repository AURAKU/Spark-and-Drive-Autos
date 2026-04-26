import { AcceptedPolicyBadge } from "@/components/legal/accepted-policy-badge";
import { PolicyVersionBadge } from "@/components/legal/policy-version-badge";

type LegalRow = {
  policyKey: string;
  version: string;
  accepted: boolean;
  acceptedAt: Date | null;
  lastUpdatedAt: Date;
};

export function LegalAcceptanceStatusCard({ rows }: { rows: LegalRow[] }) {
  if (rows.length === 0) return null;
  return (
    <section className="mb-6 rounded-2xl border border-border bg-card p-4">
      <h2 className="text-sm font-semibold">Legal acceptance status</h2>
      <p className="mt-1 text-xs text-muted-foreground">Accepted badges for active policy versions on your account.</p>
      <div className="mt-3 grid gap-2">
        {rows.map((r) => (
          <div key={r.policyKey} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/70 px-3 py-2 text-xs">
            <span className="font-mono">{r.policyKey}</span>
            <PolicyVersionBadge version={r.version} />
            <AcceptedPolicyBadge accepted={r.accepted} />
            <span className="text-muted-foreground">
              {r.acceptedAt ? `Accepted ${r.acceptedAt.toLocaleDateString()}` : `Updated ${r.lastUpdatedAt.toLocaleDateString()}`}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
