import { redirect } from "next/navigation";

export default function LegacyDutyIntelligenceRedirect() {
  redirect("/admin/duty/settings");
}
