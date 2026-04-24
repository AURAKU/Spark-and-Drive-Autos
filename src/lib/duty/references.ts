/**
 * Official Ghana / ICUMS / ports references for cross-checking duty and clearance.
 * Domains: gra.gov.gh, external.unipassghana.com (ICUMS), ghanaports.gov.gh.
 */
export type DutyOfficialLink = {
  id: string;
  label: string;
  description: string;
  href: string;
};

export const DUTY_OFFICIAL_LINKS: DutyOfficialLink[] = [
  {
    id: "gra-customs",
    label: "GRA — Customs",
    description: "Ghana Revenue Authority customs division overview and guidance.",
    href: "https://gra.gov.gh/customs/",
  },
  {
    id: "gra-icums",
    label: "GRA — ICUMS",
    description: "Official information on the Integrated Customs Management System (ICUMS).",
    href: "https://gra.gov.gh/customs/icums/",
  },
  {
    id: "gra-vehicle-import",
    label: "GRA — Vehicle importation",
    description: "Official vehicle importation reference material from GRA Customs.",
    href: "https://gra.gov.gh/customs/vehicle-importation/",
  },
  {
    id: "trade-ghana-ev-tariffs",
    label: "Trade.gov — Ghana EV tariffs (context)",
    description: "ECOWAS CET and Ghana policy context for electric vs ICE passenger vehicles (planning reference).",
    href: "https://www.trade.gov/market-intelligence/ghana-electrical-vehicle-tariffs",
  },
  {
    id: "icums-used-vehicle-calculator",
    label: "ICUMS — Used vehicle duty calculator",
    description: "Confirm used-vehicle duty with the official ICUMS calculator (UniPass).",
    href: "https://external.unipassghana.com/cl/tm/tax/selectUsedVehicleTaxCalculate.do?decorator=popup&MENU_ID=IIM01S03V02",
  },
  {
    id: "gra-import-procedures",
    label: "GRA — Import procedures",
    description: "General import procedures published by Ghana Customs.",
    href: "https://gra.gov.gh/customs/import-procedures/",
  },
  {
    id: "gpha-port-process",
    label: "Ghana Ports & Harbours — Port process",
    description: "Official port process and clearance context for importers.",
    href: "https://www.ghanaports.gov.gh/page/index/18/3LNYK28F/Port-Process",
  },
];
