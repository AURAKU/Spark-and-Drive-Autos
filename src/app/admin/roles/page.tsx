import { redirect } from "next/navigation";

/** Roles reference now lives under Users → “Role reference”. */
export default function AdminRolesRedirectPage() {
  redirect("/admin/users?panel=roles");
}
