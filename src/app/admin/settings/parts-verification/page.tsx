import Link from "next/link";

import { requireSuperAdmin } from "@/lib/auth-helpers";
import { getVerifiedPartSettings } from "@/lib/verified-parts";

import { PartsVerificationSettingsClient } from "./settings-client";

export default async function PartsVerificationSettingsPage() {
  await requireSuperAdmin();
  const settings = await getVerifiedPartSettings();
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Parts Verification Settings</h1>
      <p className="text-sm text-muted-foreground">
        The public parts request fee is separate.{" "}
        <Link href="/admin/parts-finder/parts-request-fee" className="text-[var(--brand)] hover:underline">
          Change the parts request fee
        </Link>
        .
      </p>
      <PartsVerificationSettingsClient
        initial={{
          enabled: settings.enabled,
          feeAmount: Number(settings.feeAmount),
          currency: settings.currency,
          serviceDescription: settings.serviceDescription ?? "",
          legalNote: settings.legalNote ?? "",
        }}
      />
    </div>
  );
}
