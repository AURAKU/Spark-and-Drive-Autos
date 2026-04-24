import type { DutyRecord, User, Car, Order } from "@prisma/client";

type DutyEstimateDetailRecord = DutyRecord & {
  updatedBy?: Pick<User, "id" | "name" | "email"> | null;
  order: Pick<Order, "id" | "reference"> & {
    user?: Pick<User, "id" | "name" | "email"> | null;
    car?: Pick<Car, "id" | "title" | "slug"> | null;
  };
};

function readMoney(value: unknown, currency = "GHS"): string {
  if (value == null) return "-";
  const num = Number(value);
  if (!Number.isFinite(num)) return "-";
  return `${currency} ${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function DutyEstimateDetail({ record }: { record: DutyEstimateDetailRecord }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5 text-card-foreground">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Reference</p>
          <p className="mt-1 font-mono text-sm">{record.order.reference ?? record.id}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Created</p>
          <p className="mt-1 text-sm">{new Date(record.createdAt).toLocaleString()}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Vehicle</p>
          <p className="mt-1 text-sm">{record.order.car?.title ?? "N/A"}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Workflow stage</p>
          <p className="mt-1 text-sm">{record.workflowStage.replaceAll("_", " ")}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Estimated duty</p>
          <p className="mt-1 text-sm">{readMoney(record.estimateTotalGhs)}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Assessed duty</p>
          <p className="mt-1 text-sm">{readMoney(record.assessedDutyGhs)}</p>
        </div>
      </div>
      {record.notes ? (
        <div className="mt-5">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Notes</p>
          <p className="mt-1 text-sm leading-relaxed">{record.notes}</p>
        </div>
      ) : null}
    </section>
  );
}
