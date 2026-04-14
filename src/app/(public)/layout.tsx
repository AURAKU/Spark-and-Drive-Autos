import { Suspense } from "react";

import { AdminPreviewBanner } from "@/components/layout/admin-preview-banner";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader, SiteHeaderFallback } from "@/components/layout/site-header";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <Suspense fallback={<SiteHeaderFallback />}>
        <SiteHeader />
      </Suspense>
      <Suspense fallback={null}>
        <AdminPreviewBanner />
      </Suspense>
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
