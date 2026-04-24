import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { cloneVehicleImportEstimateAction, markVehicleImportEstimateSentAction } from "@/actions/vehicle-import-estimate-admin";
import { VehicleImportEstimateDocument } from "@/components/admin/duty-estimator/vehicle-import-estimate-document";
import { VehicleImportEstimateEditorForm } from "@/components/admin/duty-estimator/vehicle-import-estimate-editor-form";
import { requireAdmin } from "@/lib/auth-helpers";
import { getVehicleImportEstimateById, getVehicleImportEstimateEvents } from "@/lib/vehicle-import-estimate/data";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminDutyEstimateDetailPage(props: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
  } catch {
    redirect("/login?callbackUrl=/admin/duty-estimator");
  }

  const { id } = await props.params;
  const estimate = await getVehicleImportEstimateById(id);
  if (!estimate) notFound();

  const [users, orders, inquiries, cars, events] = await Promise.all([
    prisma.user.findMany({
      orderBy: { updatedAt: "desc" },
      take: 100,
      select: { id: true, name: true, email: true },
    }),
    prisma.order.findMany({
      orderBy: { updatedAt: "desc" },
      take: 100,
      select: {
        id: true,
        reference: true,
        user: { select: { name: true, email: true } },
        car: { select: { title: true } },
      },
    }),
    prisma.inquiry.findMany({
      orderBy: { updatedAt: "desc" },
      take: 100,
      select: {
        id: true,
        message: true,
        createdAt: true,
        user: { select: { name: true, email: true } },
      },
    }),
    prisma.car.findMany({
      orderBy: { updatedAt: "desc" },
      take: 100,
      select: { id: true, title: true, year: true, engineType: true },
    }),
    getVehicleImportEstimateEvents(estimate.id),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/admin/duty-estimator" className="text-sm text-primary underline-offset-4 hover:underline">
          ← Back to estimates
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/admin/duty-estimator/${estimate.id}/preview`}
            className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted/60"
          >
            Preview estimate
          </Link>
          <a
            href={`/admin/duty-estimator/${estimate.id}/export`}
            className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted/60"
          >
            Export estimate
          </a>
          <form action={cloneVehicleImportEstimateAction}>
            <input type="hidden" name="id" value={estimate.id} />
            <button type="submit" className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted/60">
              Duplicate estimate
            </button>
          </form>
          <form action={markVehicleImportEstimateSentAction}>
            <input type="hidden" name="id" value={estimate.id} />
            <button type="submit" className="rounded-lg bg-emerald-500 px-3 py-1.5 text-sm font-semibold text-black hover:opacity-90">
              Mark as sent
            </button>
          </form>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <VehicleImportEstimateEditorForm estimate={estimate} users={users} orders={orders} inquiries={inquiries} cars={cars} />
        <div className="space-y-4">
          <VehicleImportEstimateDocument estimate={estimate} />
          <section className="rounded-2xl border border-border bg-card p-4 text-sm dark:border-white/10 dark:bg-white/[0.02]">
            <p className="text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">Estimate history</p>
            <ul className="mt-3 space-y-2">
              {events.length === 0 ? (
                <li className="text-zinc-500">No history yet.</li>
              ) : (
                events.map((event) => (
                  <li key={event.id} className="rounded-lg border border-border/70 px-3 py-2 dark:border-white/10">
                    <p className="text-xs font-semibold text-foreground">{event.status}</p>
                    <p className="text-xs text-zinc-500">
                      {event.actorName ?? event.actorEmail ?? "System"} · {new Date(event.createdAt).toLocaleString()}
                    </p>
                    {event.note ? <p className="mt-1 text-xs text-zinc-400">{event.note}</p> : null}
                  </li>
                ))
              )}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
