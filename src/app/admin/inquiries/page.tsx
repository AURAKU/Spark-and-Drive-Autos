import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AdminInquiriesPage() {
  redirect("/admin/comms?view=inquiry");
}
