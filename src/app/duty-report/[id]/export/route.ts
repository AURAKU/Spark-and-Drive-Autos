import { NextResponse } from "next/server";

import { loadAuthorizedDutyReport } from "@/lib/duty-intelligence/report.server";
import { buildDutyIntelligenceReportPdf, dutyReportPdfFilename } from "@/lib/duty-intelligence/report-pdf";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const access = new URL(req.url).searchParams.get("access");
  const loaded = await loadAuthorizedDutyReport(id, access);
  if (!loaded.ok) {
    return NextResponse.json({ error: loaded.error }, { status: loaded.status });
  }

  try {
    const pdf = await buildDutyIntelligenceReportPdf(loaded.report);
    const filename = dutyReportPdfFilename(loaded.report.reportReference);
    return new NextResponse(Buffer.from(pdf), {
      status: 200,
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="${filename}"`,
        "cache-control": "private, no-store",
      },
    });
  } catch (e) {
    console.error("[duty-report export]", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "PDF generation failed." }, { status: 500 });
  }
}
