import { redirect } from "next/navigation";

export default function AdminChatsRedirectPage() {
  redirect("/admin/comms");
}
