import { adminOrdersExportResponse } from "@/lib/admin-orders-export-route-handler";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return adminOrdersExportResponse(req, "xlsx");
}

export async function POST(req: Request) {
  return adminOrdersExportResponse(req, "xlsx");
}
