import { Suspense } from "react";

import {
  getActivePolicyVersionWithFallback,
  getActiveSourcingContractVersion,
  POLICY_KEYS,
} from "@/lib/legal-enforcement";

import { RequestACarForm } from "./request-a-car-form";

export const dynamic = "force-dynamic";

export default async function RequestACarPage() {
  const [sourcingRiskVersion, sourcingContractVersion] = await Promise.all([
    getActivePolicyVersionWithFallback(
      [POLICY_KEYS.SOURCING_RISK_ACKNOWLEDGEMENT, POLICY_KEYS.RISK_ACKNOWLEDGEMENT],
      "v1.0",
    ),
    getActiveSourcingContractVersion(),
  ]);

  return (
    <Suspense fallback={<div className="mx-auto max-w-3xl px-4 py-16 text-sm text-zinc-500">Loading…</div>}>
      <RequestACarForm sourcingRiskVersion={sourcingRiskVersion} sourcingContractVersion={sourcingContractVersion} />
    </Suspense>
  );
}
