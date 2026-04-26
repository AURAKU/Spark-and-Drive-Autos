import { PolicyVersionBadge } from "@/components/legal/policy-version-badge";

export function SourcingRiskAcknowledgementNotice({
  riskVersion,
  contractVersion,
}: {
  riskVersion: string;
  contractVersion: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
      <p className="font-medium text-foreground">Sourcing risk acknowledgement</p>
      <p className="mt-1">Sourcing depends on suppliers, logistics, customs, and third-party services.</p>
      <p className="mt-1">
        Risk policy <PolicyVersionBadge version={riskVersion} /> · Contract <PolicyVersionBadge version={contractVersion} />
      </p>
    </div>
  );
}
