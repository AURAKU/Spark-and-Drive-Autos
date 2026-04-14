import { redirect } from "next/navigation";

export default function AdminQuotesRedirectPage() {
  redirect("/admin/comms?view=quotes");
}
