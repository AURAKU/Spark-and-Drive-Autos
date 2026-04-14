"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { WalletTopupFlow } from "@/components/parts/wallet-topup-flow";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type ChinaQuotes = { air: { feeGhs: number; eta: string }; sea: { feeGhs: number; eta: string } };

type Props = {
  chinaQuotes?: ChinaQuotes | null;
  items: Array<{
    id: string;
    selected: boolean;
    quantity: number;
    part: {
      id: string;
      slug: string;
      title: string;
      origin: "GHANA" | "CHINA";
      stockQty: number;
      unitPriceGhs: number;
      coverImageUrl: string | null;
    };
  }>;
  walletBalance: number;
  addresses: Array<{ id: string; fullName: string; city: string; region: string; streetAddress: string; isDefault: boolean }>;
  agreementVersion: string;
};

export function PartsCartClient({ chinaQuotes, items, walletBalance, addresses, agreementVersion }: Props) {
  const [rows, setRows] = useState(items);
  const [addressId, setAddressId] = useState(addresses.find((a) => a.isDefault)?.id ?? addresses[0]?.id ?? "");
  const [loading, setLoading] = useState(false);
  const [checkoutRequestKey, setCheckoutRequestKey] = useState<string | null>(null);
  const [agreementAccepted, setAgreementAccepted] = useState(false);
  const [chinaMode, setChinaMode] = useState<"AIR" | "SEA" | null>(chinaQuotes ? "AIR" : null);

  const selectedRows = useMemo(() => rows.filter((r) => r.selected), [rows]);
  const selectedStockIssues = useMemo(
    () =>
      selectedRows.filter(
        (r) => r.part.stockQty < 1 || r.quantity > r.part.stockQty,
      ),
    [selectedRows],
  );
  const hasChinaSelected = useMemo(
    () => selectedRows.some((r) => r.part.origin === "CHINA"),
    [selectedRows],
  );
  const chinaAddon = useMemo(() => {
    if (!chinaQuotes || !hasChinaSelected || !chinaMode) return 0;
    return chinaMode === "AIR" ? chinaQuotes.air.feeGhs : chinaQuotes.sea.feeGhs;
  }, [chinaQuotes, chinaMode, hasChinaSelected]);
  const selectedTotal = useMemo(
    () => selectedRows.reduce((sum, row) => sum + row.part.unitPriceGhs * row.quantity, 0) + chinaAddon,
    [selectedRows, chinaAddon],
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
    const maxQ = row ? Math.max(0, row.part.stockQty) : 99;
    const safeQty = Math.min(Math.max(1, quantity), Math.max(1, maxQ));
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

  async function checkout() {
    if (!addressId) {
      toast.error("Select a delivery address.");
      return;
    }
    if (selectedRows.length === 0) {
      toast.error("Select at least one item.");
      return;
    }
    if (!agreementAccepted) {
      toast.error("Please accept checkout agreement before payment.");
      return;
    }
    if (selectedStockIssues.length > 0) {
      toast.error(
        "One or more selected items are out of stock or over available quantity. Adjust quantities or deselect those lines.",
      );
      return;
    }
    if (hasChinaSelected && chinaQuotes && !chinaMode) {
      toast.error("Choose Air or Sea shipping for China-origin parts.");
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
          ...(hasChinaSelected && chinaMode ? { chinaShippingChoice: chinaMode } : {}),
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
            Some selected items are completely out of stock, or the quantity is higher than we have on hand. Reduce each
            line to the stock shown (or remove it), then try again — or contact customer support for alternatives.
          </p>
        </div>
      ) : null}
      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
      <div className="space-y-3">
        {rows.map((row) => (
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
                  <Image src={row.part.coverImageUrl ?? "/brand/logo-emblem.png"} alt="" fill className="object-cover" />
                </div>
                <div>
                  <Link href={`/parts/${row.part.slug}`} className="text-sm font-medium text-white hover:text-[var(--brand)]">
                    {row.part.title}
                  </Link>
                  <p className="mt-1 text-xs text-zinc-500">
                    GHS {row.part.unitPriceGhs.toLocaleString()} each · {row.part.origin} · In stock:{" "}
                    <span className="text-zinc-300">{row.part.stockQty}</span>
                  </p>
                  {row.part.stockQty < 1 ? (
                    <p className="mt-1 text-xs text-amber-200/90">This SKU is out of stock — remove it or contact support.</p>
                  ) : row.quantity > row.part.stockQty ? (
                    <p className="mt-1 text-xs text-amber-200/90">
                      Quantity exceeds available stock ({row.part.stockQty}). Lower the quantity to continue.
                    </p>
                  ) : null}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  max={Math.max(1, row.part.stockQty)}
                  value={row.quantity}
                  onChange={(e) => void onQty(row.id, Number(e.target.value) || 1)}
                  className="h-9 w-24"
                  disabled={row.part.stockQty < 1}
                />
                <button
                  type="button"
                  className="inline-flex h-9 items-center rounded-lg border border-white/20 px-3 text-xs text-zinc-300 hover:bg-white/8"
                  onClick={() => void onRemove(row.id)}
                >
                  Remove
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <aside className="h-fit rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <h2 className="text-sm font-semibold text-white">Checkout summary</h2>
        <p className="mt-3 text-sm text-zinc-300">
          Selected items: <span className="text-white">{selectedRows.length}</span>
        </p>
        <p className="mt-1 text-sm text-zinc-300">
          Total: <span className="font-semibold text-[var(--brand)]">GHS {selectedTotal.toLocaleString()}</span>
          {chinaAddon > 0 ? (
            <span className="ml-2 text-xs text-zinc-500">(includes China shipping GHS {chinaAddon.toLocaleString()})</span>
          ) : null}
        </p>
        {chinaQuotes && hasChinaSelected ? (
          <div className="mt-4 rounded-xl border border-white/10 bg-black/30 p-3">
            <p className="text-xs font-semibold text-white">China warehouse → Ghana</p>
            <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">Choose one international method for all China-origin lines in this checkout.</p>
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
        <label className="mt-4 flex items-start gap-2 rounded-lg border border-white/10 bg-white/[0.02] p-3 text-xs text-zinc-300">
          <input type="checkbox" checked={agreementAccepted} onChange={(e) => setAgreementAccepted(e.target.checked)} />
          <span>
            I agree to checkout terms and payment verification requirements for selected items. Version {agreementVersion}.
          </span>
        </label>

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
