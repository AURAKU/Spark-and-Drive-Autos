"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { WalletTopupFlow } from "@/components/parts/wallet-topup-flow";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isChinaPreOrderPart } from "@/lib/part-china-preorder-delivery";
import { formatOptionsLine } from "@/lib/part-variant-options";
import type { PartStockStatus } from "@prisma/client";
import { Heart } from "lucide-react";

type ChinaQuotes = { air: { feeGhs: number; eta: string }; sea: { feeGhs: number; eta: string } };

type Props = {
  chinaQuotes?: ChinaQuotes | null;
  items: Array<{
    id: string;
    selected: boolean;
    quantity: number;
    optColor: string | null;
    optSize: string | null;
    optType: string | null;
    part: {
      id: string;
      slug: string;
      title: string;
      origin: "GHANA" | "CHINA";
      stockStatus: PartStockStatus;
      stockQty: number;
      unitPriceGhs: number;
      coverImageUrl: string | null;
    };
    isFavorite: boolean;
  }>;
  walletBalance: number;
  addresses: Array<{
    id: string;
    fullName: string;
    phone: string;
    city: string;
    region: string;
    streetAddress: string;
    isDefault: boolean;
  }>;
  agreementVersion: string;
  /** True when profile already satisfies checkout + payment-notice policies (matches `/api/parts/cart/checkout` gates). */
  legalCheckoutReady?: boolean;
};

