import Image from "next/image";
import Link from "next/link";

import type { SpotlightPart } from "@/lib/landing-spotlight";
import type { DisplayCurrency } from "@/lib/currency";
import { formatConverted } from "@/lib/currency";
import { getPartDisplayPrice } from "@/lib/parts-pricing";
import type { FxRatesInput } from "@/lib/currency";
import type { PartOrigin } from "@prisma/client";
import { Card } from "@/components/ui/card";
import { partStockStatusLabel } from "@/lib/part-stock";

type Props = {
  part: SpotlightPart;
  displayCurrency: DisplayCurrency;
  fx: FxRatesInput;
};

export function LandingPartSpotlightCard({ part, displayCurrency, fx }: Props) {
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
    <Link href={`/parts/${part.slug}`} className="group block focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]">
      <Card className="h-full overflow-hidden border-white/10 bg-white/[0.03] transition hover:border-[var(--brand)]/40 hover:shadow-[0_0_40px_-12px_rgba(20,216,230,0.35)]">
        <div className="relative aspect-[16/10] overflow-hidden bg-zinc-900">
          <Image
            src={cover}
            alt={part.title}
            fill
            className="object-cover transition duration-500 group-hover:scale-[1.03]"
            sizes="(max-width:768px) 100vw, 33vw"
            unoptimized={cover.startsWith("http")}
          />
          <span className="absolute left-3 top-3 rounded-full border border-red-300/40 bg-black/55 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-100 backdrop-blur-sm">
            Parts
          </span>
        </div>
        <div className="space-y-2 p-4">
          <p className="text-[11px] tracking-[0.18em] text-zinc-500 uppercase">{part.category}</p>
          <h3 className="line-clamp-2 text-base font-semibold text-white group-hover:text-[var(--brand)]">{part.title}</h3>
          <p className="text-lg font-semibold text-[var(--brand)]">{formatConverted(amount, currency)}</p>
          <p className="text-xs text-zinc-500">
            {partStockStatusLabel(part.stockStatus)} · {part.stockQty} in stock
          </p>
        </div>
      </Card>
    </Link>
  );
}
