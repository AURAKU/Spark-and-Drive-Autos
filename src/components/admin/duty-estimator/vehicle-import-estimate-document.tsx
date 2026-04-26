import { engineTypeLabel } from "@/lib/engine-type-ui";
import { formatEstimateMoney, type VehicleImportEstimateRecord } from "@/lib/vehicle-import-estimate/data";
import { deriveDutyEstimate } from "@/lib/vehicle-import-estimate";

type VehicleImportEstimateStatus = VehicleImportEstimateRecord["status"];
type VehicleImportEstimate = VehicleImportEstimateRecord;

type EstimateDocumentProps = {
  estimate: VehicleImportEstimate;
};

function statusBadge(status: VehicleImportEstimateStatus) {
  if (status === "ACCEPTED") return "bg-emerald-500/15 text-emerald-300 border-emerald-400/35";
  if (status === "SENT") return "bg-cyan-500/15 text-cyan-300 border-cyan-400/35";
  if (status === "EXPIRED") return "bg-zinc-500/15 text-zinc-300 border-zinc-400/35";
  if (status === "SUPERSEDED") return "bg-violet-500/15 text-violet-300 border-violet-400/35";
  return "bg-amber-500/15 text-amber-300 border-amber-400/35";
}

export function VehicleImportEstimateDocument({ estimate }: EstimateDocumentProps) {
  const dutyLogic = deriveDutyEstimate({
    fob: estimate.fob ?? undefined,
    freight: estimate.freight ?? undefined,
    insurance: estimate.insurance ?? undefined,
    cif: estimate.cif ?? undefined,
    estimatedDutyRangeMin: estimate.estimatedDutyRangeMin ?? undefined,
    estimatedDutyRangeMax: estimate.estimatedDutyRangeMax ?? undefined,
    estimatedLandedCost: estimate.estimatedLandedCost ?? undefined,
    engineType: estimate.engineType ?? undefined,
  });

  return (
    <article className="rounded-2xl border border-border bg-card p-6 text-card-foreground shadow-sm dark:border-white/10 dark:bg-white/[0.02]">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4 dark:border-white/10">
        <div>
          <p className="text-xs font-semibold tracking-[0.16em] text-muted-foreground uppercase">Duty estimate (Ghana import)</p>
          <h2 className="mt-1 text-xl font-semibold">Spark and Drive Autos</h2>
          <p className="mt-1 text-xs text-muted-foreground">Estimate No: {estimate.estimateNumber}</p>
        </div>
        <span className={`rounded-full border px-3 py-1 text-xs font-semibold tracking-wide ${statusBadge(estimate.status)}`}>
          {estimate.status}
        </span>
      </header>

      <section className="mt-5 grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-border/70 p-4 dark:border-white/10">
          <p className="text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">Client Details</p>
          <p className="mt-2 text-sm"><span className="text-muted-foreground">Client name:</span> {estimate.clientName}</p>
          <p className="mt-1 text-sm"><span className="text-muted-foreground">Contact:</span> {estimate.clientContact}</p>
        </div>
        <div className="rounded-xl border border-border/70 p-4 dark:border-white/10">
          <p className="text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">Vehicle Details</p>
          <p className="mt-2 text-sm"><span className="text-muted-foreground">Vehicle name:</span> {estimate.vehicleName}</p>
          <p className="mt-1 text-sm">
            <span className="text-muted-foreground">Powertrain:</span>{" "}
            {estimate.engineType ? engineTypeLabel(estimate.engineType) : "Not specified (default planning: petrol)"}
          </p>
          <p className="mt-1 text-sm"><span className="text-muted-foreground">Model year:</span> {estimate.modelYear ?? "-"}</p>
          <p className="mt-1 text-sm"><span className="text-muted-foreground">VIN:</span> {estimate.vin ?? "-"}</p>
        </div>
      </section>

      <section className="mt-5 rounded-xl border border-border/70 p-4 dark:border-white/10">
        <p className="text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">Cost Breakdown</p>
        <div className="mt-3 grid gap-2 text-sm md:grid-cols-2">
          <p><span className="text-muted-foreground">FOB:</span> {formatEstimateMoney(estimate.fob)}</p>
          <p><span className="text-muted-foreground">Freight:</span> {formatEstimateMoney(estimate.freight)}</p>
          <p><span className="text-muted-foreground">Insurance:</span> {formatEstimateMoney(estimate.insurance)}</p>
          <p><span className="text-muted-foreground">CIF:</span> {formatEstimateMoney(estimate.cif)}</p>
        </div>
      </section>

      <section className="mt-5 rounded-xl border border-border/70 p-4 dark:border-white/10">
        <p className="text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">Ghana Duty Estimate</p>
        <div className="mt-3 grid gap-2 text-sm">
          <p>
            <span className="text-muted-foreground">Estimated duty range:</span>{" "}
            {formatEstimateMoney(estimate.estimatedDutyRangeMin)} - {formatEstimateMoney(estimate.estimatedDutyRangeMax)}
          </p>
          <p>
            <span className="text-muted-foreground">Estimated landed cost:</span>{" "}
            {formatEstimateMoney(estimate.estimatedLandedCost)}
          </p>
          <p className="text-xs text-zinc-500">
            Estimation mode: <span className="font-medium text-zinc-300">{dutyLogic.mode}</span>
            {dutyLogic.landedCostDerived ? " · Landed cost derived from CIF + midpoint duty estimate" : " · Landed cost manually set by admin"}
          </p>
        </div>
      </section>

      <section className="mt-5 rounded-xl border border-amber-400/30 bg-amber-500/[0.08] p-4">
        <p className="text-xs font-semibold tracking-[0.14em] text-amber-300 uppercase">Important Notice</p>
        <p className="mt-2 text-sm leading-relaxed text-amber-100/90">{estimate.importantNotice}</p>
        <p className="mt-2 text-xs text-amber-100/85">{dutyLogic.uncertaintyNote}</p>
      </section>

      <footer className="mt-6 border-t border-border pt-4 text-sm dark:border-white/10">
        <p>
          <span className="text-muted-foreground">Prepared by:</span> {estimate.preparedByName}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">Created: {new Date(estimate.createdAt).toLocaleString()}</p>
        {estimate.finalizedAt ? (
          <p className="mt-1 text-xs text-muted-foreground">Finalized: {new Date(estimate.finalizedAt).toLocaleString()}</p>
        ) : null}
        {estimate.sentAt ? <p className="mt-1 text-xs text-muted-foreground">Marked sent: {new Date(estimate.sentAt).toLocaleString()}</p> : null}
      </footer>
    </article>
  );
}
