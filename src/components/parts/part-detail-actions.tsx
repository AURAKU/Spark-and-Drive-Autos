"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Heart } from "lucide-react";

import { WalletTopupFlow } from "@/components/parts/wallet-topup-flow";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { CartIconButton } from "@/components/parts/cart-icon-button";
import { SharePageButton } from "@/components/sharing/share-page-button";
import { partOutOfStockCustomerMessage } from "@/lib/parts-stock-customer";
import { formatOptionsLine, type PartOptionsLists } from "@/lib/part-variant-options";
import type { PartsChinaQuotes } from "@/lib/shipping/parts-china-fees";

type Props = {
  partId: string;
  partSlug: string;
  partTitle: string;
  /** Absolute URL to this part detail page (for native share / copy). */
  shareUrl: string;
  shareDescription?: string | null;
  stockQty: number;
  unitPrice: number;
  currency: string;
  walletBalance: number;
  defaultAddress: {
    id: string;
    fullName: string;
    phone: string;
    city: string;
    region: string;
    streetAddress: string;
  } | null;
  isSignedIn: boolean;
  initialFavorite?: boolean;
  agreementVersion: string;
  /** When set (China-origin part), wallet total includes selected Air/Sea fee. */
  chinaQuotes?: PartsChinaQuotes | null;
  /** China pre-order and similar: allow purchase when on-hand stock is zero. */
  isPreorder: boolean;
  optionLists: PartOptionsLists;
};

