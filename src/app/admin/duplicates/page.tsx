import { AdminDuplicatesHub } from "@/components/admin/admin-duplicates-hub";
import { PageHeading } from "@/components/typography/page-headings";
import { scanCarDuplicateClusters, scanPartDuplicateClusters } from "@/lib/duplicate-clusters";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const SCAN_CAP = 12_000;

export default async function AdminDuplicatesPage() {
  const [partsTotal, carsTotal, parts, cars, events] = await Promise.all([
    prisma.part.count(),
    prisma.car.count(),
    prisma.part.findMany({
      select: {
        id: true,
        title: true,
        sku: true,
        slug: true,
        category: true,
        listingState: true,
        basePriceRmb: true,
        updatedAt: true,
      },
      take: SCAN_CAP,
      orderBy: { id: "asc" },
    }),
    prisma.car.findMany({
      select: {
        id: true,
        title: true,
        slug: true,
        brand: true,
        model: true,
        year: true,
        vin: true,
        listingState: true,
        basePriceRmb: true,
        updatedAt: true,
      },
      take: SCAN_CAP,
      orderBy: { id: "asc" },
    }),
    prisma.duplicateCheckEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: 120,
    }),
  ]);

  const partMembers = parts.map((p) => ({
    id: p.id,
    title: p.title,
    sku: p.sku,
    slug: p.slug,
    category: p.category,
    listingState: p.listingState,
    basePriceRmb: p.basePriceRmb.toString(),
    updatedAt: p.updatedAt.toISOString(),
  }));

  const carMembers = cars.map((c) => ({
    id: c.id,
    title: c.title,
    slug: c.slug,
    brand: c.brand,
    model: c.model,
    year: c.year,
    vin: c.vin,
    listingState: c.listingState,
    basePriceRmb: c.basePriceRmb.toString(),
    updatedAt: c.updatedAt.toISOString(),
  }));

  const partClusters = scanPartDuplicateClusters(partMembers);
  const carClusters = scanCarDuplicateClusters(carMembers);

  const logRows = events.map((e) => ({
    id: e.id,
    entityType: e.entityType,
    entityId: e.entityId,
    candidateId: e.candidateId,
    score: e.score,
    summary: e.summary,
    decision: e.decision,
    createdAt: e.createdAt.toISOString(),
  }));

  const inventoryTruncated = partsTotal > SCAN_CAP || carsTotal > SCAN_CAP;

  return (
    <div>
      <PageHeading variant="dashboard">Duplicate inventory</PageHeading>
      <p className="mt-2 max-w-3xl text-sm text-zinc-400">
        Parts and vehicles are matched using <strong className="text-zinc-200">SKU</strong>,{" "}
        <strong className="text-zinc-200">VIN</strong>, normalized titles, token overlap (order-independent), and fuzzy
        title similarity (Dice bigrams). Each cluster is actionable: edit the canonical listing, or delete redundant
        rows. Live warnings from saves appear in the log tab.
      </p>
      <p className="mt-2 text-xs text-zinc-600">
        Scanned parts: {parts.length.toLocaleString()} / {partsTotal.toLocaleString()} · Cars: {cars.length.toLocaleString()}{" "}
        / {carsTotal.toLocaleString()} (cap {SCAN_CAP.toLocaleString()} per type, oldest IDs first).
      </p>

      <div className="mt-8">
        <AdminDuplicatesHub
          partClusters={partClusters}
          carClusters={carClusters}
          events={logRows}
          partsScanned={parts.length}
          partsTotal={partsTotal}
          carsScanned={cars.length}
          carsTotal={carsTotal}
          inventoryTruncated={inventoryTruncated}
        />
      </div>
    </div>
  );
}
