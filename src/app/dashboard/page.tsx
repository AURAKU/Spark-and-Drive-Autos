import { LegalAcceptanceStatusCard } from "@/components/dashboard/legal-acceptance-status-card";
import { DashboardIntelligenceView } from "@/components/dashboard/dashboard-intelligence-view";
import { requireSessionOrRedirect } from "@/lib/auth-helpers";
import { getDashboardIntelligence } from "@/lib/dashboard-intelligence";
import { getUserPolicyAcceptanceSnapshot } from "@/lib/legal-acceptance-guard";
import { POLICY_KEYS } from "@/lib/legal-enforcement";

export const dynamic = "force-dynamic";

export default async function DashboardHome() {
  const session = await requireSessionOrRedirect("/dashboard");
  const userId = session.user.id;
  const rawName = session.user.name?.trim();
  const emailHandle = session.user.email?.split("@")[0]?.trim();
  const displayName = rawName || emailHandle || "there";

  const data = await getDashboardIntelligence(userId, { displayName });
  const legalRows = await getUserPolicyAcceptanceSnapshot(userId, [
    POLICY_KEYS.PLATFORM_TERMS_PRIVACY,
    POLICY_KEYS.CHECKOUT_AGREEMENT,
    POLICY_KEYS.PARTS_FINDER_DISCLAIMER,
    POLICY_KEYS.SOURCING_RISK_ACKNOWLEDGEMENT,
  ]);

  return (
    <>
      <LegalAcceptanceStatusCard rows={legalRows} />
      <DashboardIntelligenceView data={data} />
    </>
  );
}