export function PartDetailActions({
  partId,
  partSlug,
  partTitle,
  shareUrl,
  shareDescription = null,
  stockQty,
  unitPrice,
  currency,
  walletBalance,
  defaultAddress,
  isSignedIn,
  initialFavorite = false,
  agreementVersion,
  chinaQuotes = null,
  isPreorder,
  optionLists,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [qty, setQty] = useState(1);
  const [selColor, setSelColor] = useState("");
  const [selSize, setSelSize] = useState("");
  const hasOptionLists =
    optionLists.colors.length + optionLists.sizes.length + optionLists.types.length > 0;
  const buyOptionsLine = formatOptionsLine({ color: selColor, size: selSize });
  const outOfStock = !isPreorder && stockQty < 1;
  const maxQty = isPreorder ? 99 : Math.max(1, stockQty);

  useEffect(() => {
    setQty((q) => Math.min(Math.max(1, q), maxQty));
  }, [maxQty]);
  useEffect(() => {
    if (defaultAddress?.phone) setDispatchPhone(defaultAddress.phone);
  }, [defaultAddress?.id, defaultAddress?.phone]);
  const [buyOpen, setBuyOpen] = useState(false);
  const [favorite, setFavorite] = useState(initialFavorite);
  const [buyRequestKey, setBuyRequestKey] = useState<string | null>(null);
  const [agreementAccepted, setAgreementAccepted] = useState(false);
  const [dispatchPhone, setDispatchPhone] = useState(defaultAddress?.phone ?? "");
  const [deliveryInstructions, setDeliveryInstructions] = useState("");
  const [chinaMode, setChinaMode] = useState<"AIR" | "SEA" | null>(chinaQuotes ? "AIR" : null);
  const chinaFeeGhs = useMemo(() => {
    if (!chinaQuotes || !chinaMode) return 0;
    return chinaMode === "AIR" ? chinaQuotes.air.feeGhs : chinaQuotes.sea.feeGhs;
  }, [chinaQuotes, chinaMode]);
  const total = useMemo(
    () => Math.max(1, qty) * unitPrice + chinaFeeGhs,
    [qty, unitPrice, chinaFeeGhs],
  );
  const hasFunds = walletBalance >= total;

  function assertOptionsOrToast(): boolean {
    if (optionLists.colors.length > 0 && !selColor) {
      toast.error("Select a color.");
      return false;
    }
    if (optionLists.sizes.length > 0 && !selSize) {
      toast.error("Select a size.");
      return false;
    }
    return true;
  }

  const optionBody = {
    ...(selColor ? { color: selColor } : {}),
    ...(selSize ? { size: selSize } : {}),
  };

  async function addToCart() {
    if (hasOptionLists && !assertOptionsOrToast()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/parts/cart/items", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ partId, quantity: Math.max(1, qty), ...optionBody }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; count?: number; alreadyInCart?: boolean };
      if (res.status === 401) {
        router.push(`/login?callbackUrl=${encodeURIComponent(`/parts/${partSlug}`)}`);
        return;
      }
      if (!res.ok) {
        throw new Error(data.error ?? "Could not add to cart.");
      }
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("parts-cart:changed", { detail: { count: data.count } }));
      }
      if (data.alreadyInCart) {
        toast.info("Item already in cart. Increase quantity from your cart page.");
      } else {
        toast.success("Added to cart.");
      }
      router.push("/parts/cart");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add to cart.");
    } finally {
      setLoading(false);
    }
  }

  async function buyNow() {
    if (hasOptionLists && !assertOptionsOrToast()) return;
    if (!defaultAddress?.id) {
      toast.error("Please add a delivery address in your profile before checkout.");
      router.push("/dashboard/profile");
      return;
    }
    if (!agreementAccepted) {
      toast.error("Please accept checkout agreement before payment.");
      return;
    }
    if (dispatchPhone.trim().length < 8) {
      toast.error("Enter a valid dispatch phone number (8+ characters) for this delivery.");
      return;
    }
    if (chinaQuotes && !chinaMode) {
      toast.error("Select Air or Sea shipping for this part.");
      return;
    }
    setLoading(true);
    const requestKey = buyRequestKey ?? crypto.randomUUID();
    if (!buyRequestKey) setBuyRequestKey(requestKey);
    try {
      const res = await fetch("/api/parts/checkout/buy-now", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          partId,
          quantity: Math.max(1, qty),
          ...optionBody,
          addressId: defaultAddress.id,
          requestKey,
          agreementAccepted,
          agreementVersion,
          dispatchPhone: dispatchPhone.trim(),
          deliveryInstructions: deliveryInstructions.trim() || undefined,
          ...(chinaQuotes && chinaMode ? { chinaShippingChoice: chinaMode } : {}),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; orderId?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not complete payment.");
      toast.success("Order paid successfully from wallet.");
      setBuyOpen(false);
      router.push(`/dashboard/orders/${data.orderId ?? ""}`);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not complete payment.");
      setBuyRequestKey(null);
    } finally {
      setLoading(false);
    }
  }

  async function toggleFavorite() {
    if (!isSignedIn) {
      router.push(`/login?callbackUrl=${encodeURIComponent(`/parts/${partSlug}`)}`);
      return;
    }
    const next = !favorite;
    setFavorite(next);
    try {
      const res = await fetch(next ? "/api/parts/favorites" : `/api/parts/favorites?partId=${encodeURIComponent(partId)}`, {
        method: next ? "POST" : "DELETE",
        headers: next ? { "content-type": "application/json" } : undefined,
        body: next ? JSON.stringify({ partId }) : undefined,
      });
      if (!res.ok) throw new Error("Could not update favorites.");
      toast.success(next ? "Saved to favorites." : "Removed from favorites.");
      router.refresh();
    } catch {
      setFavorite(!next);
      toast.error("Could not update favorites.");
    }
  }

  return (
    <>
      {outOfStock ? (
        <div className="mb-4 rounded-xl border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-sm leading-relaxed text-amber-50">
          {partOutOfStockCustomerMessage(partTitle)}
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        {optionLists.colors.length > 0 ? (
          <div className="flex min-w-[10rem] flex-col gap-1">
            <label className="text-sm text-zinc-400" htmlFor="opt-color">
              Color
            </label>
            <select
              id="opt-color"
              className="h-10 w-full min-w-[10rem] rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white"
              value={selColor}
              onChange={(e) => setSelColor(e.target.value)}
              required
            >
              <option value="">Choose…</option>
              {optionLists.colors.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        {optionLists.sizes.length > 0 ? (
          <div className="flex min-w-[8rem] flex-col gap-1">
            <label className="text-sm text-zinc-400" htmlFor="opt-size">
              Size
            </label>
            <select
              id="opt-size"
              className="h-10 w-full rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white"
              value={selSize}
              onChange={(e) => setSelSize(e.target.value)}
              required
            >
              <option value="">Choose…</option>
              {optionLists.sizes.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        <div className="flex items-center gap-2">
          <label htmlFor="detail-qty" className="text-sm text-zinc-400">
            Quantity
          </label>
          <Input
            id="detail-qty"
            type="number"
            min={1}
            max={maxQty}
            step={1}
            value={qty}
            disabled={outOfStock}
            onChange={(e) => {
              const v = Number(e.target.value) || 1;
              setQty(Math.min(Math.max(1, v), maxQty));
            }}
            className="h-10 w-24"
          />
          {!outOfStock ? (
            <span className="text-xs text-zinc-500">
              {isPreorder ? "Pre-order (no on-hand cap)" : `Max ${stockQty}`}
            </span>
          ) : null}
        </div>
        <Button type="button" disabled={loading || outOfStock} onClick={() => void addToCart()}>
          Add to Cart
        </Button>
        {isSignedIn ? (
          <button
            type="button"
            disabled={outOfStock}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-white/20 px-5 text-sm font-semibold text-white transition hover:bg-white/8 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => setBuyOpen(true)}
          >
            Buy
          </button>
        ) : (
          <Link
            href={`/login?callbackUrl=${encodeURIComponent(`/parts/${partSlug}`)}`}
            className={`inline-flex h-10 items-center justify-center rounded-lg border border-white/20 px-5 text-sm font-semibold transition hover:bg-white/8 ${
              outOfStock ? "pointer-events-none opacity-50 text-zinc-500" : "text-white"
            }`}
            aria-disabled={outOfStock}
          >
            Buy
          </Link>
        )}
        <CartIconButton className="size-10 rounded-lg border border-white/20 bg-white/[0.03] text-[var(--brand)] transition hover:bg-white/8" />
        <SharePageButton
          url={shareUrl}
          title={partTitle}
          text={shareDescription?.trim() || `Parts & accessories: ${partTitle}`}
          className="h-10 rounded-lg border border-white/20 bg-white/[0.03] px-3 text-zinc-200 transition hover:bg-white/8 dark:border-white/20 dark:bg-white/[0.03] dark:text-zinc-200 dark:hover:bg-white/8"
        />
        <button
          type="button"
          aria-label={favorite ? "Remove from favorites" : "Add to favorites"}
          className={`inline-flex h-10 items-center justify-center rounded-lg border px-3 transition ${
            favorite
              ? "border-rose-400/70 bg-rose-400/20 text-rose-300"
              : "border-white/20 bg-white/[0.03] text-zinc-200 hover:bg-white/8"
          }`}
          onClick={() => void toggleFavorite()}
        >
          <Heart className={`size-4 ${favorite ? "fill-current" : ""}`} />
        </button>
      </div>

      <Dialog open={buyOpen} onOpenChange={setBuyOpen}>
        <DialogContent className="border border-white/10 bg-[#0a0f15] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white">Order summary</DialogTitle>
            <DialogDescription className="text-zinc-400">
              Confirm quantity and pay from your wallet.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm">
            <p className="text-zinc-300">Item: {partTitle}</p>
            {buyOptionsLine ? <p className="text-zinc-400">{buyOptionsLine}</p> : null}
            <p className="text-zinc-300">Quantity: {Math.max(1, qty)}</p>
            {chinaQuotes ? (
              <div className="space-y-2 rounded-lg border border-white/10 bg-white/[0.02] p-3">
                <p className="text-xs font-semibold tracking-wide text-zinc-400 uppercase">China freight</p>
                <label className="flex cursor-pointer items-start gap-2 rounded-md border border-transparent p-2 hover:border-white/10">
                  <input
                    type="radio"
                    name="buy-china-mode"
                    checked={chinaMode === "AIR"}
                    onChange={() => setChinaMode("AIR")}
                  />
                  <span>
                    <span className="font-medium text-white">Air shipping</span>
                    <span className="mt-0.5 block text-zinc-500">
                      {currency} {chinaQuotes.air.feeGhs.toLocaleString()} · {chinaQuotes.air.eta}
                    </span>
                  </span>
                </label>
                <label className="flex cursor-pointer items-start gap-2 rounded-md border border-transparent p-2 hover:border-white/10">
                  <input
                    type="radio"
                    name="buy-china-mode"
                    checked={chinaMode === "SEA"}
                    onChange={() => setChinaMode("SEA")}
                  />
                  <span>
                    <span className="font-medium text-white">Sea shipping</span>
                    <span className="mt-0.5 block text-zinc-500">
                      {currency} {chinaQuotes.sea.feeGhs.toLocaleString()} · {chinaQuotes.sea.eta}
                    </span>
                  </span>
                </label>
              </div>
            ) : null}
            <p className="text-zinc-300">
              Subtotal (parts): {currency}{" "}
              {(Math.max(1, qty) * unitPrice).toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </p>
            {chinaFeeGhs > 0 ? (
              <p className="text-zinc-300">
                Freight ({chinaMode === "SEA" ? "Sea" : "Air"}): {currency}{" "}
                {chinaFeeGhs.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </p>
            ) : null}
            <p className="text-zinc-300">
              Total: {currency} {total.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </p>
            <p className="text-zinc-300">
              Wallet balance: {currency} {walletBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </p>
            {defaultAddress ? (
              <p className="text-zinc-400">
                Delivery to {defaultAddress.fullName}, {defaultAddress.streetAddress}, {defaultAddress.city},{" "}
                {defaultAddress.region}
              </p>
            ) : (
              <p className="text-amber-300">No saved default address. Add one in profile before payment.</p>
            )}
            {defaultAddress ? (
              <div className="space-y-2">
                <div>
                  <label htmlFor="buy-dispatch-phone" className="text-xs text-zinc-500">
                    Dispatch / delivery phone
                  </label>
                  <Input
                    id="buy-dispatch-phone"
                    type="tel"
                    className="mt-1 h-9 border-white/10 bg-black/30 text-sm text-white"
                    value={dispatchPhone}
                    onChange={(e) => setDispatchPhone(e.target.value)}
                    placeholder="Number to call on arrival"
                  />
                </div>
                <div>
                  <label htmlFor="buy-delivery-notes" className="text-xs text-zinc-500">
                    Delivery notes (optional)
                  </label>
                  <textarea
                    id="buy-delivery-notes"
                    className="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-2 py-1.5 text-sm text-white outline-none"
                    rows={2}
                    value={deliveryInstructions}
                    onChange={(e) => setDeliveryInstructions(e.target.value)}
                    placeholder="Gate, landmark…"
                  />
                </div>
              </div>
            ) : null}
            <label className="flex items-start gap-2 rounded-lg border border-border/70 bg-background/80 p-3 text-xs text-foreground dark:border-white/15 dark:bg-white/[0.05] dark:text-zinc-100">
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
                for this order. Version {agreementVersion}.
              </span>
            </label>
          </div>

          {!hasFunds ? (
            <WalletTopupFlow
              walletBalance={walletBalance}
              isSignedIn={isSignedIn}
              variant="embed"
              showBalance={false}
              heading="Add funds to wallet"
              gapGhs={Math.max(0, total - walletBalance)}
              defaultAmount={Math.max(50, Math.ceil(total - walletBalance))}
              signInHref={`/login?callbackUrl=${encodeURIComponent(`/parts/${partSlug}`)}`}
              className="mt-1"
            />
          ) : (
            <Button type="button" className="w-full" onClick={() => void buyNow()} disabled={loading || outOfStock}>
              {loading ? "Processing..." : "Pay from wallet"}
            </Button>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
