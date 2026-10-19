import { requireAdmin } from "@/lib/auth-helpers";
import { getPartsRequestFeeSettings } from "@/lib/parts-request-fee";

import { PartsRequestFeeSettingsClient } from "./settings-client";

export default async function PartsRequestFeeSettingsPage() {
  await requireAdmin();
  const settings = await getPartsRequestFeeSettings();
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Parts request fee</h1>
      <p className="text-sm text-muted-foreground">
        This amount is charged before a parts or accessories request is sent to the team. The starting fee is GHS 30.
      </p>
      <PartsRequestFeeSettingsClient initial={{ enabled: settings.enabled, feeAmount: Number(settings.feeAmount) }} />
    </div>
  );
}
