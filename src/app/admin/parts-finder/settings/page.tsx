import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { PageHeading } from "@/components/typography/page-headings";
import { getPartsFinderActivationSnapshot } from "@/lib/parts-finder/pricing";
import { partsFinderSettingsSchema } from "@/lib/parts-finder/schemas";
import { persistPartsFinderSettings } from "@/lib/parts-finder/settings-persistence";
import { prisma } from "@/lib/prisma";
import { safeAuth } from "@/lib/safe-auth";

import { isAdminRole } from "@/auth";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function AdminPartsFinderSettingsPage(props: { searchParams: SearchParams }) {
  const session = await safeAuth();
  if (!session?.user?.role || !isAdminRole(session.user.role)) redirect("/dashboard");
  const [snapshot, settings, sp] = await Promise.all([
    getPartsFinderActivationSnapshot(),
    prisma.partsFinderSettings.findFirst({ orderBy: { updatedAt: "desc" } }),
    props.searchParams,
  ]);
  const saveState = typeof sp.updated === "string" ? sp.updated : null;
  const activeSettings = settings ?? {
    activationPriceMinor: 50000,
    activationDurationDays: 30,
    approvalMode: "MANUAL" as const,
    requireManualReviewBelow: 55,
    active: true,
  };

  async function updateSettingsAction(formData: FormData) {
    "use server";
    const auth = await safeAuth();
    if (!auth?.user?.role || !isAdminRole(auth.user.role)) {
      redirect("/dashboard");
    }
    const payload = partsFinderSettingsSchema.parse({
      activationPriceMinor: Math.round(Number.parseFloat(String(formData.get("activationPriceGhs") ?? "0")) * 100),
      activationDurationDays: Number.parseInt(String(formData.get("activationDurationDays") ?? "0"), 10),
      approvalMode: String(formData.get("approvalMode") ?? "MANUAL"),
      featureEnabled: formData.get("featureEnabled") === "on",
      requireManualReviewBelow: Number.parseInt(String(formData.get("requireManualReviewBelow") ?? "55"), 10),
    });
    await persistPartsFinderSettings({
      actorId: auth.user.id,
      input: payload,
    });
    revalidatePath("/admin/parts-finder/settings");
    redirect("/admin/parts-finder/settings?updated=ok");
  }

  return (
    <div>
      <PageHeading variant="dashboard">Parts Finder settings</PageHeading>
      <p className="mt-2 text-sm text-muted-foreground">
        Operate pricing, approval automation, and feature gating from one server-authoritative control panel.
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Pricing updates are forward-only: new values apply to future activations/renewals and do not change access windows already granted.
      </p>
      {saveState === "ok" ? (
        <p className="mt-4 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
          Settings updated successfully.
        </p>
      ) : null}
      <form action={updateSettingsAction} className="mt-6 grid gap-4 rounded-xl border border-border bg-muted/40 p-4 text-sm dark:bg-white/[0.03] sm:grid-cols-2">
        <label className="space-y-1">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">Activation fee (GHS)</span>
          <input
            name="activationPriceGhs"
            type="number"
            min={1}
            step="0.01"
            defaultValue={(activeSettings.activationPriceMinor / 100).toFixed(2)}
            className="h-10 w-full rounded-lg border border-border bg-background px-3"
          />
        </label>
        <label className="space-y-1">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">Duration days</span>
          <input
            name="activationDurationDays"
            type="number"
            min={1}
            max={365}
            defaultValue={activeSettings.activationDurationDays}
            className="h-10 w-full rounded-lg border border-border bg-background px-3"
          />
        </label>
        <label className="space-y-1">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">Approval mode</span>
          <select
            name="approvalMode"
            defaultValue={activeSettings.approvalMode}
            className="h-10 w-full rounded-lg border border-border bg-background px-3"
          >
            <option value="MANUAL">MANUAL (queue every search for review)</option>
            <option value="AUTO">AUTO (approve high-confidence searches)</option>
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">Manual review below confidence (%)</span>
          <input
            name="requireManualReviewBelow"
            type="number"
            min={1}
            max={99}
            defaultValue={activeSettings.requireManualReviewBelow}
            className="h-10 w-full rounded-lg border border-border bg-background px-3"
          />
        </label>
        <label className="sm:col-span-2 flex items-center gap-2 rounded-lg border border-border bg-background/70 px-3 py-2">
          <input type="checkbox" name="featureEnabled" defaultChecked={activeSettings.active} className="h-4 w-4" />
          <span>Enable Parts Finder feature for customers</span>
        </label>
        <div className="sm:col-span-2 flex flex-wrap items-center gap-3">
          <button className="rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-black" type="submit">
            Save settings
          </button>
          <span className="text-xs text-muted-foreground">
            Current currency: {snapshot.currency} · successful activations: {snapshot.successfulActivations}
          </span>
        </div>
      </form>
      <div className="mt-4 rounded-xl border border-border bg-background/50 p-4 text-xs text-muted-foreground">
        <p>Current activation fee: {(activeSettings.activationPriceMinor / 100).toFixed(2)} {snapshot.currency}</p>
        <p>Current activation duration: {activeSettings.activationDurationDays} days</p>
        <p>Fee edits only affect future activations/renewals; active memberships keep their existing expiry dates.</p>
        <p>Approval mode: {activeSettings.approvalMode}</p>
        <p>
          Feature enabled: {activeSettings.active ? "Yes" : "No"} (persisted as <code className="text-foreground">active</code>
          ; API exposes <code className="text-foreground">isActive</code>)
        </p>
      </div>
    </div>
  );
}
