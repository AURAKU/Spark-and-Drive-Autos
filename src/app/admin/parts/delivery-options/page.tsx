import { redirect } from "next/navigation";

export default function AdminPartDeliveryOptionsRedirectPage() {
  redirect("/admin/parts?tab=delivery");
}
