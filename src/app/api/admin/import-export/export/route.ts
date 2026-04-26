import type { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth-helpers";
import { carsToCsv, partsToCsv, type CarExportShape, type PartExportShape } from "@/lib/inventory-bulk";
import { prisma } from "@/lib/prisma";

const entityEnum = z.enum(["CARS", "PARTS"]);
const sortEnum = z.enum(["updated", "title"]);

function carSelect() {
  return {
    id: true,
    slug: true,
    title: true,
    brand: true,
    model: true,
    year: true,
    trim: true,
    engineType: true,
    transmission: true,
    sourceType: true,
    availabilityStatus: true,
    basePriceRmb: true,
    price: true,
    currency: true,
    listingState: true,
    featured: true,
    mileage: true,
    colorExterior: true,
    location: true,
    shortDescription: true,
    seaShippingFeeGhs: true,
    supplierCostRmb: true,
    coverImageUrl: true,
  } satisfies Prisma.CarSelect;
}

function partSelect() {
  return {
    id: true,
    slug: true,
    title: true,
    shortDescription: true,
    description: true,
    category: true,
    origin: true,
    basePriceRmb: true,
    priceGhs: true,
    stockQty: true,
    stockStatus: true,
    stockStatusLocked: true,
    listingState: true,
    sku: true,
    featured: true,
    supplierCostRmb: true,
    coverImageUrl: true,
  } satisfies Prisma.PartSelect;
}

async function exportCars(opts: {
  ids?: string[];
  q?: string;
  sort: "updated" | "title";
  page?: number;
  pageSize?: number;
  exportScope: "selected" | "current_page" | "all_filtered";
}) {
  const where: Prisma.CarWhereInput = {};
  if (opts.exportScope === "selected" && opts.ids?.length) {
    where.id = { in: opts.ids.slice(0, 2500) };
  } else if (opts.q?.trim()) {
    const q = opts.q.trim();
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { brand: { contains: q, mode: "insensitive" } },
      { model: { contains: q, mode: "insensitive" } },
      { slug: { contains: q, mode: "insensitive" } },
    ];
  }
  const orderBy = opts.sort === "title" ? { title: "asc" as const } : { updatedAt: "desc" as const };
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.max(1, Math.min(2500, opts.pageSize ?? 15));
  const rows = await prisma.car.findMany({
    where,
    orderBy,
    skip: opts.exportScope === "current_page" ? (page - 1) * pageSize : 0,
    take: opts.exportScope === "current_page" ? pageSize : 2500,
    select: carSelect(),
  });
  return rows as unknown as CarExportShape[];
}

async function exportParts(opts: {
  ids?: string[];
  q?: string;
  sort: "updated" | "title";
  page?: number;
  pageSize?: number;
  exportScope: "selected" | "current_page" | "all_filtered";
}) {
  const where: Prisma.PartWhereInput = {};
  if (opts.exportScope === "selected" && opts.ids?.length) {
    where.id = { in: opts.ids.slice(0, 2500) };
  } else if (opts.q?.trim()) {
    const q = opts.q.trim();
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { slug: { contains: q, mode: "insensitive" } },
      { sku: { contains: q, mode: "insensitive" } },
      { category: { contains: q, mode: "insensitive" } },
    ];
  }
  const orderBy = opts.sort === "title" ? { title: "asc" as const } : { updatedAt: "desc" as const };
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.max(1, Math.min(2500, opts.pageSize ?? 15));
  const rows = await prisma.part.findMany({
    where,
    orderBy,
    skip: opts.exportScope === "current_page" ? (page - 1) * pageSize : 0,
    take: opts.exportScope === "current_page" ? pageSize : 2500,
    select: partSelect(),
  });
  return rows as unknown as PartExportShape[];
}

const postBodySchema = z.object({
  entity: entityEnum,
  ids: z.array(z.string().cuid()).max(2500).optional(),
  q: z.string().max(200).optional(),
  sort: sortEnum.optional().default("updated"),
  exportScope: z.enum(["selected", "current_page", "all_filtered"]).default("all_filtered"),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(2500).optional(),
});

export async function POST(req: Request) {
  let session: Awaited<ReturnType<typeof requireAdmin>>;
  try {
    session = await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = postBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
  }

  const { entity, ids, q, sort, exportScope, page, pageSize } = parsed.data;
  const job = await prisma.exportJob.create({
    data: { entity, status: "RUNNING", createdById: session.user.id },
  });

  try {
    if (entity === "CARS") {
      const cars = await exportCars({ ids, q, sort, exportScope, page, pageSize });
      const csv = carsToCsv(cars);
      await prisma.exportJob.update({
        where: { id: job.id },
        data: { status: "COMPLETED", summary: `Exported ${cars.length} vehicle(s)` },
      });
      return new NextResponse(csv, {
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": `attachment; filename="cars-bulk-${new Date().toISOString().slice(0, 10)}.csv"`,
        },
      });
    }
    const parts = await exportParts({ ids, q, sort, exportScope, page, pageSize });
    const csv = partsToCsv(parts);
    await prisma.exportJob.update({
      where: { id: job.id },
      data: { status: "COMPLETED", summary: `Exported ${parts.length} part(s)` },
    });
    return new NextResponse(csv, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="parts-bulk-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch (e) {
    await prisma.exportJob.update({
      where: { id: job.id },
      data: { status: "FAILED", summary: e instanceof Error ? e.message : "Export failed" },
    });
    throw e;
  }
}

export async function GET(req: Request) {
  let session: Awaited<ReturnType<typeof requireAdmin>>;
  try {
    session = await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const entityParsed = entityEnum.safeParse(url.searchParams.get("entity"));
  if (!entityParsed.success) return NextResponse.json({ error: "Invalid entity" }, { status: 400 });
  const sortParsed = sortEnum.safeParse(url.searchParams.get("sort") ?? "updated");
  const sort = sortParsed.success ? sortParsed.data : "updated";
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 200) || undefined;
  const idsRaw = url.searchParams.get("ids");
  const ids =
    idsRaw && idsRaw.length > 0
      ? idsRaw
          .split(",")
          .map((s) => s.trim())
          .filter((s) => z.string().cuid().safeParse(s).success)
          .slice(0, 2500)
      : undefined;

  const job = await prisma.exportJob.create({
    data: { entity: entityParsed.data, status: "RUNNING", createdById: session.user.id },
  });

  try {
    if (entityParsed.data === "CARS") {
      const cars = await exportCars({ ids, q, sort, exportScope: "all_filtered" });
      const csv = carsToCsv(cars);
      await prisma.exportJob.update({
        where: { id: job.id },
        data: { status: "COMPLETED", summary: `Exported ${cars.length} vehicle(s)` },
      });
      return new NextResponse(csv, {
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": `attachment; filename="cars-bulk-${new Date().toISOString().slice(0, 10)}.csv"`,
        },
      });
    }
    const parts = await exportParts({ ids, q, sort, exportScope: "all_filtered" });
    const csv = partsToCsv(parts);
    await prisma.exportJob.update({
      where: { id: job.id },
      data: { status: "COMPLETED", summary: `Exported ${parts.length} part(s)` },
    });
    return new NextResponse(csv, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="parts-bulk-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch (e) {
    await prisma.exportJob.update({
      where: { id: job.id },
      data: { status: "FAILED", summary: e instanceof Error ? e.message : "Export failed" },
    });
    throw e;
  }
}
