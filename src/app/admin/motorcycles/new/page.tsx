import Link from "next/link";

import { MotorcycleFastForm } from "@/components/admin/motorcycles/motorcycle-fast-form";
import { PageHeading } from "@/components/typography/page-headings";

export const metadata = { title: "Add Motorcycle | Admin" };
export const dynamic = "force-dynamic";

export default function AdminNewMotorcyclePage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 lg:p-8">
      <div className="flex items-center justify-between gap-4">
        <PageHeading variant="dashboard">Add motorcycle</PageHeading>
        <Link href="/admin/motorcycles" className="text-sm text-muted-foreground hover:underline">← Inventory</Link>
      </div>
      <p className="text-sm text-muted-foreground">Fast admin mode — publish in under 2 minutes with only required fields.</p>
      <MotorcycleFastForm />
    </div>
  );
}
