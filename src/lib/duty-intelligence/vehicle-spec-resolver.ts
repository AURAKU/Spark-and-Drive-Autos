import { prisma } from "@/lib/prisma";
import { decodeVin, type DecodedVin } from "@/lib/vin";

import type { MinimumIntakeInput } from "./intake-schema";

export type VehicleSpecField =
  | "year"
  | "fuelType"
  | "engineCc"
  | "powerKw"
  | "vehicleCategory"
  | "countryOfOrigin"
  | "make"
  | "model";

export type ResolvedVehicleSpec = {
  make: string;
  model: string;
  year: number;
  fuelType: string;
  engineCc?: number;
  powerKw?: number;
  vehicleCategory?: string;
  countryOfOrigin?: string;
  vin?: string;
  hsCode?: string;
  source: "INVENTORY" | "VEHICLE_PROFILE" | "VIN_DECODER" | "CATALOGUE" | "CUSTOMER" | "NEEDS_VERIFICATION";
  confidence: "HIGH" | "MEDIUM" | "LOW";
  inferredFields: Partial<Record<VehicleSpecField, { value: string | number; source: string }>>;
  needsConfirmation: VehicleSpecField[];
  catalogueMatchId?: string;
  inventoryCarId?: string;
  vehicleProfileId?: string;
};

function normalizeMake(value: string): string {
  return value.trim().toLowerCase();
}

function mapVinFuelToEngineType(fuel: string | null): string | undefined {
  if (!fuel) return undefined;
  const lower = fuel.toLowerCase();
  if (lower.includes("electric") || lower.includes("ev")) return "ELECTRIC";
  if (lower.includes("diesel")) return "GASOLINE_DIESEL";
  if (lower.includes("hybrid")) return "HYBRID";
  if (lower.includes("gas") || lower.includes("petrol")) return "GASOLINE_PETROL";
  return undefined;
}

function parseEngineCc(engine: string | null): number | undefined {
  if (!engine) return undefined;
  const match = engine.match(/(\d+(?:\.\d+)?)\s*L/i);
  if (match) return Math.round(Number(match[1]) * 1000);
  const ccMatch = engine.match(/(\d{3,5})\s*cc/i);
  if (ccMatch) return Number(ccMatch[1]);
  return undefined;
}

function buildFromVin(decoded: DecodedVin): Partial<ResolvedVehicleSpec> {
  const fuelType = mapVinFuelToEngineType(decoded.fuelType);
  const engineCc = parseEngineCc(decoded.engine);
  return {
    make: decoded.make ?? undefined,
    model: decoded.model ?? undefined,
    year: decoded.year ?? undefined,
    fuelType,
    engineCc,
    vin: decoded.vin,
  };
}

async function resolveFromInventory(carId: string): Promise<Partial<ResolvedVehicleSpec> | null> {
  const car = await prisma.car.findUnique({
    where: { id: carId },
    select: {
      id: true,
      brand: true,
      model: true,
      year: true,
      vin: true,
      engineType: true,
      specifications: true,
      sourceType: true,
    },
  });
  if (!car) return null;

  const specs = car.specifications && typeof car.specifications === "object" && !Array.isArray(car.specifications)
    ? (car.specifications as Record<string, string>)
    : {};

  const engineCcRaw = specs["Engine Capacity"] ?? specs["Engine CC"] ?? specs["Displacement"];
  const engineCc = engineCcRaw ? Number(String(engineCcRaw).replace(/[^\d.]/g, "")) : undefined;

  return {
    inventoryCarId: car.id,
    make: car.brand,
    model: car.model,
    year: car.year,
    fuelType: car.engineType,
    engineCc: Number.isFinite(engineCc) && engineCc! > 0 ? engineCc : undefined,
    countryOfOrigin: car.sourceType === "IN_CHINA" ? "CHINA" : undefined,
    vin: car.vin ?? undefined,
    source: "INVENTORY",
    confidence: "HIGH",
  };
}

