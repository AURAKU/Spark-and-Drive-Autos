/** Map Prisma EngineType to duty fuel type strings used by the engine. */
export function mapFuelType(fuelType: string): string {
  if (fuelType === "GASOLINE_PETROL") return "GASOLINE";
  if (fuelType === "GASOLINE_DIESEL") return "DIESEL";
  if (fuelType === "PLUGIN_HYBRID") return "PLUGIN_HYBRID";
  if (fuelType === "HYBRID") return "HYBRID";
  return fuelType;
}
