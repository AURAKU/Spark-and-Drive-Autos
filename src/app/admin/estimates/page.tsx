import Link from "next/link";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";

import {
  cloneVehicleImportEstimateAction,
  createVehicleImportEstimateAction,
  markVehicleImportEstimateSentAction,
} from "@/actions/vehicle-import-estimate-admin";
import { PageHeading } from "@/components/typography/page-headings";
import { requireAdmin } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 15;

function money(amount: number | null | undefined): string {
  if (amount == null || !Number.isFinite(amount)) return "-";
  return `GHS ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default async function AdminEstimatesPage(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  try {
    await requireAdmin();
  } catch {
    redirect("/login?callbackUrl=/admin/estimates");
  }

  const sp = await props.searchParams;
  const prefillClientName = typeof sp.clientName === "string" ? sp.clientName : "";
  const prefillClientContact = typeof sp.clientContact === "string" ? sp.clientContact : "";
  const prefillVehicleName = typeof sp.vehicleName === "string" ? sp.vehicleName : "";
  const prefillCustomerId = typeof sp.customerId === "string" ? sp.customerId : "";
  const prefillOrderId = typeof sp.orderId === "string" ? sp.orderId : "";
  const prefillInquiryId = typeof sp.inquiryId === "string" ? sp.inquiryId : "";
  const prefillCarId = typeof sp.carId === "string" ? sp.carId : "";
  const qCustomer = typeof sp.customer === "string" ? sp.customer.trim() : "";
  const qVehicle = typeof sp.vehicle === "string" ? sp.vehicle.trim() : "";
  const qVin = typeof sp.vin === "string" ? sp.vin.trim() : "";
  const qStatus = typeof sp.status === "string" ? sp.status.trim().toUpperCase() : "";
  const qFrom = typeof sp.from === "string" ? sp.from.trim() : "";
  const qTo = typeof sp.to === "string" ? sp.to.trim() : "";
  const page = Math.max(1, Number.parseInt(typeof sp.page === "string" ? sp.page : "1", 10) || 1);

  const conditions: Prisma.Sql[] = [];
  if (qCustomer) {
    const like = `%${qCustomer}%`;
    conditions.push(
      Prisma.sql`(e."clientName" ILIKE ${like} OR e."clientContact" ILIKE ${like} OR u."email" ILIKE ${like} OR COALESCE(u."name",'') ILIKE ${like})`,
    );
  }
  if (qVehicle) {
    const like = `%${qVehicle}%`;
    conditions.push(Prisma.sql`(e."vehicleName" ILIKE ${like} OR COALESCE(c."title",'') ILIKE ${like})`);
  }
  if (qVin) {
    const like = `%${qVin}%`;
    conditions.push(Prisma.sql`(COALESCE(e."vin",'') ILIKE ${like} OR COALESCE(c."vin",'') ILIKE ${like})`);
  }
  if (["DRAFT", "SENT", "ACCEPTED", "EXPIRED", "SUPERSEDED"].includes(qStatus)) {
    conditions.push(Prisma.sql`e."status" = ${qStatus}::"VehicleImportEstimateStatus"`);
  }
  if (qFrom) {
    const fromDate = new Date(`${qFrom}T00:00:00.000Z`);
    if (!Number.isNaN(fromDate.getTime())) conditions.push(Prisma.sql`e."createdAt" >= ${fromDate}`);
  }
  if (qTo) {
    const toDate = new Date(`${qTo}T23:59:59.999Z`);
    if (!Number.isNaN(toDate.getTime())) conditions.push(Prisma.sql`e."createdAt" <= ${toDate}`);
  }
  const whereSql = conditions.length > 0 ? Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}` : Prisma.sql``;

  const [kpi, totalRows, estimates] = await Promise.all([
    prisma.$queryRaw<
      Array<{
        totalEstimates: number;
        draftEstimates: number;
        sentEstimates: number;
        acceptedEstimates: number;
        expiredEstimates: number;
      }>
    >(Prisma.sql`
      SELECT
        COUNT(*)::int AS "totalEstimates",
        COUNT(*) FILTER (WHERE "status" = 'DRAFT')::int AS "draftEstimates",
        COUNT(*) FILTER (WHERE "status" = 'SENT')::int AS "sentEstimates",
        COUNT(*) FILTER (WHERE "status" = 'ACCEPTED')::int AS "acceptedEstimates",
        COUNT(*) FILTER (WHERE "status" = 'EXPIRED')::int AS "expiredEstimates"
      FROM "VehicleImportEstimate"
    `),
    prisma.$queryRaw<Array<{ count: number }>>(Prisma.sql`
      SELECT COUNT(*)::int AS "count"
      FROM "VehicleImportEstimate" e
      LEFT JOIN "User" u ON u."id" = e."customerId"
      LEFT JOIN "Order" o ON o."id" = e."orderId"
      LEFT JOIN "Car" c ON c."id" = e."carId"
      ${whereSql}
    `),
    prisma.$queryRaw<
      Array<{
        id: string;
        estimateNumber: string;
        status: string;
        clientName: string;
        clientContact: string;
        vehicleName: string;
        estimatedDutyRangeMin: number | null;
        estimatedDutyRangeMax: number | null;
        estimatedLandedCost: number | null;
        updatedAt: Date;
      }>
    >(Prisma.sql`
      SELECT
        e."id",
        e."estimateNumber",
        e."status"::text AS "status",
        e."clientName",
        e."clientContact",
        e."vehicleName",
        e."estimatedDutyRangeMin",
        e."estimatedDutyRangeMax",
        e."estimatedLandedCost",
        e."updatedAt"
      FROM "VehicleImportEstimate" e
      LEFT JOIN "User" u ON u."id" = e."customerId"
      LEFT JOIN "Order" o ON o."id" = e."orderId"
      LEFT JOIN "Car" c ON c."id" = e."carId"
      ${whereSql}
      ORDER BY e."updatedAt" DESC
      LIMIT ${PAGE_SIZE}
      OFFSET ${(page - 1) * PAGE_SIZE}
    `),
  ]);

  const totalItems = totalRows[0]?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const pageHref = (target: number) => {
    const params = new URLSearchParams();
    if (qCustomer) params.set("customer", qCustomer);
    if (qVehicle) params.set("vehicle", qVehicle);
    if (qVin) params.set("vin", qVin);
    if (qStatus) params.set("status", qStatus);
    if (qFrom) params.set("from", qFrom);
    if (qTo) params.set("to", qTo);
    if (target > 1) params.set("page", String(target));
    const qs = params.toString();
    return qs ? `/admin/estimates?${qs}` : "/admin/estimates";
  };

  const metrics = kpi[0];
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#0c1420] to-black/60 p-6">
        <PageHeading variant="dashboard">Duty Estimates</PageHeading>
        <p className="mt-2 max-w-3xl text-sm text-zinc-400">
          Create and send per-vehicle Ghana duty planning documents for customers. Pair with{" "}
          <Link href="/admin/duty" className="text-[var(--brand)] hover:underline">
            Duty (operations)
          </Link>{" "}
          for live clearance stages and duty payments on each vehicle order.
        </p>
        <form action={createVehicleImportEstimateAction} className="mt-4 grid gap-3 sm:grid-cols-3">
          <input type="hidden" name="customerId" value={prefillCustomerId} />
          <input type="hidden" name="orderId" value={prefillOrderId} />
          <input type="hidden" name="inquiryId" value={prefillInquiryId} />
          <input type="hidden" name="carId" value={prefillCarId} />
          <input name="clientName" defaultValue={prefillClientName} placeholder="Client name" className="h-10 rounded-lg border border-white/15 bg-black/30 px-3 text-sm text-white" />
          <input name="clientContact" defaultValue={prefillClientContact} placeholder="Client contact" className="h-10 rounded-lg border border-white/15 bg-black/30 px-3 text-sm text-white" />
          <input name="vehicleName" defaultValue={prefillVehicleName} placeholder="Vehicle name" className="h-10 rounded-lg border border-white/15 bg-black/30 px-3 text-sm text-white" />
          <button type="submit" className="h-10 rounded-lg bg-[var(--brand)] px-4 text-sm font-semibold text-black hover:opacity-90 sm:col-span-3 sm:w-fit">Quick create</button>
          <Link href="/admin/estimates/new" className="h-10 inline-flex items-center rounded-lg border border-white/15 px-4 text-sm text-zinc-200 hover:bg-white/10 sm:col-span-3 sm:w-fit">Full create form</Link>
        </form>
      </div>

      <div className="grid gap-3 sm:grid-cols-5">
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3"><p className="text-xs text-zinc-500">Total</p><p className="text-lg font-semibold text-white">{metrics?.totalEstimates ?? 0}</p></div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3"><p className="text-xs text-zinc-500">Draft</p><p className="text-lg font-semibold text-amber-300">{metrics?.draftEstimates ?? 0}</p></div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3"><p className="text-xs text-zinc-500">Sent</p><p className="text-lg font-semibold text-cyan-300">{metrics?.sentEstimates ?? 0}</p></div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3"><p className="text-xs text-zinc-500">Accepted</p><p className="text-lg font-semibold text-emerald-300">{metrics?.acceptedEstimates ?? 0}</p></div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3"><p className="text-xs text-zinc-500">Expired</p><p className="text-lg font-semibold text-zinc-300">{metrics?.expiredEstimates ?? 0}</p></div>
      </div>

      <form method="get" action="/admin/estimates" className="grid gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 lg:grid-cols-6">
        <input name="customer" defaultValue={qCustomer} placeholder="Customer/email" className="h-10 rounded-lg border border-white/15 bg-black/30 px-3 text-sm text-white" />
        <input name="vehicle" defaultValue={qVehicle} placeholder="Vehicle" className="h-10 rounded-lg border border-white/15 bg-black/30 px-3 text-sm text-white" />
        <input name="vin" defaultValue={qVin} placeholder="VIN" className="h-10 rounded-lg border border-white/15 bg-black/30 px-3 text-sm text-white" />
        <select name="status" defaultValue={qStatus} className="h-10 rounded-lg border border-white/15 bg-black/30 px-3 text-sm text-white">
          <option value="">All status</option><option value="DRAFT">Draft</option><option value="SENT">Sent</option><option value="ACCEPTED">Accepted</option><option value="EXPIRED">Expired</option><option value="SUPERSEDED">Superseded</option>
        </select>
        <input name="from" type="date" defaultValue={qFrom} className="h-10 rounded-lg border border-white/15 bg-black/30 px-3 text-sm text-white" />
        <input name="to" type="date" defaultValue={qTo} className="h-10 rounded-lg border border-white/15 bg-black/30 px-3 text-sm text-white" />
        <div className="lg:col-span-6 flex flex-wrap items-center gap-2">
          <button type="submit" className="h-10 rounded-lg bg-[var(--brand)] px-4 text-sm font-semibold text-black hover:opacity-90">Apply filters</button>
          <Link href="/admin/estimates" className="h-10 inline-flex items-center rounded-lg border border-white/15 px-4 text-sm text-zinc-200 hover:bg-white/10">Reset</Link>
        </div>
      </form>

      <div className="overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full min-w-[1000px] text-left text-sm">
          <thead className="border-b border-white/10 bg-white/[0.03] text-xs uppercase tracking-wide text-zinc-500">
            <tr><th className="px-4 py-3">Estimate</th><th className="px-4 py-3">Client</th><th className="px-4 py-3">Vehicle</th><th className="px-4 py-3">Duty range</th><th className="px-4 py-3">Landed cost</th><th className="px-4 py-3">Updated</th><th className="px-4 py-3 text-right">Quick actions</th></tr>
          </thead>
          <tbody>
            {estimates.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-zinc-500">No duty estimates yet.</td></tr>
            ) : estimates.map((e) => (
              <tr key={e.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                <td className="px-4 py-3"><p className="font-medium text-white">{e.estimateNumber}</p><p className="text-xs text-zinc-500">{e.status}</p></td>
                <td className="px-4 py-3 text-zinc-300"><p>{e.clientName}</p><p className="text-xs text-zinc-500">{e.clientContact}</p></td>
                <td className="px-4 py-3 text-zinc-300">{e.vehicleName}</td>
                <td className="px-4 py-3 text-zinc-300">{money(e.estimatedDutyRangeMin)} - {money(e.estimatedDutyRangeMax)}</td>
                <td className="px-4 py-3 text-[var(--brand)]">{money(e.estimatedLandedCost)}</td>
                <td className="px-4 py-3 text-xs text-zinc-500">{e.updatedAt.toLocaleString()}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex flex-wrap justify-end gap-2">
                    <Link href={`/admin/estimates/${e.id}`} className="rounded-md border border-white/15 px-2.5 py-1 text-xs text-zinc-100 hover:bg-white/10">Open</Link>
                    <Link href={`/admin/estimates/${e.id}/edit`} className="rounded-md border border-white/15 px-2.5 py-1 text-xs text-zinc-100 hover:bg-white/10">Edit</Link>
                    <a href={`/admin/estimates/${e.id}/export`} className="rounded-md border border-white/15 px-2.5 py-1 text-xs text-zinc-100 hover:bg-white/10">Export</a>
                    <form action={cloneVehicleImportEstimateAction}><input type="hidden" name="id" value={e.id} /><button type="submit" className="rounded-md border border-white/15 px-2.5 py-1 text-xs text-zinc-100 hover:bg-white/10">Duplicate</button></form>
                    <form action={markVehicleImportEstimateSentAction}><input type="hidden" name="id" value={e.id} /><button type="submit" className="rounded-md bg-[var(--brand)] px-2.5 py-1 text-xs font-semibold text-black hover:opacity-90">Mark sent</button></form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 ? (
        <div className="flex flex-wrap items-center justify-center gap-2">
          {page > 1 ? <Link href={pageHref(page - 1)} className="rounded-lg border border-white/15 px-3 py-1.5 text-sm text-zinc-200 hover:bg-white/10">Previous</Link> : null}
          <span className="text-sm text-zinc-500">Page {page} / {totalPages} · {totalItems} total</span>
          {page < totalPages ? <Link href={pageHref(page + 1)} className="rounded-lg border border-white/15 px-3 py-1.5 text-sm text-zinc-200 hover:bg-white/10">Next</Link> : null}
        </div>
      ) : null}
    </div>
  );
}
