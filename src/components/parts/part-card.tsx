import Image from "next/image";
import Link from "next/link";

import { formatConverted, type DisplayCurrency, type FxRatesInput } from "@/lib/currency";
import { getPartDisplayPrice } from "@/lib/parts-pricing";
import { partStockStatusLabel } from "@/lib/part-stock";
import type { Part, PartOrigin } from "@prisma/client";
import { PartCardActions } from "@/components/parts/part-card-actions";

type Props = {
  part: Pick<
    Part,
    | "id"
    | "slug"
    | "title"
    | "shortDescription"
    | "priceGhs"
    | "basePriceRmb"
    | "origin"
    | "category"
    | "stockStatus"
    | "stockQty"
    | "coverImageUrl"
  >;
  displayCurrency: DisplayCurrency;
  fx: FxRatesInput;
  isFavorite: boolean;
  canFavorite: boolean;
};

export function PartCard({ part, displayCurrency, fx, isFavorite, canFavorite }: Props) {
  const { amount, currency } = getPartDisplayPrice(
    {
      origin: part.origin as PartOrigin,
      basePriceRmb: Number(part.basePriceRmb),
      priceGhs: Number(part.priceGhs),
    },
    displayCurrency,
    fx,
  );
  const cover = part.coverImageUrl ?? "/brand/logo-emblem.png";

  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition hover:border-[var(--brand)]/35 hover:bg-muted/60 dark:border-white/10 dark:bg-white/[0.03] dark:hover:bg-white/[0.05]">
      <Link href={`/parts/${part.slug}`}>
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted/80 dark:bg-black/40">
        <Image
          src={cover}
          alt=""
          fill
          className="object-cover transition duration-300 group-hover:scale-[1.02]"
          sizes="(max-width: 768px) 100vw, 33vw"
          unoptimized={cover.startsWith("http")}
        />
        <span className="absolute left-3 top-3 rounded-full border border-border bg-background/85 px-2 py-0.5 text-[10px] font-medium tracking-wide text-foreground uppercase backdrop-blur-sm dark:border-white/15 dark:bg-black/50 dark:text-zinc-200">
          {part.category}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h2 className="text-base font-semibold text-foreground group-hover:text-[var(--brand)] dark:text-white">{part.title}</h2>
        {part.shortDescription ? (
          <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{part.shortDescription}</p>
        ) : null}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 dark:border-white/10">
          <span className="text-lg font-semibold text-foreground dark:text-white">{formatConverted(amount, currency)}</span>
          <span className="text-xs text-muted-foreground">{partStockStatusLabel(part.stockStatus)}</span>
        </div>
      </div>
      </Link>
      <div className="border-t border-border p-3 dark:border-white/10">
        <PartCardActions
          partId={part.id}
          partSlug={part.slug}
          stockQty={part.stockQty}
          isFavorite={isFavorite}
          canFavorite={canFavorite}
        />
      </div>
    </article>
  );
}
