import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { PageHeading } from "@/components/typography/page-headings";
import { OrderDutySection } from "@/components/duty/order-duty-section";
import { ShipmentFlowByKind } from "@/components/shipping/shipment-flow-by-kind";
import { PaymentStatusBadge } from "@/components/payments/payment-status-badge";
import { DeferredChinaFreightPanel } from "@/components/parts/deferred-china-freight-panel";
import { requireSessionOrRedirect } from "@/lib/auth-helpers";
import { formatMoney } from "@/lib/format";
import { getDeferredChinaContextForUser } from "@/lib/parts-china-pending-shipping";
import { SHIPMENT_KIND_LABEL, SHIPMENT_STAGE_LABEL } from "@/lib/shipping/constants";
import { ghanaPartsCustomerStageLabel } from "@/lib/shipping/ghana-parts-flow";
import { getShipmentsForOrderDetail } from "@/lib/shipping/shipment-service";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ orderId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { orderId } = await params;
  return { title: `Order ${orderId.slice(0, 8)}…` };
}

export default async function DashboardOrderDetailPage({ params }: Props) {
  const { orderId } = await params;
  const session = await requireSessionOrRedirect(`/dashboard/orders/${orderId}`);
  const userId = session.user.id;

  const order = await prisma.order.findFirst({
    where: { id: orderId, userId },
    include: {
      car: true,
      partItems: true,
      payments: {
        orderBy: { createdAt: "desc" },
        include: { proofs: true },
      },
    },
  });

  if (!order) notFound();

  const [shipments, pendingChinaPre, walletGhs] = await Promise.all([
    getShipmentsForOrderDetail(orderId, userId),
    order.kind === "PARTS" ? getDeferredChinaContextForUser(orderId, userId) : Promise.resolve(null),
    prisma.user
      .findUnique({ where: { id: userId }, select: { walletBalance: true } })
      .then((u) => Number(u?.walletBalance ?? 0)),
  ]);
  const generatedReceipts = await prisma.generatedReceipt.findMany({
    where: { orderId, userId },
    orderBy: { issuedAt: "desc" },
    take: 20,
  });

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
      <Link href="/dashboard/orders" className="text-xs text-[var(--brand)] hover:underline">
        ← Orders
      </Link>
      <PageHeading variant="dashboard" className="mt-2">
        Order
      </PageHeading>
      <p className="mt-1 font-mono text-xs text-zinc-500">{order.reference}</p>

      <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <h2 className="text-sm font-semibold text-white">Summary</h2>
        <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-zinc-500">{order.kind === "PARTS" ? "Items" : "Vehicle"}</dt>
            <dd className="text-zinc-200">
              {order.kind === "PARTS" ? (
                `${order.partItems.length} part item${order.partItems.length === 1 ? "" : "s"}`
              ) : order.car ? (
                <Link className="text-[var(--brand)] hover:underline" href={`/cars/${order.car.slug}`}>
                  {order.car.title}
                </Link>
              ) : (
                "—"
              )}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500">Order status</dt>
            <dd className="text-zinc-200">{order.orderStatus.replaceAll("_", " ")}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Amount</dt>
            <dd className="text-[var(--brand)]">{formatMoney(Number(order.amount), order.currency)}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Placed</dt>
            <dd className="text-zinc-200">{order.createdAt.toLocaleString()}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Last updated</dt>
            <dd className="text-zinc-200">{order.updatedAt.toLocaleString()}</dd>
          </div>
        </dl>
      </div>

      {order.kind === "CAR" ? <OrderDutySection orderId={order.id} orderKind={order.kind} /> : null}

      {order.kind === "PARTS" && pendingChinaPre ? (
        <div className="mt-8">
          <h2 className="text-sm font-semibold text-white">Shipping &amp; delivery (China pre-order)</h2>
          <p className="mt-1 text-xs text-zinc-500">Pay the international leg separately. Amounts use active delivery template GHS for your lines.</p>
          <div className="mt-3">
            <Suspense
              fallback={
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-zinc-500">
                  Loading…
                </div>
              }
            >
              <DeferredChinaFreightPanel orderId={order.id} walletBalanceGhs={walletGhs} />
            </Suspense>
          </div>
        </div>
      ) : null}

      {order.deliveryAddressSnapshot && order.kind === "PARTS" ? (
        <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h2 className="text-sm font-semibold text-white">Delivery details</h2>
          {(() => {
            const a = order.deliveryAddressSnapshot as Record<string, string | undefined>;
            const dispatch = a.dispatchPhone?.trim() || a.phone;
            return (
              <div className="mt-3 space-y-2 text-sm text-zinc-400">
                <p>
                  <span className="text-zinc-500">Address: </span>
                  {[a.fullName, a.streetAddress, a.city, a.region, a.digitalAddress].filter(Boolean).join(" · ")}
                </p>
                <p>
                  <span className="text-zinc-500">Profile phone: </span>
                  {a.phone ?? "—"}
                </p>
                <p>
                  <span className="text-zinc-500">Dispatch phone (call on arrival): </span>
                  <span className="font-medium text-zinc-200">{dispatch ?? "—"}</span>
                </p>
                {a.deliveryInstructions ? (
                  <p>
                    <span className="text-zinc-500">Your notes: </span>
                    {a.deliveryInstructions}
                  </p>
                ) : null}
              </div>
            );
          })()}
        </div>
      ) : null}

      {shipments.length > 0 ? (
        <div className="mt-10 space-y-6">
          <h2 className="text-lg font-semibold text-white">Shipping &amp; tracking</h2>
          {shipments.map((s) => (
            <div key={s.id} className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.04] to-transparent p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--brand)]">
                    {SHIPMENT_KIND_LABEL[s.kind] ?? s.kind}
                  </p>
                  {s.deliveryMode ? (
                    <p className="mt-1 text-xs text-zinc-500">Method: {s.deliveryMode.replaceAll("_", " ")}</p>
                  ) : null}
                </div>
                <p className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-[10px] font-semibold tracking-wide text-zinc-300">
                  {s.kind === "PARTS_GHANA"
                    ? ghanaPartsCustomerStageLabel(s.currentStage)
                    : SHIPMENT_STAGE_LABEL[s.currentStage]}
                </p>
              </div>
              <div className="mt-4">
                <ShipmentFlowByKind kind={s.kind} currentStage={s.currentStage} />
              </div>
              <dl className="mt-4 grid gap-2 text-xs text-zinc-400 sm:grid-cols-2">
                {s.feeAmount != null && Number(s.feeAmount) > 0 ? (
                  <div>
                    <dt className="text-zinc-500">Shipping fee</dt>
                    <dd className="text-zinc-200">{formatMoney(Number(s.feeAmount), s.feeCurrency)}</dd>
                  </div>
                ) : null}
                {s.estimatedDuration ? (
                  <div>
                    <dt className="text-zinc-500">ETA</dt>
                    <dd className="text-zinc-200">{s.estimatedDuration}</dd>
                  </div>
                ) : null}
                {s.trackingNumber ? (
                  <div>
                    <dt className="text-zinc-500">Tracking</dt>
                    <dd className="font-mono text-zinc-200">{s.trackingNumber}</dd>
                  </div>
                ) : null}
                {s.carrier ? (
                  <div>
                    <dt className="text-zinc-500">Carrier</dt>
                    <dd className="text-zinc-200">{s.carrier}</dd>
                  </div>
                ) : null}
              </dl>
              {s.events.length > 0 ? (
                <ul className="mt-4 space-y-2 border-t border-white/5 pt-4 text-sm text-zinc-400">
                  {s.events.map((ev) => (
                    <li key={ev.id} className="rounded-lg border border-white/5 bg-black/20 px-3 py-2">
                      <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between">
                        <span className="font-medium text-zinc-200">{ev.title}</span>
                        <span className="text-xs text-zinc-500">{new Date(ev.createdAt).toLocaleString()}</span>
                      </div>
                      {ev.description ? <p className="mt-1 text-xs text-zinc-500">{ev.description}</p> : null}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-10 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
          <h2 className="text-lg font-semibold text-white">Shipping &amp; tracking</h2>
          <p className="mt-2 text-sm text-zinc-500">
            {order.orderStatus === "CANCELLED"
              ? "This order was cancelled — no active shipment tracking."
              : order.orderStatus === "DRAFT" || order.orderStatus === "PENDING_PAYMENT"
                ? "Shipment tracking appears after checkout is completed and logistics are set up."
                : "No shipment record is linked to this order yet. If you already paid, contact support — operations can attach logistics to your order."}
          </p>
        </div>
      )}

      {order.kind === "PARTS" ? (
        <div className="mt-10 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h2 className="text-lg font-semibold text-white">Part items</h2>
          <ul className="mt-4 space-y-2 text-sm text-zinc-300">
            {order.partItems.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-2 rounded-lg border border-white/10 p-3">
                <span>{item.titleSnapshot} × {item.quantity}</span>
                <span className="text-[var(--brand)]">{formatMoney(Number(item.lineTotal), item.currency)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {receipt || generatedReceipts.length > 0 ? (
        <div className="mt-10 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h2 className="text-lg font-semibold text-white">Digital receipt</h2>
          <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-zinc-300">
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
                  {receipt?.companyEmail ?? "support@sparkanddriveautos.com"} · {receipt?.companyPhone ?? "+233 54 000 0000"} ·{" "}
                  {receipt?.storeLocation ?? "Accra, Ghana"}
                </p>
              </div>
            </div>
            <p className="mt-3 text-xs text-zinc-500">
              Order: {order.reference} · Receipt: {order.receiptReference ?? "Pending"}
            </p>
            {Array.isArray(receipt?.items) && receipt.items.length > 0 ? (
              <ul className="mt-3 space-y-1 text-xs text-zinc-300">
                {receipt.items.map((item, idx) => (
                  <li key={`${item.title ?? "item"}-${idx}`}>
                    {item.title ?? "Item"} × {item.quantity ?? 1} · {formatMoney(Number(item.total ?? 0), "GHS")}
                  </li>
                ))}
              </ul>
            ) : null}
            <p className="mt-3 text-zinc-300">{receipt?.thankYouNote ?? receipt?.thankYou ?? "Thank you for shopping with us."}</p>
          </div>
          <div className="mt-3 flex flex-col gap-3 text-xs">
            <p className="text-zinc-500">Receipt remains attached to this order and can be reviewed any time.</p>
            {order.receiptPdfUrl || generatedReceipts.length > 0 ? (
              <div className="flex flex-wrap items-center gap-3">
                <Link
                  href={`/dashboard/orders/${orderId}/receipt`}
                  className="font-medium text-[var(--brand)] hover:underline"
                >
                  View PDF receipt
                </Link>
                <a
                  href={`/api/orders/${orderId}/receipt/download`}
                  className="rounded-md border border-white/15 px-2.5 py-1 text-zinc-200 hover:bg-white/10"
                >
                  Download receipt
                </a>
              </div>
            ) : null}
            {generatedReceipts.length > 1 ? (
              <ul className="space-y-2 border-t border-white/10 pt-3 text-zinc-400">
                {generatedReceipts.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center gap-2 sm:gap-3">
                    <span className="font-mono text-[10px] text-zinc-500">{r.receiptNumber}</span>
                    <Link className="text-[var(--brand)] hover:underline" href={`/dashboard/receipts/${r.id}/view`}>
                      View
                    </Link>
                    <a className="text-zinc-300 hover:underline" href={`/api/receipts/${r.id}/download`}>
                      Download
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="mt-10">
        <h2 className="text-lg font-semibold text-white">Payments</h2>
        <div className="mt-4 space-y-3">
          {order.payments.length === 0 ? (
            <p className="text-sm text-zinc-500">No payments linked yet.</p>
          ) : (
            order.payments.map((p) => (
              <Link
                key={p.id}
                href={`/dashboard/payments/${p.id}`}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition hover:bg-white/[0.06]"
              >
                <div>
                  <p className="font-mono text-xs text-zinc-500">{p.providerReference ?? p.id.slice(0, 12)}</p>
                  <p className="text-sm text-zinc-300">{p.paymentType.replaceAll("_", " ")}</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <PaymentStatusBadge status={p.status} />
                  <span className="text-sm text-[var(--brand)]">{formatMoney(Number(p.amount), p.currency)}</span>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>

      <Link
        href="/dashboard/shipping"
        className="mt-8 inline-block text-sm text-[var(--brand)] hover:underline"
      >
        Shipping updates →
      </Link>
    </div>
  );
}
