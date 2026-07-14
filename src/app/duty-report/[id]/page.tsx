import Link from "next/link";

import { DutyReportActions } from "@/components/duty/report/duty-report-actions";
import { DutyReportDocument } from "@/components/duty/report/duty-report-document";
import { loadAuthorizedDutyReport } from "@/lib/duty-intelligence/report.server";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstQuery(sp: Record<string, string | string[] | undefined>, key: string): string | undefined {
  const v = sp[key];
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v.find((x): x is string => typeof x === "string" && x.length > 0);
  return undefined;
}

export default async function DutyReportPage(props: {
  params: Promise<{ id: string }>;
  searchParams: SearchParams;
}) {
  const { id } = await props.params;
  const sp = await props.searchParams;
  const access = firstQuery(sp, "access");
  const loaded = await loadAuthorizedDutyReport(id, access);

  if (!loaded.ok) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="text-xl font-semibold text-neutral-900">
          {loaded.status === 403 ? "Access denied" : "Report unavailable"}
        </h1>
        <p className="mt-3 text-sm text-neutral-600">{loaded.error}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/inventory" className="rounded-lg bg-teal-800 px-4 py-2 text-sm font-semibold text-white">
            Back to inventory
          </Link>
          <Link href="/" className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-800">
            Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="px-3 py-6 sm:px-6 print:p-0">
      <DutyReportActions calculationId={id} accessToken={access} backHref="/inventory" />
      <DutyReportDocument report={loaded.report} />
    </div>
  );
}
