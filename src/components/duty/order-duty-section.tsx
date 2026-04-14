import Link from "next/link";

import { DutyEstimateDisclosure } from "@/components/duty/duty-estimate-disclosure";
import { DutyOfficialLinks } from "@/components/duty/duty-official-links";
import { PaymentStatusBadge } from "@/components/payments/payment-status-badge";
import { formatMoney } from "@/lib/format";
import { dutyWorkflowLabel } from "@/lib/duty/workflow";
import { prisma } from "@/lib/prisma";

type EstimateJson = {
  totalGhs?: number;
  lines?: Array<{ label: string; amountGhs: number }>;
  formulaVersion?: string;
};

export async function OrderDutySection({ orderId, orderKind }: { orderId: string; orderKind: "CAR" | "PARTS" }) {
  if (orderKind !== "CAR") {
    return null;
  }

  const duty = await prisma.dutyRecord.findFirst({
    where: { orderId },
    orderBy: { updatedAt: "desc" },
  });

  if (!duty) {
    return (
      <div className="mt-10 rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.05] to-black/40 p-5">
        <h2 className="text-lg font-semibold text-white">Import duty (Ghana)</h2>
        <p className="mt-1 text-xs text-zinc-500">Sea import clearance — your case appears here once sea freight is set up.</p>
        <div className="mt-4 rounded-xl border border-white/10 bg-black/30 p-4">
          <p className="text-sm leading-relaxed text-zinc-300">
            We have not opened a duty file for this order yet. That usually happens after your vehicle is on a sea
            shipment and our operations team links clearance tracking to your order. You will see stage updates,
            official references, and any duty payment requests here — not before we have something concrete to share.
          </p>
          <p className="mt-3 text-xs text-zinc-500">
            Nothing below is an estimate or a bill until we publish it. For general rules and portals, use the official
            links.
          </p>
        </div>
        <div className="mt-5 rounded-xl border border-amber-500/15 bg-amber-500/5 p-3">
          <DutyEstimateDisclosure variant="short" />
        </div>
        <div className="mt-4">
          <DutyOfficialLinks compact />
        </div>
        <p className="mt-4 text-xs text-zinc-600">
          Questions?{" "}
          <Link href="/chat" className="text-[var(--brand)] hover:underline">
            Chat with us
          </Link>
          .
        </p>
      </div>
    );
  }

  const dutyPayments = await prisma.payment.findMany({
    where: { orderId, paymentType: "DUTY" },
    orderBy: { createdAt: "desc" },
    take: 6,
  });

  const estimate = duty.estimateJson as EstimateJson | null;

  return (
    <div className="mt-10 rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.05] to-black/40 p-5">
      <h2 className="text-lg font-semibold text-white">Import duty (Ghana)</h2>
      <p className="mt-1 text-xs text-zinc-500">Sea import clearance — updates from our operations team.</p>

      <div className="mt-4 rounded-xl border border-[var(--brand)]/20 bg-[var(--brand)]/5 px-4 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--brand)]">Current stage</p>
        <p className="mt-1 text-sm font-medium text-white">{dutyWorkflowLabel(duty.workflowStage)}</p>
      </div>

      {duty.customerVisibleNote ? (
        <div className="mt-4 rounded-xl border border-white/10 bg-black/30 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Update from our team</p>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-zinc-300">{duty.customerVisibleNote}</p>
        </div>
      ) : null}

      {(duty.estimateTotalGhs != null || estimate?.totalGhs != null) && (
        <div className="mt-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Estimated duty (in-app planning)</p>
          <p className="mt-1 text-xl font-semibold text-[var(--brand)]">
            {formatMoney(Number(duty.estimateTotalGhs ?? estimate?.totalGhs ?? 0), duty.currency)}
          </p>
          {estimate?.lines && estimate.lines.length > 0 ? (
            <ul className="mt-3 space-y-1 text-xs text-zinc-500">
              {estimate.lines.map((line) => (
                <li key={line.label} className="flex justify-between gap-2">
                  <span>{line.label}</span>
                  <span className="font-mono text-zinc-400">{formatMoney(line.amountGhs, duty.currency)}</span>
                </li>
              ))}
            </ul>
          ) : null}
          {duty.formulaVersion ? (
            <p className="mt-2 text-[10px] font-mono text-zinc-600">Model: {duty.formulaVersion}</p>
          ) : null}
        </div>
      )}

      {duty.assessedDutyGhs != null ? (
        <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-200/90">
            Recorded payable figure (operations)
          </p>
          <p className="mt-1 text-lg font-semibold text-emerald-100">{formatMoney(Number(duty.assessedDutyGhs), duty.currency)}</p>
          <p className="mt-2 text-xs text-emerald-100/70">
            This is the amount our team recorded for settlement in Spark &amp; Drive — not a Ghana Customs assessment
            certificate. Final charges always follow ICUMS / your clearance paperwork.
          </p>
        </div>
      ) : null}

      {dutyPayments.length > 0 ? (
        <div className="mt-6 border-t border-white/10 pt-5">
          <h3 className="text-sm font-semibold text-white">Duty payments</h3>
          <ul className="mt-3 space-y-2">
            {dutyPayments.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 bg-black/25 px-3 py-2">
                <div className="flex items-center gap-2">
                  <PaymentStatusBadge status={p.status} />
                  <span className="text-sm text-[var(--brand)]">{formatMoney(Number(p.amount), p.currency)}</span>
                </div>
                <Link href={`/dashboard/payments/${p.id}`} className="text-xs text-[var(--brand)] hover:underline">
                  Open payment
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-6 rounded-xl border border-amber-500/15 bg-amber-500/5 p-3">
        <DutyEstimateDisclosure variant="short" />
      </div>
      <div className="mt-4">
        <DutyOfficialLinks compact />
      </div>
    </div>
  );
}
