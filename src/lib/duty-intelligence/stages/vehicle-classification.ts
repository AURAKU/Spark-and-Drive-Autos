import type { DutyCalculationInput } from "@/lib/duty-intelligence/types";
import type { LoadedHsCode } from "@/lib/duty-intelligence/types";

export function classifyVehicle(input: DutyCalculationInput, referenceYear = new Date().getFullYear()) {
  const ageYears = Math.max(0, referenceYear - input.vehicle.year);
  const commercial =
    input.vehicle.isCommercial ??
    (input.vehicle.vehicleCategory === "TRUCK" || input.vehicle.vehicleCategory === "BUS");
  return {
    category: input.vehicle.vehicleCategory ?? null,
    ageYears,
    commercial,
    fuelType: input.vehicle.fuelType,
  };
}

export function resolveHsCode(params: {
  input: DutyCalculationInput;
  hsCodes: LoadedHsCode[];
  classification: ReturnType<typeof classifyVehicle>;
}): { code: string; description: string; method: string } {
  if (params.input.hsCodeOverride) {
    const match = params.hsCodes.find((h) => h.hsCode === params.input.hsCodeOverride);
    return {
      code: params.input.hsCodeOverride,
      description: match?.description ?? "Admin override",
      method: "ADMIN_OVERRIDE",
    };
  }

  const { input, hsCodes, classification } = params;
  const candidates = hsCodes.filter((h) => {
    // HS codes in DB may have metadata — match via description keywords when structured fields absent
    const desc = h.description.toLowerCase();
    if (classification.commercial && desc.includes("commercial")) return true;
    if (input.vehicle.fuelType === "ELECTRIC" && (desc.includes("electric") || h.hsCode.startsWith("8703.80"))) return true;
    if (input.vehicle.fuelType === "HYBRID" && desc.includes("hybrid")) return true;
    if (input.vehicle.fuelType === "PLUGIN_HYBRID" && desc.includes("plug")) return true;
    if (
      (input.vehicle.fuelType === "GASOLINE_PETROL" || input.vehicle.fuelType === "GASOLINE_DIESEL") &&
      h.hsCode.startsWith("8703") &&
      !desc.includes("electric")
    ) {
      if (input.vehicle.engineCc != null) {
        if (input.vehicle.engineCc <= 1000 && desc.includes("≤1000")) return true;
        if (input.vehicle.engineCc > 1000 && input.vehicle.engineCc <= 1500 && desc.includes("1000")) return true;
        if (input.vehicle.engineCc > 1500 && input.vehicle.engineCc <= 3000 && desc.includes("1500")) return true;
        if (input.vehicle.engineCc > 3000 && desc.includes("3000")) return true;
      }
      return desc.includes("passenger") || desc.includes("motor car");
    }
    return false;
  });

  if (candidates.length > 0) {
    const best = candidates[0];
    return { code: best.hsCode, description: best.description, method: "AUTO_CLASSIFICATION" };
  }

  // Fallback by fuel type
  if (input.vehicle.fuelType === "ELECTRIC") {
    return { code: "8703.80", description: "Electric passenger vehicles (fallback)", method: "FUEL_TYPE_FALLBACK" };
  }
  return { code: "8703.23", description: "Passenger motor cars 1500–3000cc (fallback)", method: "FUEL_TYPE_FALLBACK" };
}
