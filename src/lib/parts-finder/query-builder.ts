import type { VehicleQueryPayload } from "@/lib/parts-finder/identifier-crypto";
import { buildExternalSearchQueries, normalizePartsQuery } from "@/lib/parts-finder/normalize-query";
import type { ParsedVehicleData, QueryForms } from "@/lib/parts-finder/search-types";

export function buildPartsFinderQueries(payload: VehicleQueryPayload, vehicle: ParsedVehicleData): QueryForms {
  const normalized = normalizePartsQuery(payload);
  const external = buildExternalSearchQueries(normalized);
  const internal = [
    vehicle.identifier ? `identifier:${vehicle.identifier}` : null,
    vehicle.brand ? `brand:${vehicle.brand}` : null,
    vehicle.model ? `model:${vehicle.model}` : null,
    vehicle.year ? `year:${vehicle.year}` : null,
    normalized.partIntent ? `part:${normalized.partIntent.toLowerCase()}` : null,
    normalized.imageHints.length > 0 ? `image-hints:${normalized.imageHints.join(",")}` : null,
  ].filter(Boolean) as string[];
  return {
    internal,
    external,
    retrieval: normalized.retrieval,
  };
}
