"use client";

import type { EngineType } from "@prisma/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  createDutyPaymentRequestAction,
  ensureDutyCaseForOrderAction,
  saveDutyEstimateAction,
  setAssessedDutyGhsAction,
  updateDutyNotesAction,
  updateDutyWorkflowStageAction,
} from "@/actions/duty-admin";
import { DutyCalculatorPanel } from "@/components/duty/duty-calculator-panel";
import { DutyEstimateDisclosure } from "@/components/duty/duty-estimate-disclosure";
import { DutyOfficialLinks } from "@/components/duty/duty-official-links";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DUTY_WORKFLOW_ORDER, dutyWorkflowLabel } from "@/lib/duty/workflow";
import type { AdminDutyOrderRow } from "@/lib/duty/admin-duty-types";
import { formatMoney } from "@/lib/format";

import { computeDutyEstimate, dutyEstimateInputSchema } from "@/lib/duty/calculator";

type Props = { rows: AdminDutyOrderRow[] };

export function AdminDutyHubClient({ rows }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [openId, setOpenId] = useState<string | null>(rows[0]?.id ?? null);

  const selected = useMemo(() => rows.find((r) => r.id === openId) ?? null, [rows, openId]);

  function run(action: () => Promise<{ ok?: boolean; error?: string }>, okMsg: string) {
    start(async () => {
      const res = await action();
      if (res.error) toast.error(res.error);
      else {
        toast.success(okMsg);
        router.refresh();
      }
    });
  }

  return (
    <div className="grid gap-8 xl:grid-cols-[1.15fr_0.85fr]">
      <div className="space-y-4">
        <div className="overflow-x-auto rounded-2xl border border-white/10">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-white/10 bg-white/[0.03] text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-4 py-3">Order</th>
                <th className="px-4 py-3">Vehicle</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Sea stage</th>
                <th className="px-4 py-3">Duty stage</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-zinc-500">
                    No paid vehicle orders in scope. Duty cases attach after vehicle checkout and sea shipment setup.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr
                    key={r.id}
                    className={`cursor-pointer border-b border-white/5 hover:bg-white/[0.02] ${openId === r.id ? "bg-white/[0.04]" : ""}`}
                    onClick={() => setOpenId(r.id)}
                  >
                    <td className="px-4 py-3 font-mono text-xs text-zinc-300">{r.reference}</td>
                    <td className="px-4 py-3 text-zinc-400">{r.carTitle ?? "—"}</td>
                    <td className="px-4 py-3 text-xs text-zinc-500">{r.userEmail ?? "—"}</td>
                    <td className="px-4 py-3 text-xs text-zinc-500">{r.seaShipment?.currentStage.replaceAll("_", " ") ?? "—"}</td>
                    <td className="px-4 py-3 text-xs text-zinc-400">
                      {r.duty ? dutyWorkflowLabel(r.duty.workflowStage) : "No case"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/orders/${r.id}`}
                        className="text-xs text-[var(--brand)] hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Order
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {selected ? (
          <div className="space-y-6 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-white">Duty operations</h2>
                <p className="mt-1 font-mono text-xs text-zinc-500">{selected.reference}</p>
                <p className="mt-2 text-sm text-zinc-400">{selected.carTitle ?? "Vehicle"}</p>
              </div>
              {!selected.duty ? (
                <Button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    run(async () => {
                      const fd = new FormData();
                      fd.set("orderId", selected.id);
                      return ensureDutyCaseForOrderAction(null, fd);
                    }, "Duty case created")
                  }
                >
                  Create duty case
                </Button>
              ) : null}
            </div>

            {selected.duty ? (
              <>
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
                  <DutyEstimateDisclosure variant="long" />
                </div>

                <section className="space-y-3">
                  <h3 className="text-sm font-semibold text-white">Workflow stage</h3>
                  <form
                    className="flex flex-col gap-3 sm:flex-row sm:items-end"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const fd = new FormData(e.currentTarget);
                      run(async () => updateDutyWorkflowStageAction(null, fd), "Workflow updated");
                    }}
                  >
                    <input type="hidden" name="dutyId" value={selected.duty.id} />
                    <div className="min-w-0 flex-1 space-y-1">
                      <Label className="text-xs text-zinc-500">Stage</Label>
                      <select
                        name="workflowStage"
                        defaultValue={selected.duty.workflowStage}
                        className="h-10 w-full rounded-lg border border-white/15 bg-black/40 px-3 text-sm text-white"
                      >
                        {DUTY_WORKFLOW_ORDER.map((s) => (
                          <option key={s} value={s}>
                            {dutyWorkflowLabel(s)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="min-w-0 flex-[2] space-y-1">
                      <Label className="text-xs text-zinc-500">Customer-visible note (optional)</Label>
                      <Textarea
                        name="customerVisibleNote"
                        rows={2}
                        defaultValue={selected.duty.customerVisibleNote ?? ""}
                        placeholder="Shown to the buyer on their order page when you save workflow."
                        className="resize-none border-white/15 bg-black/40 text-sm"
                      />
                    </div>
                    <Button type="submit" disabled={pending}>
                      Save stage
                    </Button>
                  </form>
                </section>

                <section className="space-y-3">
                  <h3 className="text-sm font-semibold text-white">Notes</h3>
                  <form
                    className="space-y-3"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const fd = new FormData(e.currentTarget);
                      run(async () => updateDutyNotesAction(null, fd), "Notes saved");
                    }}
                  >
                    <input type="hidden" name="dutyId" value={selected.duty.id} />
                    <div className="space-y-1">
                      <Label className="text-xs text-zinc-500">Customer-visible</Label>
                      <Textarea
                        name="customerVisibleNote"
                        rows={3}
                        defaultValue={selected.duty.customerVisibleNote ?? ""}
                        className="border-white/15 bg-black/40 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-zinc-500">Internal (admin only)</Label>
                      <Textarea
                        name="internalNote"
                        rows={2}
                        defaultValue={selected.duty.internalNote ?? ""}
                        className="border-white/15 bg-black/40 text-sm"
                      />
                    </div>
                    <Button type="submit" variant="secondary" disabled={pending}>
                      Save notes
                    </Button>
                  </form>
                </section>

                <section className="space-y-3">
                  <h3 className="text-sm font-semibold text-white">Recorded payable duty (GHS)</h3>
                  <p className="text-xs text-zinc-500">
                    Operations-only figure for settlement (e.g. from your clearance paperwork or finance handoff). This
                    is not an ICUMS certificate and does not replace official customs assessment.
                  </p>
                  <form
                    className="flex flex-wrap items-end gap-3"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const fd = new FormData(e.currentTarget);
                      run(async () => setAssessedDutyGhsAction(null, fd), "Recorded duty saved");
                    }}
                  >
                    <input type="hidden" name="dutyId" value={selected.duty.id} />
                    <div className="space-y-1">
                      <Label className="text-xs text-zinc-500">Payable duty (GHS)</Label>
                      <Input
                        name="assessedDutyGhs"
                        type="number"
                        step="0.01"
                        min={0}
                        defaultValue={selected.duty.assessedDutyGhs ?? ""}
                        className="w-48 border-white/15 bg-black/40"
                      />
                    </div>
                    <Button type="submit" disabled={pending}>
                      Save payable figure
                    </Button>
                  </form>
                </section>

                <section className="space-y-3">
                  <h3 className="text-sm font-semibold text-white">Persist calculator estimate to this order</h3>
                  <p className="text-xs text-zinc-500">
                    Use the same inputs as the calculator panel (right). Saving stores the breakdown JSON and sets the workflow to estimate-generated when appropriate.
                  </p>
                  <SaveEstimateInline
                    key={selected.duty.id}
                    dutyId={selected.duty.id}
                    carYear={selected.carYear}
                    carEngineType={selected.carEngineType}
                    disabled={pending}
                    onRun={run}
                  />
                </section>

                <section className="space-y-3">
                  <h3 className="text-sm font-semibold text-white">Duty payment request</h3>
                  <p className="text-xs text-zinc-500">
                    Creates a manual payment row (customer uploads proof). When finance marks it successful, the duty workflow moves to{" "}
                    <span className="text-zinc-400">Duty paid</span> automatically.
                  </p>
                  {selected.dutyPayments.length > 0 ? (
                    <ul className="text-xs text-zinc-500">
                      {selected.dutyPayments.map((p) => (
                        <li key={p.id}>
                          <Link href={`/admin/payments/${p.id}`} className="text-[var(--brand)] hover:underline">
                            {p.status}
                          </Link>{" "}
                          · {formatMoney(p.amount, p.currency)}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  <form
                    className="flex flex-wrap items-end gap-3"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const fd = new FormData(e.currentTarget);
                      run(async () => createDutyPaymentRequestAction(null, fd), "Duty payment created");
                    }}
                  >
                    <input type="hidden" name="orderId" value={selected.id} />
                    <div className="space-y-1">
                      <Label className="text-xs text-zinc-500">Amount (GHS)</Label>
                      <Input
                        name="amountGhs"
                        type="number"
                        step="0.01"
                        min={0}
                        required
                        defaultValue={selected.duty.assessedDutyGhs ?? selected.duty.estimateTotalGhs ?? ""}
                        className="w-44 border-white/15 bg-black/40"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-zinc-500">Settlement</Label>
                      <select name="settlementMethod" className="h-10 rounded-lg border border-white/15 bg-black/40 px-3 text-sm text-white">
                        <option value="BANK_GHS_COMPANY">Bank (GHS)</option>
                        <option value="MOBILE_MONEY">Mobile money</option>
                        <option value="CASH_OFFICE_GHS">Cash office (GHS)</option>
                        <option value="CASH_OFFICE_USD">Cash office (USD)</option>
                        <option value="ALIPAY_RMB">Alipay (RMB)</option>
                      </select>
                    </div>
                    <Button type="submit" disabled={pending}>
                      Create duty payment
                    </Button>
                  </form>
                </section>
              </>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="space-y-5">
        <DutyCalculatorPanel
          defaultYear={selected?.carYear ?? undefined}
          defaultCifGhs={selected?.orderAmountGhs}
          defaultPowertrain={selected?.carEngineType ?? undefined}
          compact
        />
        <DutyOfficialLinks compact />
      </div>
    </div>
  );
}

function SaveEstimateInline({
  dutyId,
  carYear,
  carEngineType,
  disabled,
  onRun,
}: {
  dutyId: string;
  carYear: number | null;
  carEngineType: EngineType | null;
  disabled: boolean;
  onRun: (fn: () => Promise<{ ok?: boolean; error?: string }>, msg: string) => void;
}) {
  const [cif, setCif] = useState("");
  const [year, setYear] = useState(carYear != null ? String(carYear) : String(new Date().getFullYear() - 3));
  const [cc, setCc] = useState("");
  const [powertrain, setPowertrain] = useState<string>(carEngineType ?? "GASOLINE");
  const [evWaiver, setEvWaiver] = useState(false);

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        const parsed = dutyEstimateInputSchema.safeParse({
          cifGhs: Number(cif),
          vehicleYear: Number(year),
          engineCc: cc.trim() ? Number(cc) : undefined,
          powertrain,
          applyEvDutyWaiver: evWaiver,
        });
        if (!parsed.success) {
          toast.error("Invalid CIF / year / powertrain for estimate.");
          return;
        }
        computeDutyEstimate(parsed.data);
        const fd = new FormData();
        fd.set("dutyId", dutyId);
        fd.set("cifGhs", String(parsed.data.cifGhs));
        fd.set("vehicleYear", String(parsed.data.vehicleYear));
        fd.set("powertrain", parsed.data.powertrain);
        if (parsed.data.applyEvDutyWaiver) fd.set("applyEvDutyWaiver", "true");
        if (parsed.data.engineCc != null) fd.set("engineCc", String(parsed.data.engineCc));
        onRun(async () => saveDutyEstimateAction(null, fd), "Estimate saved to order");
      }}
    >
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label className="text-xs text-zinc-500">CIF (GHS)</Label>
          <Input value={cif} onChange={(e) => setCif(e.target.value)} className="w-40 border-white/15 bg-black/40" required />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-zinc-500">Year</Label>
          <Input value={year} onChange={(e) => setYear(e.target.value)} className="w-28 border-white/15 bg-black/40" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-zinc-500">Powertrain</Label>
          <select
            value={powertrain}
            onChange={(e) => {
              const v = e.target.value;
              setPowertrain(v);
              if (v !== "ELECTRIC") setEvWaiver(false);
            }}
            className="h-10 rounded-lg border border-white/15 bg-black/40 px-2 text-sm text-white"
          >
            <option value="GASOLINE">ICE</option>
            <option value="HYBRID">Hybrid</option>
            <option value="PLUGIN_HYBRID">PHEV</option>
            <option value="ELECTRIC">BEV</option>
          </select>
        </div>
        {powertrain !== "ELECTRIC" ? (
          <div className="space-y-1">
            <Label className="text-xs text-zinc-500">Cc</Label>
            <Input value={cc} onChange={(e) => setCc(e.target.value)} className="w-24 border-white/15 bg-black/40" />
          </div>
        ) : null}
        {powertrain === "ELECTRIC" ? (
          <label className="flex max-w-xs items-center gap-2 text-[11px] text-zinc-400">
            <input type="checkbox" checked={evWaiver} onChange={(e) => setEvWaiver(e.target.checked)} className="rounded border-white/20" />
            Model EV duty relief
          </label>
        ) : null}
        <Button type="submit" disabled={disabled}>
          Save estimate to order
        </Button>
      </div>
    </form>
  );
}
