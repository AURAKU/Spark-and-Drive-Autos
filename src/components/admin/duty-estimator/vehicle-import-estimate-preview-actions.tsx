import Link from "next/link";

type VehicleImportEstimatePreviewActionsProps = {
  estimateId: string;
  backHref?: string;
};

export function VehicleImportEstimatePreviewActions({ estimateId, backHref = "/admin/estimates" }: VehicleImportEstimatePreviewActionsProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <Link href={backHref} className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted/60">
        Back
      </Link>
      <div className="flex items-center gap-2">
        <Link href={`/admin/estimates/${estimateId}/edit`} className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted/60">
          Edit estimate
        </Link>
        <a
          href={`/admin/estimates/${estimateId}/export`}
          className="rounded-lg bg-[var(--brand)] px-3 py-1.5 text-sm font-semibold text-black hover:opacity-90"
        >
          Download PDF
        </a>
      </div>
    </div>
  );
}
