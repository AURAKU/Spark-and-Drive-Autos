import { redirect } from "next/navigation";

/** @deprecated merged into /admin/settings (API providers) */
export default function AdminPaymentProvidersRedirectPage() {
  redirect("/admin/settings");
}
