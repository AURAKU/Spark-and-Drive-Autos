import { adminOrdersExportResponse } from "@/lib/admin-orders-export-route-handler";

export const dynamic = "force-dynamic";

/** Legacy: `?format=pdf` or `?format=xls` (HTML table). Prefer `/export/pdf` and `/export/xlsx`. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const format = url.searchParams.get("format");
  if (format === "pdf") return adminOrdersExportResponse(req, "pdf");
  if (format === "xls") return adminOrdersExportResponse(req, "xls-html");
  return Response.json({ error: "Invalid format. Use pdf, xls, or call /export/xlsx." }, { status: 400 });
}

export async function POST(req: Request) {
  const url = new URL(req.url);
  const format = url.searchParams.get("format");
  if (format === "pdf") return adminOrdersExportResponse(req, "pdf");
  if (format === "xls") return adminOrdersExportResponse(req, "xls-html");
  return Response.json({ error: "Invalid format." }, { status: 400 });
}
