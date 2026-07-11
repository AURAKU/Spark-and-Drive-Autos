import { Suspense } from "react";

import { CarCompareBar } from "@/components/cars/car-compare-bar";
import { CarCompareMainPad } from "@/components/cars/car-compare-main-pad";
import { CarCompareProvider } from "@/components/cars/car-compare-context";
import { PublicSiteFooter } from "@/components/layout/public-site-footer";
import { SiteHeader, SiteHeaderFallback } from "@/components/layout/site-header";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <CarCompareProvider>
      <div className="flex min-h-screen min-w-0 flex-col">
        <Suspense fallback={<SiteHeaderFallback />}>
          <SiteHeader />
        </Suspense>
        <main className="sda-main-safe min-w-0 flex-1 overflow-x-clip">
          <CarCompareMainPad>{children}</CarCompareMainPad>
        </main>
        <PublicSiteFooter />
        <CarCompareBar />
      </div>
    </CarCompareProvider>
  );
}
