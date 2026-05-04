import Link from "next/link";

import { loadPartsDeliveryTemplatesPanelProps } from "@/lib/admin-delivery-templates-panel-data";

import { PartsDeliveryTemplatesPanel } from "./parts-categories-delivery-panel";

type Context = "parts" | "shipping";

export async function AdminPartsDeliveryTemplatesSection({ context = "parts" }: { context?: Context }) {
  const props = await loadPartsDeliveryTemplatesPanelProps();
  return (
    <div className="mt-6 space-y-4">
      {context === "shipping" ? (
        <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/[0.06] px-4 py-3 text-sm text-zinc-300">
          <p className="font-medium text-cyan-100/95">Templates for China stock &amp; pre-order international legs</p>
          <p className="mt-1 text-xs leading-relaxed text-zinc-400">
            These modes power customer air/sea choice at checkout. Wallet charges are <span className="text-zinc-200">parts
            subtotal only</span>; international fees are confirmed later. The same editor lives under Parts Management for
            backward compatibility.
          </p>
        </div>
      ) : (
        <p className="text-sm text-zinc-500">
          Same controls as{" "}
          <Link className="text-[var(--brand)] hover:underline" href="/admin/shipping">
            Shipping &amp; Delivery Tracking
          </Link>
          . Use the shipping hub to track live orders and milestones.
        </p>
      )}
      <PartsDeliveryTemplatesPanel
        modes={props.modes}
        deliveryDefaults={props.deliveryDefaults}
        rowsByMode={props.rowsByMode}
      />
      {context === "parts" ? (
        <p className="text-xs text-zinc-500">
          <Link
            className="font-medium text-[var(--brand)] hover:underline"
            href="/admin/shipping"
            title="Open the shipping and fulfilment hub"
          >
            Open Shipping &amp; Delivery Tracking →
          </Link>
        </p>
      ) : null}
    </div>
  );
}
