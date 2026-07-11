import { getDutyAdminSettingsData } from "@/actions/duty-admin-os";
import { DutySettingsClient } from "@/components/admin/duty-os/duty-settings-client";

export const dynamic = "force-dynamic";

export default async function DutySettingsPage() {
  const settings = await getDutyAdminSettingsData();
  return <DutySettingsClient initial={settings} />;
}
