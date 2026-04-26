import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeading } from "@/components/typography/page-headings";

import { CarRequestNotifyForm } from "./car-request-notify-form";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function AdminOrderInquiryDetailPage(props: Props) {
  const { id } = await props.params;
  const r = await prisma.carRequest.findUnique({
    where: { id },
    include: { user: { select: { id: true, email: true, name: true } } },
  });
  if (!r) notFound();

  const budgetMin = r.budgetMin != null ? Number(r.budgetMin) : null;
  const budgetMax = r.budgetMax != null ? Number(r.budgetMax) : null;

  return (
    <div>
      <p className="text-sm text-zinc-500">
        <Link href="/admin/comms?view=sourcing" className="text-[var(--brand)] hover:underline">
          ← Live Support Chat (order inquiries)
        </Link>
      </p>
      <PageHeading variant="dashboard" className="mt-4">
        Order inquiry summary
      </PageHeading>
      <div className="mt-3">
        <Link
          href={`/admin/duty-estimator?inquiryId=${encodeURIComponent(r.id)}&customerId=${encodeURIComponent(r.userId ?? "")}&clientName=${encodeURIComponent(r.user?.name ?? r.guestName)}&clientContact=${encodeURIComponent(r.user?.email ?? r.guestEmail ?? r.guestPhone)}&vehicleName=${encodeURIComponent(`${r.brand} ${r.model}${r.trim ? ` ${r.trim}` : ""}`)}`}
          className="inline-flex items-center rounded-lg border border-[var(--brand)]/40 bg-[var(--brand)]/10 px-3 py-1.5 text-xs font-semibold text-[var(--brand)] hover:bg-[var(--brand)]/20"
        >
          Generate duty estimate
        </Link>
      </div>
      <p className="mt-2 font-mono text-xs text-zinc-500">{r.id}</p>

      <dl className="mt-8 grid gap-6 rounded-2xl border border-white/10 bg-white/[0.03] p-6 sm:grid-cols-2">
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">Vehicle</dt>
          <dd className="mt-1 text-white">
            {r.brand} {r.model}
            {r.trim ? ` · ${r.trim}` : ""}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">Years</dt>
          <dd className="mt-1 text-zinc-200">
            {r.yearFrom ?? "—"} – {r.yearTo ?? "—"}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">Engine / transmission</dt>
          <dd className="mt-1 text-zinc-200">
            {r.engineType?.replaceAll("_", " ") ?? "—"} · {r.transmission ?? "—"}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">Color</dt>
          <dd className="mt-1 text-zinc-200">{r.colorPreference ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">Budget ({r.currency})</dt>
          <dd className="mt-1 text-zinc-200">
            {budgetMin != null || budgetMax != null ? (
              <>
                {budgetMin ?? "—"} – {budgetMax ?? "—"}
              </>
            ) : (
              "—"
            )}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">Source preference</dt>
          <dd className="mt-1 text-zinc-200">{r.sourcePreference}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">Destination</dt>
          <dd className="mt-1 text-zinc-200">
            {[r.destinationCity, r.destinationCountry].filter(Boolean).join(", ") || "—"}
          </dd>
        </div>
        <div className="sm:col-span-2 border-t border-white/10 pt-6">
          <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">Contact</dt>
          <dd className="mt-1 text-zinc-200">
            {r.guestName} · {r.guestEmail} · {r.guestPhone}
            {r.country ? ` · ${r.country}` : ""}
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">Linked account</dt>
          <dd className="mt-1 text-zinc-200">
            {r.user ? (
              <>
                {r.user.name ?? r.user.email} <span className="text-zinc-500">({r.user.email})</span>
              </>
            ) : (
              <span className="text-amber-200/90">Guest submission — notify by email externally, or customer registers with matching email.</span>
            )}
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">Notes</dt>
          <dd className="mt-1 whitespace-pre-wrap text-zinc-300">{r.notes ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">Status</dt>
          <dd className="mt-1 text-zinc-200">{r.status}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">Submitted</dt>
          <dd className="mt-1 text-zinc-200">{r.createdAt.toLocaleString()}</dd>
        </div>
      </dl>

      <div className="mt-10">
        <CarRequestNotifyForm carRequestId={r.id} />
      </div>
    </div>
  );
}
