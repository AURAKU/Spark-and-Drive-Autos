import { PageHeading } from "@/components/typography/page-headings";
import { prisma } from "@/lib/prisma";

import { CurrencySettingsForm } from "./currency-settings-form";

export const dynamic = "force-dynamic";

export default async function AdminCurrencyPage() {
  const settings = await prisma.globalCurrencySettings.findUnique({
    where: { id: "default" },
    include: { updatedBy: { select: { name: true, email: true } } },
  });

  return (
    <div>
      <PageHeading variant="dashboard">Exchange rates (RMB · GHS · USD)</PageHeading>
      <p className="mt-2 max-w-2xl text-sm text-zinc-400">
        Admin-managed FX for the whole platform. Inventory uses one canonical value per vehicle:{" "}
        <strong className="text-zinc-300">base price in RMB (CNY)</strong>. You edit two inputs — USD↔RMB and RMB↔GHS —
        and we derive USD↔GHS, refresh cached GHS on every car for Paystack, and revalidate listings, detail pages, and
        checkout. Shoppers switch display currency (GHS / USD / CNY) with the site currency selector; amounts always
        follow these rates.
      </p>
      <CurrencySettingsForm
        initial={
          settings
            ? {
                usdToRmb: Number(settings.usdToRmb),
                rmbToGhs: Number(settings.rmbToGhs),
                usdToGhs: Number(settings.usdToGhs),
                updatedAt: settings.updatedAt.toISOString(),
                updatedByLabel: settings.updatedBy?.name ?? settings.updatedBy?.email ?? null,
              }
            : null
        }
      />
    </div>
  );
}
