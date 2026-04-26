import { requireActiveSessionOrRedirect } from "@/lib/auth-helpers";

import { GarageClient } from "./garage-client";

export default async function DashboardGaragePage() {
  await requireActiveSessionOrRedirect("/dashboard/garage");
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">My Garage</h1>
        <p className="text-sm text-muted-foreground">
          Save your vehicles once, then run faster and more accurate parts searches.
        </p>
      </div>
      <GarageClient />
    </div>
  );
}
