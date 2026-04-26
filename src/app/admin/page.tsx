import { redirect } from "next/navigation";

import { CommandCenterDashboard } from "@/components/admin/command-center-dashboard";
import { PageHeading } from "@/components/typography/page-headings";
import { carWhereForOpsState } from "@/lib/admin-car-ops-state";
import { normalizeIntelListPage } from "@/lib/ops";
import { prisma } from "@/lib/prisma";
import { safeAuth } from "@/lib/safe-auth";

export const dynamic = "force-dynamic";

const ACTIVITY_PAGE_SIZE = 10;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function readActivityPage(sp: Record<string, string | string[] | undefined>): number {
  const v = sp.activityPage;
  const s = typeof v === "string" ? v : Array.isArray(v) ? v[0] : undefined;
  if (s == null || s === "") return 1;
  const n = parseInt(s, 10);
  return normalizeIntelListPage(Number.isFinite(n) ? n : undefined);
}

export default async function AdminHome(props: { searchParams: SearchParams }) {
  const sp = await props.searchParams;
  const session = await safeAuth();
  if (session?.user?.role === "SERVICE_ASSISTANT") {
    redirect("/admin/comms");
  }

  const [
    totalCars,
    totalParts,
    publishedCars,
    soldCars,
    shippedCars,
    inTransitCars,
    availGh,
    availCn,
    reservedCars,
    publishedParts,
    lowStockParts,
    preorderParts,
    revenue,
    activityTotal,
  ] = await Promise.all([
    prisma.car.count(),
    prisma.part.count(),
    prisma.car.count({ where: { listingState: "PUBLISHED" } }),
    prisma.car.count({ where: carWhereForOpsState("SOLD") }),
    prisma.car.count({ where: carWhereForOpsState("SHIPPED") }),
    prisma.car.count({ where: carWhereForOpsState("IN_TRANSIT") }),
    prisma.car.count({ where: carWhereForOpsState("AVAILABLE_GHANA") }),
    prisma.car.count({ where: carWhereForOpsState("AVAILABLE_CHINA") }),
    prisma.car.count({ where: carWhereForOpsState("RESERVED_DEPOSIT") }),
    prisma.part.count({ where: { listingState: "PUBLISHED" } }),
    prisma.part.count({
      where: {
        listingState: "PUBLISHED",
        origin: "GHANA",
        stockStatus: { not: "ON_REQUEST" },
        stockQty: { gte: 1, lte: 5 },
      },
    }),
    prisma.part.count({ where: { listingState: "PUBLISHED", stockStatus: "ON_REQUEST" } }),
    prisma.payment.aggregate({
      where: { status: "SUCCESS" },
      _sum: { amount: true },
    }),
    prisma.auditLog.count(),
  ]);

  const activityPageReq = readActivityPage(sp);
  const activityTotalPages = Math.max(1, Math.ceil(Math.max(0, activityTotal) / ACTIVITY_PAGE_SIZE));
  const activityPage = Math.min(Math.max(1, activityPageReq), activityTotalPages);

  const auditRows = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    skip: (activityPage - 1) * ACTIVITY_PAGE_SIZE,
    take: ACTIVITY_PAGE_SIZE,
    include: { actor: { select: { name: true, email: true } } },
  });

  const revenueGhs = revenue._sum.amount ? Number(revenue._sum.amount) : 0;

  const summaryCards = [
    { label: "Total vehicles", value: totalCars },
    { label: "Total parts SKUs", value: totalParts },
    { label: "Published listings (cars)", value: publishedCars },
    { label: "Published parts", value: publishedParts },
    { label: "Sold (vehicles)", value: soldCars },
    { label: "Shipped pipeline (vehicles)", value: shippedCars },
    { label: "In transit (vehicles)", value: inTransitCars },
    { label: "Available · Ghana", value: availGh },
    { label: "Available · China", value: availCn },
    { label: "Reserved · deposit", value: reservedCars },
    { label: "Low-stock parts", value: lowStockParts },
    { label: "Pre-order parts", value: preorderParts },
  ];

  const inventoryBars = [
    { name: "Sold", cars: soldCars, parts: 0 },
    { name: "Shipped", cars: shippedCars, parts: 0 },
    { name: "In transit", cars: inTransitCars, parts: 0 },
    { name: "Avail. GH", cars: availGh, parts: 0 },
    { name: "Avail. CN", cars: availCn, parts: 0 },
    { name: "Reserved", cars: reservedCars, parts: 0 },
    { name: "Parts live", cars: 0, parts: publishedParts },
    { name: "Low stock", cars: 0, parts: lowStockParts },
  ];

  const partsHealth = [
    { name: "Published", value: publishedParts, fill: "#22c55e" },
    { name: "Low stock", value: lowStockParts, fill: "#eab308" },
    { name: "Pre-order", value: preorderParts, fill: "#a855f7" },
    {
      name: "Other",
      value: Math.max(0, totalParts - publishedParts),
      fill: "#52525b",
    },
  ];

  const activity = auditRows.map((a) => {
    const actor = a.actor?.name ?? a.actor?.email ?? "System";
    let href: string | null = null;
    if (a.entityType === "Car" && a.entityId) href = `/admin/cars/${a.entityId}/edit`;
    if (a.entityType === "Part" && a.entityId) href = `/admin/parts/${a.entityId}/edit`;

    return {
      id: a.id,
      label: a.action.replace(/\./g, " · "),
      sub: `${a.entityType} · ${actor}`,
      at: a.createdAt.toISOString().slice(0, 16).replace("T", " "),
      href,
    };
  });

  const activityHref = (nextPage: number) => {
    const p = new URLSearchParams();
    if (nextPage > 1) p.set("activityPage", String(nextPage));
    const qs = p.toString();
    return qs ? `/admin?${qs}` : "/admin";
  };

  return (
    <div>
      <PageHeading variant="dashboard">Command Center</PageHeading>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">
        Live operational snapshot across vehicle inventory, parts, and payments — with quick actions to the workflows you
        use every day.
      </p>
      <div className="mt-10">
        <CommandCenterDashboard
          summaryCards={summaryCards}
          inventoryBars={inventoryBars}
          partsHealth={partsHealth}
          revenueGhs={revenueGhs}
          activity={activity}
          activityPage={activityPage}
          activityTotalPages={activityTotalPages}
          activityTotal={activityTotal}
          activityPageSize={ACTIVITY_PAGE_SIZE}
          activityPrevHref={activityPage > 1 ? activityHref(activityPage - 1) : null}
          activityNextHref={activityPage < activityTotalPages ? activityHref(activityPage + 1) : null}
          activityPageHrefs={
            activityTotalPages > 1
              ? Array.from({ length: activityTotalPages }, (_, i) => activityHref(i + 1))
              : undefined
          }
        />
      </div>
    </div>
  );
}
