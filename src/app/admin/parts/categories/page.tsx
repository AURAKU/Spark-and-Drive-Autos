import { redirect } from "next/navigation";

export default function AdminPartCategoriesRedirectPage() {
  redirect("/admin/parts?tab=categories");
}
