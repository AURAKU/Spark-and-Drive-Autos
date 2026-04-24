import type { VehicleQueryPayload } from "@/lib/parts-finder/identifier-crypto";
import type { ParsedVehicleData } from "@/lib/parts-finder/search-types";

function sanitizeToken(v: string | number | null | undefined) {
  return String(v ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 80);
}

export function parseVehicleDescriptor(payload: VehicleQueryPayload): ParsedVehicleData {
  const identifier = sanitizeToken(payload.vin || payload.chassis || null).toUpperCase() || null;
  const yearRaw = payload.year;
  const year =
    typeof yearRaw === "number"
      ? yearRaw
      : typeof yearRaw === "string"
        ? Number.parseInt(yearRaw, 10) || null
        : null;
  const brand = sanitizeToken(payload.brand).toUpperCase() || null;
  const model = sanitizeToken(payload.model).toUpperCase() || null;
  const engine = sanitizeToken(payload.engine).toUpperCase() || null;
  const trim = sanitizeToken(payload.trim).toUpperCase() || null;
  const tokens = [brand, model, year != null ? String(year) : null, engine, trim].filter(Boolean) as string[];

  return {
    identifier,
    identifierKind: identifier ? "VIN_OR_CHASSIS" : "NONE",
    brand,
    model,
    year,
    engine,
    trim,
    tokens,
  };
}
