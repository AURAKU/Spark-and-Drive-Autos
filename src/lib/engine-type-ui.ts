import { EngineType } from "@prisma/client";

/** Preferred dropdown order: petrol, diesel, then other powertrains. */
export const ENGINE_TYPE_ORDER: EngineType[] = [
  "GASOLINE_PETROL",
  "GASOLINE_DIESEL",
  "ELECTRIC",
  "HYBRID",
  "PLUGIN_HYBRID",
];

const LABEL: Record<EngineType, string> = {
  GASOLINE_PETROL: "Gasoline (petrol)",
  GASOLINE_DIESEL: "Gasoline (diesel)",
  ELECTRIC: "Electric (BEV)",
  HYBRID: "Hybrid",
  PLUGIN_HYBRID: "Plug-in hybrid",
};

export function engineTypeLabel(t: EngineType | string | null | undefined): string {
  if (t == null || t === "") return "—";
  if (t in LABEL) return LABEL[t as EngineType];
  return String(t).replaceAll("_", " ");
}
