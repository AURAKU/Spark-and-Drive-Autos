import Link from "next/link";

import { PartsCartClient } from "@/components/parts/parts-cart-client";
import { PageHeading } from "@/components/typography/page-headings";
import { getGlobalCurrencySettings } from "@/lib/currency";
import { getCheckoutLegalVersions } from "@/lib/legal-enforcement";
import { computeChinaQuotesForPartIds } from "@/lib/shipping/parts-china-fees";
import { getPartDisplayPrice } from "@/lib/parts-pricing";
import { prisma } from "@/lib/prisma";
import { safeAuth } from "@/lib/safe-auth";

export const dynamic = "force-dynamic";

export default async function PartsCartPage() {
  const session = await safeAuth();
  if (!session?.user?.id) {
    return (
      <div className="parts-theme relative [--brand:#ef4444]">
        <div
          className="parts-theme-bg pointer-events-none absolute inset-0 -z-10 opacity-80"
          style={{
            backgroundImage:
              "radial-gradient(840px 420px at 10% 10%, rgba(239,68,68,0.2), transparent), radial-gradient(680px 360px at 90% 14%, rgba(255,255,255,0.08), transparent), linear-gradient(180deg, rgba(5,5,6,0.95), rgba(9,10,12,0.9)), url('/brand/gear-storefront-theme.png')",
            backgroundBlendMode: "screen,screen,normal,overlay",
            backgroundSize: "auto,auto,auto,cover",
          }}
        />
        <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
          <PageHeading>Parts cart</PageHeading>
          <p className="mt-3 text-sm text-zinc-300">Please sign in to view your saved cart items.</p>
          <Link
            href="/login?callbackUrl=%2Fparts%2Fcart"
            className="mt-6 inline-flex h-10 items-center rounded-lg bg-red-500 px-4 text-sm font-semibold text-white shadow-[0_10px_22px_-14px_rgba(239,68,68,1)] transition hover:bg-red-400"
          >
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  const [cart, user, fx, legal] = await Promise.all([
    prisma.partCart.findUnique({
      where: { userId: session.user.id },
      include: {
        items: {
          orderBy: { createdAt: "desc" },
          include: {
            part: {
              select: {
                id: true,
                slug: true,
                title: true,
                origin: true,
                stockQty: true,
                priceGhs: true,
                basePriceRmb: true,
                coverImageUrl: true,
              },
            },
          },
        },
      },
    }),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        walletBalance: true,
        addresses: {
          orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
          select: { id: true, fullName: true, city: true, region: true, streetAddress: true, isDefault: true },
        },
      },
    }),
    getGlobalCurrencySettings(),
    getCheckoutLegalVersions(),
  ]);

  const chinaPartIdsInCart = [
    ...new Set((cart?.items ?? []).filter((i) => i.part.origin === "CHINA").map((i) => i.part.id)),
  ];
  const chinaQuotes =
    chinaPartIdsInCart.length > 0 ? await computeChinaQuotesForPartIds(chinaPartIdsInCart) : null;

  return (
    <div className="parts-theme relative [--brand:#ef4444]">
      <div
        className="parts-theme-bg pointer-events-none absolute inset-0 -z-10 opacity-80"
        style={{
          backgroundImage:
            "radial-gradient(840px 420px at 10% 10%, rgba(239,68,68,0.2), transparent), radial-gradient(680px 360px at 90% 14%, rgba(255,255,255,0.08), transparent), linear-gradient(180deg, rgba(5,5,6,0.95), rgba(9,10,12,0.9)), url('/brand/gear-storefront-theme.png')",
          backgroundBlendMode: "screen,screen,normal,overlay",
          backgroundSize: "auto,auto,auto,cover",
        }}
      />
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <PageHeading>Parts cart</PageHeading>
        <p className="mt-2 text-sm text-zinc-300">
          Select items ready for payment, choose delivery address, and complete wallet checkout.
        </p>
        <div className="parts-surface mt-8 rounded-2xl border border-red-300/20 bg-black/40 p-4 shadow-[0_0_45px_-25px_rgba(239,68,68,0.72)] sm:p-5">
          <PartsCartClient
            chinaQuotes={chinaQuotes}
            items={(cart?.items ?? []).map((i) => ({
              id: i.id,
              selected: i.selected,
              quantity: i.quantity,
              part: {
                id: i.part.id,
                slug: i.part.slug,
                title: i.part.title,
                origin: i.part.origin,
                stockQty: i.part.stockQty,
                unitPriceGhs: getPartDisplayPrice(
                  {
                    origin: i.part.origin,
                    basePriceRmb: Number(i.part.basePriceRmb),
                    priceGhs: Number(i.part.priceGhs),
                  },
                  "GHS",
                  fx,
                ).amount,
                coverImageUrl: i.part.coverImageUrl,
              },
            }))}
            walletBalance={Number(user?.walletBalance ?? 0)}
            addresses={user?.addresses ?? []}
            agreementVersion={legal.agreementVersion}
          />
        </div>
      </div>
    </div>
  );
}
