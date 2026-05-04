import { Suspense } from "react";

import { PublicSiteFooter } from "@/components/layout/public-site-footer";
import { SiteHeader, SiteHeaderFallback } from "@/components/layout/site-header";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen min-w-0 flex-col">
      <Suspense fallback={<SiteHeaderFallback />}>
        <SiteHeader />
      </Suspense>
      <main className="sda-main-safe min-w-0 flex-1 overflow-x-clip">{children}</main>
      <PublicSiteFooter />
    </div>
  );
}
