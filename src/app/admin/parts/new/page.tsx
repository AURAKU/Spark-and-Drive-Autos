import { redirect } from "next/navigation";

export default function AdminNewPartRedirectPage() {
  redirect("/admin/parts?tab=catalog&add=1");
}