async function resolveFromVehicleProfile(params: {
  make: string;
  model: string;
  year: number;
}): Promise<Partial<ResolvedVehicleSpec> | null> {
  const profile = await prisma.dutyVehicleProfile.findFirst({
    where: {
      make: { equals: params.make, mode: "insensitive" },
      model: { equals: params.model, mode: "insensitive" },
      manufactureYear: params.year,
    },
    orderBy: { updatedAt: "desc" },
  });
  if (!profile) return null;

  return {
    vehicleProfileId: profile.id,
    make: profile.make,
    model: profile.model,
    year: profile.manufactureYear,
    fuelType: profile.fuelType,
    engineCc: profile.engineCc ?? undefined,
    powerKw: profile.powerKw != null ? Number(profile.powerKw) : undefined,
    vehicleCategory: profile.vehicleCategory ?? undefined,
    countryOfOrigin: profile.countryOfOrigin ?? undefined,
    hsCode: profile.hsCode,
    source: "VEHICLE_PROFILE",
    confidence: "HIGH",
  };
}

async function resolveFromCatalogue(params: {
  make: string;
  model: string;
}): Promise<Partial<ResolvedVehicleSpec> | null> {
  const row = await prisma.dutyVerifiedImport.findFirst({
    where: {
      status: "VERIFIED",
      manufacturer: { equals: params.make, mode: "insensitive" },
      model: { equals: params.model, mode: "insensitive" },
    },
    orderBy: { verifiedAt: "desc" },
    select: {
      id: true,
      manufacturer: true,
      model: true,
      year: true,
      fuelType: true,
      engineCc: true,
      vehicleCategory: true,
      countryOfOrigin: true,
      hsCode: true,
    },
  });
  if (!row) return null;

  return {
    catalogueMatchId: row.id,
    make: row.manufacturer ?? params.make,
    model: row.model ?? params.model,
    year: row.year ?? undefined,
    fuelType: row.fuelType ?? undefined,
    engineCc: row.engineCc ?? undefined,
    vehicleCategory: row.vehicleCategory ?? undefined,
    countryOfOrigin: row.countryOfOrigin ?? undefined,
    hsCode: row.hsCode ?? undefined,
    source: "CATALOGUE",
    confidence: "MEDIUM",
  };
}

export async function resolveVehicleSpec(params: {
  input: MinimumIntakeInput;
  vinDecodeEnabled?: boolean;
}): Promise<ResolvedVehicleSpec> {
  const customer = params.input.vehicle;
  const inferredFields: ResolvedVehicleSpec["inferredFields"] = {};
  const needsConfirmation: VehicleSpecField[] = [];

  let merged: Partial<ResolvedVehicleSpec> = {
    make: customer.manufacturer,
    model: customer.model,
    year: customer.year,
    fuelType: customer.fuelType,
    engineCc: customer.engineCc,
    powerKw: customer.powerKw,
    vehicleCategory: customer.vehicleCategory,
    countryOfOrigin: customer.countryOfOrigin,
    vin: customer.vin,
    source: "CUSTOMER",
    confidence: "MEDIUM",
  };

  if (params.input.carId) {
    const inventory = await resolveFromInventory(params.input.carId);
    if (inventory) {
      merged = { ...inventory, ...pickCustomerOverrides(customer, merged) };
      for (const [field, value] of Object.entries(inventory)) {
        if (value != null && field in customer === false) {
          inferredFields[field as VehicleSpecField] = { value: value as string | number, source: "inventory" };
        }
      }
    }
  }

  const profile = await resolveFromVehicleProfile({
    make: merged.make ?? customer.manufacturer,
    model: merged.model ?? customer.model,
    year: merged.year ?? customer.year,
  });
  if (profile) {
    merged = mergeSpec(merged, profile, inferredFields, "vehicle_profile");
  }

  if (customer.vin && params.vinDecodeEnabled !== false) {
    try {
      const decoded = await decodeVin(customer.vin);
      const fromVin = buildFromVin(decoded);
      merged = mergeSpec(merged, { ...fromVin, source: "VIN_DECODER", confidence: decoded.confidence === "high" ? "HIGH" : "MEDIUM" }, inferredFields, "vin_decoder");
    } catch {
      // VIN decode failure — keep customer values
    }
  }

  const catalogue = await resolveFromCatalogue({
    make: merged.make ?? customer.manufacturer,
    model: merged.model ?? customer.model,
  });
  if (catalogue) {
    merged = mergeSpec(merged, catalogue, inferredFields, "catalogue");
  }

  const confirmed = new Set(params.input.vehicle.confirmedFields ?? []);

  for (const field of ["year", "fuelType", "engineCc", "powerKw", "vehicleCategory", "countryOfOrigin"] as VehicleSpecField[]) {
    if (inferredFields[field] && !confirmed.has(field)) {
      needsConfirmation.push(field);
    }
  }

  if (!merged.make || !merged.model || !merged.year || !merged.fuelType) {
    return {
      make: merged.make ?? customer.manufacturer,
      model: merged.model ?? customer.model,
      year: merged.year ?? customer.year,
      fuelType: merged.fuelType ?? customer.fuelType,
      engineCc: merged.engineCc,
      powerKw: merged.powerKw,
      vehicleCategory: merged.vehicleCategory,
      countryOfOrigin: merged.countryOfOrigin,
      vin: merged.vin,
      hsCode: merged.hsCode,
      source: "NEEDS_VERIFICATION",
      confidence: "LOW",
      inferredFields,
      needsConfirmation,
      inventoryCarId: merged.inventoryCarId,
      vehicleProfileId: merged.vehicleProfileId,
      catalogueMatchId: merged.catalogueMatchId,
    };
  }

  return {
    make: merged.make,
    model: merged.model,
    year: merged.year,
    fuelType: merged.fuelType,
    engineCc: merged.engineCc,
    powerKw: merged.powerKw,
    vehicleCategory: merged.vehicleCategory,
    countryOfOrigin: merged.countryOfOrigin,
    vin: merged.vin,
    hsCode: merged.hsCode,
    source: merged.source ?? "CUSTOMER",
    confidence: merged.confidence ?? "MEDIUM",
    inferredFields,
    needsConfirmation,
    inventoryCarId: merged.inventoryCarId,
    vehicleProfileId: merged.vehicleProfileId,
    catalogueMatchId: merged.catalogueMatchId,
  };
}