export function PartsCartClient({
  chinaQuotes,
  items,
  walletBalance,
  addresses,
  agreementVersion,
  legalCheckoutReady = false,
}: Props) {
  const [rows, setRows] = useState(items);
  const [addressId, setAddressId] = useState(addresses.find((a) => a.isDefault)?.id ?? addresses[0]?.id ?? "");
  const [dispatchPhone, setDispatchPhone] = useState(
    () => addresses.find((a) => a.isDefault)?.phone ?? addresses[0]?.phone ?? "",
  );
  const [deliveryInstructions, setDeliveryInstructions] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkoutRequestKey, setCheckoutRequestKey] = useState<string | null>(null);
  const [agreementAccepted, setAgreementAccepted] = useState(legalCheckoutReady);
  const [chinaMode, setChinaMode] = useState<"AIR" | "SEA" | null>(chinaQuotes ? "AIR" : null);

  useEffect(() => {
    const a = addresses.find((x) => x.id === addressId);
    if (a?.phone) setDispatchPhone(a.phone);
  }, [addressId, addresses]);

  useEffect(() => {
    if (legalCheckoutReady) setAgreementAccepted(true);
  }, [legalCheckoutReady]);

  const selectedRows = useMemo(() => rows.filter((r) => r.selected), [rows]);
  const selectedStockIssues = useMemo(() => {
    const byPart = new Map<string, number>();
    for (const r of selectedRows) {
      if (isChinaPreOrderPart(r.part)) continue;
      byPart.set(r.part.id, (byPart.get(r.part.id) ?? 0) + r.quantity);
    }
    return selectedRows.filter((r) => {
      if (isChinaPreOrderPart(r.part)) return false;
      if (r.part.stockQty < 1) return true;
      return (byPart.get(r.part.id) ?? 0) > r.part.stockQty;
    });
  }, [selectedRows]);
  const hasChinaSelected = useMemo(
    () => selectedRows.some((r) => r.part.origin === "CHINA"),
    [selectedRows],
  );
  const hasBillableChinaSelected = useMemo(
    () => selectedRows.some((r) => r.part.origin === "CHINA" && !isChinaPreOrderPart(r.part)),
    [selectedRows],
  );
  /** Reference quote only — China in-stock intl is not added to wallet checkout (settled manually after ops confirm). */
  const chinaQuoteReference = useMemo(() => {
    if (!chinaQuotes || !hasBillableChinaSelected || !chinaMode) return null;
    return chinaMode === "AIR" ? chinaQuotes.air : chinaQuotes.sea;
  }, [chinaQuotes, chinaMode, hasBillableChinaSelected]);
  const selectedTotal = useMemo(
    () => selectedRows.reduce((sum, row) => sum + row.part.unitPriceGhs * row.quantity, 0),
    [selectedRows],
  );
  const hasFunds = walletBalance >= selectedTotal;

  async function updateRow(itemId: string, payload: { quantity?: number; selected?: boolean }) {
    const res = await fetch("/api/parts/cart/items", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ itemId, ...payload }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) throw new Error(data.error ?? "Could not update cart.");
  }

  async function removeRow(itemId: string) {
    const res = await fetch(`/api/parts/cart/items?itemId=${encodeURIComponent(itemId)}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Could not remove cart item.");
  }

  async function onToggle(itemId: string, selected: boolean) {
    const prev = rows;
    setRows((r) => r.map((i) => (i.id === itemId ? { ...i, selected } : i)));
    try {
      await updateRow(itemId, { selected });
    } catch {
      setRows(prev);
      toast.error("Could not update selection.");
    }
  }

  async function onQty(itemId: string, quantity: number) {
    const row = rows.find((r) => r.id === itemId);
    if (!row) return;
    let maxQ: number;
    if (isChinaPreOrderPart(row.part)) {
      maxQ = 99;
    } else {
      const otherSelected = rows
        .filter(
          (x) =>
            x.id !== itemId && x.selected && !isChinaPreOrderPart(x.part) && x.part.id === row.part.id,
        )
        .reduce((s, x) => s + x.quantity, 0);
      maxQ = Math.max(0, row.part.stockQty - otherSelected);
    }
    const cap = Math.max(1, maxQ);
    const safeQty = isChinaPreOrderPart(row.part)
      ? Math.min(Math.max(1, quantity), 99)
      : Math.min(Math.max(1, quantity), cap);
    const prev = rows;
    setRows((r) => r.map((i) => (i.id === itemId ? { ...i, quantity: safeQty } : i)));
    try {
      await updateRow(itemId, { quantity: safeQty });
    } catch (e) {
      setRows(prev);
      toast.error(e instanceof Error ? e.message : "Could not update quantity.");
    }
  }

  async function onRemove(itemId: string) {
    const prev = rows;
    setRows((r) => r.filter((i) => i.id !== itemId));
    try {
      await removeRow(itemId);
      toast.success("Item removed.");
    } catch {
      setRows(prev);
      toast.error("Could not remove item.");
    }
  }

  async function onToggleFavorite(itemId: string) {
    const row = rows.find((r) => r.id === itemId);
    if (!row) return;
    const next = !row.isFavorite;
    setRows((prev) => prev.map((r) => (r.id === itemId ? { ...r, isFavorite: next } : r)));
    try {
      const res = await fetch(
        next ? "/api/parts/favorites" : `/api/parts/favorites?partId=${encodeURIComponent(row.part.id)}`,
        {
          method: next ? "POST" : "DELETE",
          headers: next ? { "content-type": "application/json" } : undefined,
          body: next ? JSON.stringify({ partId: row.part.id }) : undefined,
        },
      );
      if (!res.ok) throw new Error("Could not update favorite.");
      toast.success(next ? "Saved to favorites." : "Removed from favorites.");
    } catch {
      setRows((prev) => prev.map((r) => (r.id === itemId ? { ...r, isFavorite: !next } : r)));
      toast.error("Could not update favorite.");
    }
  }

  async function checkout() {
    if (!addressId) {
      toast.error("Select a delivery address.");
      return;
    }
    if (selectedRows.length === 0) {
      toast.error("Select at least one item.");
      return;
    }
    if (!legalCheckoutReady && !agreementAccepted) {
      toast.error("Please accept checkout agreement before payment.");
      return;
    }
    if (dispatchPhone.trim().length < 8) {
      toast.error("Enter a valid dispatch phone number for delivery (8+ characters).");
      return;
    }
    if (selectedStockIssues.length > 0) {
      toast.error(
        "One or more selected items are out of stock or over available quantity. Adjust quantities or deselect those lines.",
      );
      return;
    }
    if (hasBillableChinaSelected && chinaQuotes && !chinaMode) {
      toast.error("Choose Air or Sea for China in-stock items.");
      return;
    }
    setLoading(true);
    const requestKey = checkoutRequestKey ?? crypto.randomUUID();
    if (!checkoutRequestKey) setCheckoutRequestKey(requestKey);
    try {
      const res = await fetch("/api/parts/cart/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          addressId,
          itemIds: selectedRows.map((r) => r.id),
          requestKey,
          agreementAccepted,
          agreementVersion,
          dispatchPhone: dispatchPhone.trim(),
          deliveryInstructions: deliveryInstructions.trim() || undefined,
          ...(hasBillableChinaSelected && chinaMode ? { chinaShippingChoice: chinaMode } : {}),
        }),
      });
      const data = (await res.json()) as { orderId?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Checkout failed.");
      toast.success("Order paid successfully.");
      window.location.href = `/dashboard/orders/${data.orderId ?? ""}`;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Checkout failed.");
      setCheckoutRequestKey(null);
      setLoading(false);
    }
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <p className="text-zinc-400">Your cart is empty.</p>
        <Link href="/parts" className="mt-4 inline-flex text-sm text-[var(--brand)] hover:underline">
          Browse catalog
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {selectedStockIssues.length > 0 ? (
        <div className="rounded-2xl border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-sm leading-relaxed text-amber-50">
          <p className="font-semibold text-amber-100">Cannot complete purchase yet</p>
          <p className="mt-1 text-amber-50/95">
            Some selected in-stock items are unavailable at the shown quantity. China pre-order lines are ordered on
            request; reduce other lines to stock shown or deselect them.
          </p>
        </div>
      ) : null}
      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
      <div className="space-y-3">
        {rows.map((row) => {
          const otherSelectedSamePart = rows
            .filter(
              (x) =>
                x.id !== row.id &&
                x.selected &&
                !isChinaPreOrderPart(x.part) &&
                x.part.id === row.part.id,
            )
            .reduce((s, x) => s + x.quantity, 0);
          const maxInput =
            isChinaPreOrderPart(row.part) ? 99 : Math.max(1, row.part.stockQty - otherSelectedSamePart);
          return (
          <div key={row.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={row.selected}
                  onChange={(e) => void onToggle(row.id, e.target.checked)}
                  aria-label={`Select ${row.part.title}`}
                />
                <div className="relative h-14 w-14 overflow-hidden rounded-lg border border-white/10">
                  <Image
                  src={row.part.coverImageUrl ?? "/brand/logo-emblem.png"}
                  alt=""
                  fill
                  sizes="56px"
                  className="object-cover"
                />
                </div>
                <div>
                  <Link href={`/parts/${row.part.slug}`} className="text-sm font-medium text-white hover:text-[var(--brand)]">
                    {row.part.title}
                  </Link>
                  <p className="mt-1 text-xs text-zinc-500">
                    GHS {row.part.unitPriceGhs.toLocaleString()} each · {row.part.origin}
                    {isChinaPreOrderPart(row.part) ? (
                      <span> · Pre-order (China) — intl delivery paid after checkout</span>
                    ) : (
                      <>
                        {" "}
                        · In stock: <span className="text-zinc-300">{row.part.stockQty}</span>
                      </>
                    )}
                  </p>
                  {(() => {
                    const o = formatOptionsLine({
                      color: row.optColor ?? undefined,
                      size: row.optSize ?? undefined,
                      partType: row.optType ?? undefined,
                    });
                    return o ? <p className="mt-0.5 text-xs text-zinc-400">{o}</p> : null;
                  })()}
                  {selectedStockIssues.some((s) => s.id === row.id) && !isChinaPreOrderPart(row.part) ? (
                    <p className="mt-1 text-xs text-amber-200/90">
                      {row.part.stockQty < 1
                        ? "This SKU is out of stock — remove it or contact support."
                        : `With your other selected lines for this product, total quantity is above in-stock units (${row.part.stockQty}). Lower a line or deselect an item.`}
                    </p>
                  ) : null}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  max={maxInput}
                  value={row.quantity}
                  onChange={(e) => void onQty(row.id, Number(e.target.value) || 1)}
                  className="h-9 w-24"
                  disabled={!isChinaPreOrderPart(row.part) && row.part.stockQty < 1}
                />
                <button
                  type="button"
                  className="inline-flex h-9 items-center rounded-lg border border-white/20 px-3 text-xs text-zinc-300 hover:bg-white/8"
                  onClick={() => void onRemove(row.id)}
                >
                  Remove
                </button>
                <button
                  type="button"
                  onClick={() => void onToggleFavorite(row.id)}
                  aria-label={row.isFavorite ? "Remove from favorites" : "Add to favorites"}
                  className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border transition ${
                    row.isFavorite
                      ? "border-rose-400/70 bg-rose-400/20 text-rose-300"
                      : "border-white/20 bg-white/[0.03] text-zinc-300 hover:bg-white/8"
                  }`}
                >
                  <Heart className={`size-4 ${row.isFavorite ? "fill-current" : ""}`} />
                </button>
                <Link
                  href={`/parts/${row.part.slug}`}
                  className="inline-flex h-9 items-center rounded-lg border border-[var(--brand)]/35 bg-[var(--brand)]/10 px-3 text-xs font-medium text-white transition hover:border-[var(--brand)]/55 hover:bg-[var(--brand)]/20"
                >
                  Product page
                </Link>
              </div>
            </div>
          </div>
          );
        })}
      </div>

      <aside className="h-fit rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <h2 className="text-sm font-semibold text-white">Checkout summary</h2>
        {hasChinaSelected ? (
          <div className="mt-3 rounded-xl border border-cyan-500/25 bg-cyan-500/[0.07] p-3 text-[11px] leading-relaxed text-cyan-50/95">
            Shipping and delivery fees for China stock, available-in-China, or preorder parts are{" "}
            <strong className="font-semibold text-white">not charged at checkout</strong>. Our support team will confirm
            weight/CBM and contact you when the item arrives or is ready for collection. Delivery fees are settled manually
            upon collection or delivery.
          </div>
        ) : null}
        <p className="mt-3 text-sm text-zinc-300">
          Selected items: <span className="text-white">{selectedRows.length}</span>
        </p>
        <p className="mt-1 text-sm text-zinc-300">
          Total due now:{" "}
          <span className="font-semibold text-[var(--brand)]">GHS {selectedTotal.toLocaleString()}</span>
          <span className="ml-2 text-xs text-zinc-500">(parts subtotal only)</span>
        </p>
        {chinaQuoteReference ? (
          <p className="mt-2 text-[11px] leading-relaxed text-zinc-500">
            China warehouse freight reference (~GHS {chinaQuoteReference.feeGhs.toLocaleString()}, {chinaQuoteReference.eta}
            ) — not charged at checkout. Operations will confirm the international fee for separate payment.
          </p>
        ) : null}
        {hasChinaSelected && hasBillableChinaSelected && !chinaQuotes ? (
          <p className="mt-3 text-[11px] leading-relaxed text-amber-200/90">
            China in-stock intl add-on: ensure delivery templates are set in admin. Pre-order (China) lines are billed
            separately after purchase.
          </p>
        ) : null}
        {chinaQuotes && hasBillableChinaSelected ? (
          <div className="mt-4 rounded-xl border border-white/10 bg-black/30 p-3">
            <p className="text-xs font-semibold text-white">China in-stock — delivery mode preference</p>
            <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">
              Choose how we should plan the international leg. Your wallet charge is parts only; freight is quoted for
              reference and invoiced after confirmation. Pre-order (China) lines follow the separate pre-order flow.
            </p>
            <div className="mt-3 grid gap-2">
              <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-white/10 p-2 text-xs has-[:checked]:border-[var(--brand)]/50 has-[:checked]:bg-[var(--brand)]/10">
                <input type="radio" name="chinaShip" checked={chinaMode === "AIR"} onChange={() => setChinaMode("AIR")} />
                <span>
                  <span className="font-medium text-white">Air shipping</span>
                  <span className="mt-0.5 block text-zinc-500">GHS {chinaQuotes.air.feeGhs.toLocaleString()} · {chinaQuotes.air.eta}</span>
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-white/10 p-2 text-xs has-[:checked]:border-[var(--brand)]/50 has-[:checked]:bg-[var(--brand)]/10">
                <input type="radio" name="chinaShip" checked={chinaMode === "SEA"} onChange={() => setChinaMode("SEA")} />
                <span>
                  <span className="font-medium text-white">Sea shipping</span>
                  <span className="mt-0.5 block text-zinc-500">GHS {chinaQuotes.sea.feeGhs.toLocaleString()} · {chinaQuotes.sea.eta}</span>
                </span>
              </label>
            </div>
          </div>
        ) : null}
        <p className="mt-1 text-sm text-zinc-300">
          Wallet: <span className="font-medium text-white">GHS {walletBalance.toLocaleString()}</span>
        </p>

        <div className="mt-4">
          <label htmlFor="delivery-address" className="text-xs text-zinc-500">
            Delivery address
          </label>
          <select
            id="delivery-address"
            value={addressId}
            onChange={(e) => setAddressId(e.target.value)}
            className="mt-1 h-10 w-full rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white"
          >
            {addresses.map((a) => (
              <option key={a.id} value={a.id}>
                {a.fullName}, {a.streetAddress}, {a.city}
              </option>
            ))}
          </select>
          {addresses.length === 0 ? (
            <p className="mt-2 text-xs text-amber-300">
              Add delivery address in profile before checkout.
              <Link href="/dashboard/profile" className="ml-1 text-[var(--brand)] hover:underline">
                Open profile
              </Link>
            </p>
          ) : null}
        </div>

        {addresses.length > 0 ? (
          <div className="mt-4 space-y-3">
            <div>
              <label htmlFor="dispatch-phone" className="text-xs text-zinc-500">
                Dispatch / delivery phone
              </label>
              <Input
                id="dispatch-phone"
                type="tel"
                autoComplete="tel"
                value={dispatchPhone}
                onChange={(e) => setDispatchPhone(e.target.value)}
                placeholder="Number to call on arrival"
                className="mt-1 h-10 w-full border-white/10 bg-black/30 text-sm text-white"
              />
              <p className="mt-1 text-[10px] leading-snug text-zinc-500">
                Pre-filled from your address; edit if a different number should be used for this shipment.
              </p>
            </div>
            <div>
              <label htmlFor="delivery-notes" className="text-xs text-zinc-500">
                Delivery notes (optional)
              </label>
              <textarea
                id="delivery-notes"
                value={deliveryInstructions}
                onChange={(e) => setDeliveryInstructions(e.target.value)}
                placeholder="Gate, landmark, preferred time…"
                rows={3}
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none ring-[var(--brand)]/40 focus:ring-1"
              />
            </div>
          </div>
        ) : null}

        {!hasFunds ? (
          <div className="mt-4">
            <WalletTopupFlow
              walletBalance={walletBalance}
              isSignedIn
              variant="compact"
              showBalance={false}
              heading="Top up to check out"
              supportingText="Complete payment on Paystack, then return to this page. When your wallet reflects the new balance, you can pay for your selected lines in one step."
              gapGhs={Math.max(0, selectedTotal - walletBalance)}
              defaultAmount={Math.max(50, Math.ceil(selectedTotal - walletBalance))}
              signInHref="/login?callbackUrl=%2Fparts%2Fcart"
              className="[--brand:#ef4444]"
            />
          </div>
        ) : null}
        {legalCheckoutReady ? (
          <p className="mt-4 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100/95">
            Legal requirements for checkout are already accepted on your account. No duplicate checkbox needed.
          </p>
        ) : (
          <label className="mt-4 flex items-start gap-2 rounded-lg border border-border/70 bg-background/80 p-3 text-xs text-foreground dark:border-white/15 dark:bg-white/[0.05] dark:text-zinc-100">
            <input
              type="checkbox"
              checked={agreementAccepted}
              onChange={(e) => setAgreementAccepted(e.target.checked)}
              className="accent-[var(--brand)]"
            />
            <span className="font-medium">
              I agree to{" "}
              <span className="rounded-md bg-[var(--brand)]/12 px-1.5 py-0.5 font-semibold text-[var(--brand)] dark:bg-[var(--brand)]/20">
                checkout terms and payment verification requirements
              </span>{" "}
              for selected items. Version {agreementVersion}. For fastest checkout, accept all policies in{" "}
              <Link href="/dashboard/profile" className="text-[var(--brand)] underline-offset-2 hover:underline">
                Profile
              </Link>
              .
            </span>
          </label>
        )}

        <Button
          type="button"
          className="mt-4 w-full"
          disabled={loading || !hasFunds || addresses.length === 0 || selectedStockIssues.length > 0}
          onClick={() => void checkout()}
        >
          {loading ? "Processing..." : "Pay selected items"}
        </Button>
      </aside>
      </div>
    </div>
  );
}
