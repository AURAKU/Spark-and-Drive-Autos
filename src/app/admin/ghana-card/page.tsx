import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** Ghana Card review lives under Identity hub. */
export default function AdminGhanaCardRedirectPage() {
  redirect("/admin/identity?tab=ghana-card");
}
