import Link from "next/link";

/**
 * Shared explanation for customer-facing duty estimate surfaces (dashboard).
 */
export function DutyEstimatesIntro() {
  return (
    <div className="rounded-2xl border border-[var(--brand)]/20 bg-gradient-to-br from-[var(--brand)]/[0.08] to-black/40 p-5 text-sm leading-relaxed text-zinc-300">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--brand)]">How this works</p>
      <ul className="mt-3 list-inside list-disc space-y-2 marker:text-[var(--brand)]">
        <li>
          <span className="font-medium text-zinc-200">Duty estimates</span> are planning documents our team prepares for{" "}
          <span className="text-zinc-200">each vehicle</span> — indicative Ghana import duty ranges and landed cost, with a
          clear disclaimer that{" "}
          <span className="text-zinc-200">final charges are set by Ghana Customs / ICUMS</span> at clearance.
        </li>
        <li>
          When your vehicle is on its way and our team is ready to request{" "}
          <span className="font-medium text-zinc-200">clearance duty payment</span>, that step appears on the{" "}
          <Link href="/dashboard/orders" className="font-medium text-[var(--brand)] underline-offset-2 hover:underline">
            matching order
          </Link>{" "}
          for that car — keep an eye on order updates and notifications there as well.
        </li>
      </ul>
    </div>
  );
}