function pickCustomerOverrides(
  customer: MinimumIntakeInput["vehicle"],
  existing: Partial<ResolvedVehicleSpec>,
): Partial<ResolvedVehicleSpec> {
  return {
    engineCc: customer.engineCc ?? existing.engineCc,
    powerKw: customer.powerKw ?? existing.powerKw,
    vehicleCategory: customer.vehicleCategory ?? existing.vehicleCategory,
    countryOfOrigin: customer.countryOfOrigin ?? existing.countryOfOrigin,
    fuelType: customer.fuelType ?? existing.fuelType,
    year: customer.year ?? existing.year,
  };
}

function mergeSpec(
  base: Partial<ResolvedVehicleSpec>,
  overlay: Partial<ResolvedVehicleSpec>,
  inferredFields: ResolvedVehicleSpec["inferredFields"],
  sourceLabel: string,
): Partial<ResolvedVehicleSpec> {
  const next = { ...base };
  for (const [key, value] of Object.entries(overlay)) {
    if (value == null || key === "source" || key === "confidence") continue;
    const existing = (next as Record<string, unknown>)[key];
    if (existing == null) {
      (next as Record<string, unknown>)[key] = value;
      if (key in inferredFields === false && ["make", "model", "year", "fuelType", "engineCc", "powerKw", "vehicleCategory", "countryOfOrigin"].includes(key)) {
        inferredFields[key as VehicleSpecField] = { value: value as string | number, source: sourceLabel };
      }
    }
  }
  if ((overlay.confidence === "HIGH" && base.confidence !== "HIGH") || !base.source) {
    next.source = overlay.source ?? base.source;
    next.confidence = overlay.confidence ?? base.confidence;
  }
  return next;
}

export function vehicleSpecToIntakeVehicle(
  spec: ResolvedVehicleSpec,
  purchase: MinimumIntakeInput["purchase"],
): MinimumIntakeInput["vehicle"] & { manufacturer: string } {
  return {
    manufacturer: spec.make,
    model: spec.model,
    year: spec.year,
    fuelType: spec.fuelType as MinimumIntakeInput["vehicle"]["fuelType"],
    engineCc: spec.engineCc,
    powerKw: spec.powerKw,
    vehicleCategory: spec.vehicleCategory as MinimumIntakeInput["vehicle"]["vehicleCategory"],
    countryOfOrigin: spec.countryOfOrigin as MinimumIntakeInput["vehicle"]["countryOfOrigin"],
    vin: spec.vin,
  };
}
