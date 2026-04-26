import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeading } from "@/components/typography/page-headings";
import { ShipmentFlowByKind } from "@/components/shipping/shipment-flow-by-kind";
import { PaymentStatusBadge } from "@/components/payments/payment-status-badge";
import { orderPartsLineageLabel } from "@/lib/admin-orders-parts-filter";
import { formatMoney } from "@/lib/format";
import { SHIPMENT_KIND_LABEL, SHIPMENT_STAGE_LABEL } from "@/lib/shipping/constants";
import { ghanaPartsCustomerStageLabel } from "@/lib/shipping/ghana-parts-flow";
import { getShipmentsForAdminOrderDetail } from "@/lib/shipping/shipment-service";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ orderId: string }> };

export default async function AdminOrderDetailPage({ params }: Props) {
  const { orderId } = await params;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      user: { select: { email: true, name: true } },
      car: true,
      partItems: { include: { part: { select: { stockStatus: true, origin: true } } } },
      payments: { orderBy: { createdAt: "desc" }, include: { proofs: true } },
    },
  });

  if (!order) notFound();

  const shipments = await getShipmentsForAdminOrderDetail(orderId);

  const receipt = (order.receiptData ?? null) as
    | {
        companyPhone?: string;
        companyEmail?: string;
        storeLocation?: string;
        thankYou?: string;
        thankYouNote?: string;
        items?: Array<{ title?: string; quantity?: number; total?: number }>;
      }
    | null;

  return (
    <div>
      <Link href="/admin/orders" className="text-xs text-[var(--brand)] hover:underline">
        ← All Orders
      </Link>
      <PageHeading variant="dashboard" className="mt-4">
        Order {order.reference}
      </PageHeading>
      <p className="mt-1 text-sm text-zinc-400">
        {order.user?.email ?? "No user"} · {order.orderStatus.replaceAll("_", " ")}
      </p>
      <p className="mt-2 text-xs text-zinc-500">
        Placed: {order.createdAt.toLocaleString()} · Updated: {order.updatedAt.toLocaleString()}
        {order.kind === "PARTS" ? (
          <> · <span className="text-zinc-400">Mix: {orderPartsLineageLabel(order)}</span></>
        ) : null}
      </p>
      <div className="mt-3">
        <Link
          href={`/admin/duty-estimator?orderId=${encodeURIComponent(order.id)}&customerId=${encodeURIComponent(order.userId ?? "")}&clientName=${encodeURIComponent(order.user?.name ?? order.user?.email ?? "")}&clientContact=${encodeURIComponent(order.user?.email ?? "")}&vehicleName=${encodeURIComponent(order.car?.title ?? "Duty estimate")}`}
          className="inline-flex items-center rounded-lg border border-[var(--brand)]/40 bg-[var(--brand)]/10 px-3 py-1.5 text-xs font-semibold text-[var(--brand)] hover:bg-[var(--brand)]/20"
        >
          Generate duty estimate
        </Link>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h2 className="text-sm font-semibold text-white">{order.kind === "PARTS" ? "Items" : "Vehicle"}</h2>
          {order.kind === "PARTS" ? (
            <p className="mt-2 text-sm text-zinc-300">{order.partItems.length} part item{order.partItems.length === 1 ? "" : "s"}</p>
          ) : order.car ? (
            <Link className="mt-2 inline-block text-[var(--brand)] hover:underline" href={`/cars/${order.car.slug}`}>
              {order.car.title}
            </Link>
          ) : (
            <p className="mt-2 text-sm text-zinc-500">—</p>
          )}
          <p className="mt-4 text-sm text-zinc-400">
            Amount: <span className="text-[var(--brand)]">{formatMoney(Number(order.amount), order.currency)}</span>
          </p>
        </div>
      </div>

      {order.kind === "PARTS" ? (
        <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h2 className="text-sm font-semibold text-white">Part line items</h2>
          <ul className="mt-4 space-y-2 text-sm text-zinc-300">
            {order.partItems.map((i) => (
              <li key={i.id} className="flex items-center justify-between rounded-lg border border-white/10 p-3">
                <span>{i.titleSnapshot} × {i.quantity}</span>
                <span className="text-[var(--brand)]">{formatMoney(Number(i.lineTotal), i.currency)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h2 className="text-sm font-semibold text-white">Shipping &amp; logistics</h2>
          <div className="flex flex-wrap gap-3">
            <Link href="/admin/shipping" className="text-xs text-[var(--brand)] hover:underline">
              Shipping operations hub →
            </Link>
            {order.kind === "CAR" ? (
              <Link href="/admin/duty" className="text-xs text-[var(--brand)] hover:underline">
                Duty operations →
              </Link>
            ) : null}
          </div>
        </div>
        {order.kind === "PARTS" && order.deliveryAddressSnapshot ? (
          <div className="mt-4 space-y-2 rounded-xl border border-white/10 bg-black/20 p-4 text-xs text-zinc-300">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Customer delivery (checkout)</p>
            {(() => {
              const a = order.deliveryAddressSnapshot as Record<string, string | undefined>;
              const dispatch = a.dispatchPhone?.trim() || a.phone;
              return (
                <>
                  <p>
                    <span className="text-zinc-500">Name &amp; address: </span>
                    {[a.fullName, a.streetAddress, a.city, a.region, a.digitalAddress].filter(Boolean).join(" · ")}
                  </p>
                  <p>
                    <span className="text-zinc-500">Address phone: </span>
                    {a.phone ?? "—"}
                  </p>
                  <p>
                    <span className="text-zinc-500">Dispatch / call on arrival: </span>
                    <span className="font-medium text-emerald-200/90">{dispatch ?? "—"}</span>
                  </p>
                  {a.deliveryInstructions ? (
                    <p>
                      <span className="text-zinc-500">Notes: </span>
                      {a.deliveryInstructions}
                    </p>
                  ) : null}
                </>
              );
            })()}
          </div>
        ) : null}
        {shipments.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-500">
            No shipment rows for this order yet. Vehicle orders may gain a sea-freight record after successful payment or
            when operations backfills legacy data. Use the hub to post milestones once a shipment exists.
          </p>
        ) : (
          <div className="mt-6 space-y-6">
            {shipments.map((s) => (
              <div
                key={s.id}
                className="rounded-xl border border-white/10 bg-gradient-to-br from-white/[0.04] to-transparent p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--brand)]">
                      {SHIPMENT_KIND_LABEL[s.kind] ?? s.kind}
                    </p>
                    {s.deliveryMode ? (
                      <p className="mt-0.5 text-xs text-zinc-500">Method: {s.deliveryMode.replaceAll("_", " ")}</p>
                    ) : null}
                    <p className="mt-1 font-mono text-[10px] text-zinc-600">Shipment id: {s.id}</p>
                  </div>
                  <span className="rounded-full border border-white/10 bg-black/30 px-2.5 py-1 text-[10px] font-semibold tracking-wide text-zinc-300">
                    {s.kind === "PARTS_GHANA"
                      ? ghanaPartsCustomerStageLabel(s.currentStage)
                      : SHIPMENT_STAGE_LABEL[s.currentStage]}
                  </span>
                </div>
                <div className="mt-4">
                  <ShipmentFlowByKind kind={s.kind} currentStage={s.currentStage} />
                </div>
                <dl className="mt-4 grid gap-2 text-xs text-zinc-400 sm:grid-cols-2">
                  {s.feeAmount != null && Number(s.feeAmount) > 0 ? (
                    <div>
                      <dt className="text-zinc-600">Fee</dt>
                      <dd className="text-zinc-200">{formatMoney(Number(s.feeAmount), s.feeCurrency)}</dd>
                    </div>
                  ) : null}
                  {s.estimatedDuration ? (
                    <div>
                      <dt className="text-zinc-600">ETA</dt>
                      <dd className="text-zinc-200">{s.estimatedDuration}</dd>
                    </div>
                  ) : null}
                  {s.trackingNumber ? (
                    <div>
                      <dt className="text-zinc-600">Tracking</dt>
                      <dd className="font-mono text-zinc-200">{s.trackingNumber}</dd>
                    </div>
                  ) : null}
                  {s.carrier ? (
                    <div>
                      <dt className="text-zinc-600">Carrier</dt>
                      <dd className="text-zinc-200">{s.carrier}</dd>
                    </div>
                  ) : null}
                </dl>
                {s.events.length > 0 ? (
                  <ul className="mt-4 space-y-2 border-t border-white/5 pt-3 text-xs text-zinc-400">
                    {s.events.map((ev) => (
                      <li key={ev.id} className="rounded-lg border border-white/5 bg-black/25 px-3 py-2">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <span className="font-medium text-zinc-200">{ev.title}</span>
                          <span className="text-zinc-600">{new Date(ev.createdAt).toLocaleString()}</span>
                        </div>
                        {ev.description ? <p className="mt-1 text-zinc-500">{ev.description}</p> : null}
                        <p className="mt-1 text-[10px] text-zinc-600">
                          Stage:{" "}
                          {s.kind === "PARTS_GHANA" ? ghanaPartsCustomerStageLabel(ev.stage) : SHIPMENT_STAGE_LABEL[ev.stage]}
                          {!ev.visibleToCustomer ? (
                            <span className="text-amber-400/90"> · not visible to customer</span>
                          ) : null}
                        </p>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>

      {receipt ? (
        <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h2 className="text-sm font-semibold text-white">Digital receipt</h2>
          <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-zinc-300">
            <div className="flex items-center gap-3">
              <div className="relative h-10 w-10 overflow-hidden rounded-full border border-white/20">
                <Image
                  src={order.kind === "PARTS" ? "/brand/gear-storefront-theme.png" : "/brand/logo-emblem.png"}
                  alt=""
                  fill
                  className="object-cover p-1"
                />
              </div>
              <div>
                <p className="font-semibold text-white">
                  {order.kind === "PARTS" ? "Spark & Drive Gear Auto Parts" : "Spark and Drive Autos"}
                </p>
                <p className="text-xs text-zinc-500">
                  {receipt.companyEmail ?? "support@sparkanddriveautos.com"} · {receipt.companyPhone ?? "+233 54 000 0000"} ·{" "}
                  {receipt.storeLocation ?? "Accra, Ghana"}
                </p>
              </div>
            </div>
            <p className="mt-3 text-xs text-zinc-500">
              Order: {order.reference} · Receipt: {order.receiptReference ?? "Pending"}
            </p>
            {Array.isArray(receipt.items) && receipt.items.length > 0 ? (
              <ul className="mt-3 space-y-1 text-xs text-zinc-300">
                {receipt.items.map((item, idx) => (
                  <li key={`${item.title ?? "item"}-${idx}`}>
                    {item.title ?? "Item"} × {item.quantity ?? 1} · {formatMoney(Number(item.total ?? 0), "GHS")}
                  </li>
                ))}
              </ul>
            ) : null}
            <p className="mt-3">{receipt.thankYouNote ?? receipt.thankYou ?? "Thank you for shopping with us."}</p>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
            <p className="text-zinc-500">Receipt is stored on this order for customer and admin retrieval.</p>
            {order.receiptPdfUrl ? (
              <>
                <a href={order.receiptPdfUrl} target="_blank" rel="noreferrer" className="text-[var(--brand)] hover:underline">
                  View PDF receipt
                </a>
                <a
                  href={order.receiptPdfUrl}
                  download={`${order.receiptReference ?? order.reference}.pdf`}
                  className="rounded-md border border-white/15 px-2.5 py-1 text-zinc-200 hover:bg-white/10"
                >
                  Download receipt
                </a>
              </>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="mt-10">
        <h2 className="text-lg font-semibold text-white">Payments</h2>
        <div className="mt-4 space-y-2">
          {order.payments.map((p) => (
            <Link
              key={p.id}
              href={`/admin/payments/${p.id}`}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4 hover:bg-white/[0.06]"
            >
              <div>
                <p className="font-mono text-xs text-zinc-500">{p.providerReference ?? p.id}</p>
                <p className="text-xs text-zinc-400">{p.proofs.length} proof(s)</p>
              </div>
              <div className="flex items-center gap-3">
                <PaymentStatusBadge status={p.status} />
                <span className="text-sm text-zinc-300">{formatMoney(Number(p.amount), p.currency)}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
