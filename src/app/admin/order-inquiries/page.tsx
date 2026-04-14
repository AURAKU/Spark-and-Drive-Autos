import { redirect } from "next/navigation";

export default function AdminOrderInquiriesRedirectPage() {
  redirect("/admin/comms?view=sourcing");
}
