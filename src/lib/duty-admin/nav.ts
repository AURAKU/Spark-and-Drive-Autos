export type DutyAdminNavItem = {
  href: string;
  label: string;
  description?: string;
};

export const DUTY_ADMIN_NAV: DutyAdminNavItem[] = [
  { href: "/admin/duty", label: "Dashboard", description: "Operations overview and alerts" },
  { href: "/admin/duty/tracking", label: "Order tracking", description: "Vehicle order duty cases" },
  { href: "/admin/duty/rules", label: "Rules", description: "Calculation rules and publish workflow" },
  { href: "/admin/duty/profiles", label: "Profiles", description: "Vehicle classification profiles" },
  { href: "/admin/duty/hs-codes", label: "HS codes", description: "HS headings and mappings" },
  { href: "/admin/duty/fx-rates", label: "FX rates", description: "Exchange rate management" },
  { href: "/admin/duty/valuation", label: "Valuation", description: "Freight and insurance defaults" },
  { href: "/admin/duty/assessments", label: "Assessments", description: "Verified BoE assessments" },
  { href: "/admin/duty/calculations", label: "Calculations", description: "Saved duty estimates" },
  { href: "/admin/duty/calibration", label: "Calibration", description: "Prediction accuracy analytics" },
  { href: "/admin/duty/settings", label: "Settings", description: "Calculator configuration" },
  { href: "/admin/duty/audit", label: "Audit", description: "Change history" },
];

export function isDutyAdminPath(pathname: string): boolean {
  return pathname === "/admin/duty" || pathname.startsWith("/admin/duty/");
}
