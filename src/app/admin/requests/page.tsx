import { redirect } from "next/navigation";

/** @deprecated Use `/admin/order-inquiries` */
export default function AdminRequestsRedirectPage() {
  redirect("/admin/comms?view=sourcing");
}
