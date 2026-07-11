import { getDutyAdminDashboardData } from "@/actions/duty-admin-os";
import { DutyDashboardClient } from "@/components/admin/duty-os/duty-dashboard-client";

export const dynamic = "force-dynamic";

export default async function DutyAdminDashboardPage() {
  const data = await getDutyAdminDashboardData();
  return <DutyDashboardClient data={data} />;
}
