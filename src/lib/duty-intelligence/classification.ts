import type { DutyVehicleCategory } from "@prisma/client";

import { computeVehicleAgeYears } from "./vehicle-age";

export type VehicleClassification = {
  category: DutyVehicleCategory | null;
  ageYears: number;
  commercial: boolean;
  fuelType: string;
  profile: string;
  engineCc?: number;
  powerKw?: number;
};

export function classifyVehicleInput(params: {
  vehicleCategory?: string;
  fuelType: string;
  engineCc?: number;
  powerKw?: number;
  manufactureYear: number;
  assessmentDate: Date;
}): VehicleClassification {
  const ageYears = computeVehicleAgeYears(params.manufactureYear, params.assessmentDate);
  const commercial = params.vehicleCategory === "TRUCK" || params.vehicleCategory === "BUS" || params.vehicleCategory === "PICKUP";

  let profile = "Standard Passenger Profile";
  if (params.fuelType === "ELECTRIC") profile = "EV Profile";
  else if (params.fuelType === "HYBRID" || params.fuelType === "PLUGIN_HYBRID") profile = "Hybrid Profile";
  else if (params.engineCc != null) {
    if (params.engineCc <= 1500) profile = "Category A (≤1500cc)";
    else if (params.engineCc <= 3000) profile = "Category B (1500–3000cc)";
    else profile = "Category C (>3000cc)";
  }

  return {
    category: (params.vehicleCategory as DutyVehicleCategory) ?? null,
    ageYears,
    commercial,
    fuelType: params.fuelType,
    profile,
    engineCc: params.engineCc,
    powerKw: params.powerKw,
  };
}
