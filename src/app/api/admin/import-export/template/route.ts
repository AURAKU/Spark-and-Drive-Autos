import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth-helpers";
import {
  buildCsvLine,
  CAR_BULK_COLUMNS,
  PART_BULK_COLUMNS,
  UTF8_BOM,
} from "@/lib/inventory-bulk";

const schema = z.object({
  entity: z.enum(["CARS", "PARTS"]),
});

/** Same column order as bulk export — open in Excel, Save As .xlsx optional. */
export async function GET(req: Request) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = new URL(req.url);
  const parsed = schema.safeParse({ entity: url.searchParams.get("entity") });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid entity" }, { status: 400 });
  }

  if (parsed.data.entity === "CARS") {
    const header = buildCsvLine([...CAR_BULK_COLUMNS]);
    const sample = buildCsvLine([
      "",
      "",
      "Toyota Camry 2.5L",
      "Toyota",
      "Camry",
      "2022",
      "LE",
      "GASOLINE",
      "Automatic",
      "IN_GHANA",
      "AVAILABLE",
      "185000",
      "0",
      "GHS",
      "DRAFT",
      "false",
      "42000",
      "Silver",
      "Accra",
      "One owner, full service history",
      "",
      "",
      "https://res.cloudinary.com/demo/image/upload/v1/car-cover.jpg",
    ]);
    const csv = UTF8_BOM + [header, sample].join("\n");
    return new NextResponse(csv, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": 'attachment; filename="cars-bulk-template.csv"',
      },
    });
  }

  const header = buildCsvLine([...PART_BULK_COLUMNS]);
  const sample = buildCsvLine([
    "",
    "",
    "OEM Cabin Air Filter",
    "Fits 2018–2022 sedans",
    "Replace every 15k km.\nTorque spec: hand tight.",
    "Service",
    "GHANA",
    "120",
    "0",
    "24",
    "IN_STOCK",
    "false",
    "DRAFT",
    "SKU-FILTER-001",
    "false",
    "",
    "https://res.cloudinary.com/demo/image/upload/v1/part-cover.jpg",
  ]);
  const csv = UTF8_BOM + [header, sample].join("\n");
  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'attachment; filename="parts-bulk-template.csv"',
    },
  });
}
