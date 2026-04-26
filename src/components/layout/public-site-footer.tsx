"use client";

import { usePathname } from "next/navigation";

import { SiteFooter } from "@/components/layout/site-footer";

/**
 * Full marketing footer (pillars, links, social) only on the home page;
 * all other public routes get a compact copyright bar.
 */
export function PublicSiteFooter() {
  const pathname = usePathname();
  const normalized = (pathname ?? "/").replace(/\/$/, "") || "/";
  const isLanding = normalized === "/";

  return <SiteFooter variant={isLanding ? "full" : "minimal"} />;
}
