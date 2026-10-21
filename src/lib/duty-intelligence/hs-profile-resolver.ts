import { normalizeHsCode } from "@/lib/duty-assessment/identity";

import { inferEngineCcFromText } from "./engine-cc";
import { engineError } from "./errors";

export type ClassificationInput = {
  hsCode?: string;
  hsCodeOverride?: string;
  fuelType: string;
  engineCc?: number;
  powerKw?: number;
  vehicleCategory?: string;
  manufactureYear: number;
  make?: string;
  model?: string;
};

export type HsProfileResolution = {
  hsCode: string;
  hsCodeNormalized: string;
  profileId: string;
  method: "ADMIN_OVERRIDE" | "EXACT_HS" | "HEADING_FUEL" | "CATEGORY_FUEL" | "FALLBACK";
  confidence: "VERY_HIGH" | "HIGH" | "MEDIUM" | "LOW";
  description: string;
};

export const VERIFIED_ICE_PROFILE_ID = "GH-HS-870323-VERIFIED-V1";
export const VERIFIED_EV_PROFILE_ID = "GH-HS-870380-VERIFIED-V1";
export const GENERAL_PASSENGER_PROFILE_ID = "GH-HS-8703-GENERAL-V1";

const EXACT_HS_PROFILES: Record<string, { profileId: string; description: string }> = {
  "870323": { profileId: VERIFIED_ICE_PROFILE_ID, description: "Passenger ICE 1500–3000cc. Jetour-calibrated profile" },
  "8703.23": { profileId: VERIFIED_ICE_PROFILE_ID, description: "Passenger ICE 1500–3000cc. Jetour-calibrated profile" },
  "870380": { profileId: VERIFIED_EV_PROFILE_ID, description: "Electric passenger. BYD Sealion 6 calibrated profile" },
  "8703.80": { profileId: VERIFIED_EV_PROFILE_ID, description: "Electric passenger. BYD Sealion 6 calibrated profile" },
};

type InferredHeading = {
  digits: string;
  dotted: string;
  description: string;
};

function normalizeFuel(fuelType: string): string {
  const fuel = fuelType.trim().toUpperCase();
  if (fuel === "GASOLINE_PETROL") return "GASOLINE";
  if (fuel === "GASOLINE_DIESEL") return "DIESEL";
  return fuel;
}

function resolveEngineCc(input: ClassificationInput): number | undefined {
  if (input.engineCc != null && input.engineCc > 0) return input.engineCc;
  return inferEngineCcFromText(input.make, input.model);
}

function inferHeading(input: ClassificationInput): InferredHeading {
  const fuel = normalizeFuel(input.fuelType);
  const cc = resolveEngineCc(input);
  const diesel = fuel === "DIESEL";

  if (fuel === "ELECTRIC") {
    return { digits: "870380", dotted: "8703.80", description: "Electric passenger vehicles (HS 8703.80)" };
  }
  if (fuel === "PLUGIN_HYBRID") {
    return diesel
      ? { digits: "870370", dotted: "8703.70", description: "Plug-in hybrid diesel passenger vehicles (HS 8703.70)" }
      : { digits: "870360", dotted: "8703.60", description: "Plug-in hybrid petrol passenger vehicles (HS 8703.60)" };
  }
  if (fuel === "HYBRID") {
    return diesel
      ? { digits: "870350", dotted: "8703.50", description: "Hybrid diesel passenger vehicles (HS 8703.50)" }
      : { digits: "870340", dotted: "8703.40", description: "Hybrid petrol passenger vehicles (HS 8703.40)" };
  }
  if (diesel) {
    if (cc != null && cc <= 1500) {
      return { digits: "870331", dotted: "8703.31", description: "Diesel passenger vehicles ≤1500cc (HS 8703.31)" };
    }
    if (cc != null && cc <= 2500) {
      return { digits: "870332", dotted: "8703.32", description: "Diesel passenger vehicles 1500–2500cc (HS 8703.32)" };
    }
    if (cc != null) {
      return { digits: "870333", dotted: "8703.33", description: "Diesel passenger vehicles >2500cc (HS 8703.33)" };
    }
    return { digits: "870332", dotted: "8703.32", description: "Diesel passenger vehicles (HS 8703.32 planning default)" };
  }

  if (cc != null && cc <= 1000) {
    return { digits: "870321", dotted: "8703.21", description: "Petrol passenger vehicles ≤1000cc (HS 8703.21)" };
  }
  if (cc != null && cc <= 1500) {
    return { digits: "870322", dotted: "8703.22", description: "Petrol passenger vehicles 1000–1500cc (HS 8703.22)" };
  }
  if (cc != null && cc <= 3000) {
    return { digits: "870323", dotted: "8703.23", description: "Petrol passenger vehicles 1500–3000cc (HS 8703.23)" };
  }
  if (cc != null) {
    return { digits: "870324", dotted: "8703.24", description: "Petrol passenger vehicles >3000cc (HS 8703.24)" };
  }
  return { digits: "870323", dotted: "8703.23", description: "Petrol passenger vehicles (HS 8703.23 planning default)" };
}

function profileForDigits(digits: string): { profileId: string; verified: boolean } {
  if (digits === "870380") return { profileId: VERIFIED_EV_PROFILE_ID, verified: true };
  if (digits === "870323") return { profileId: VERIFIED_ICE_PROFILE_ID, verified: true };
  return { profileId: GENERAL_PASSENGER_PROFILE_ID, verified: false };
}

function resolutionFromHeading(
  heading: InferredHeading,
  method: HsProfileResolution["method"],
  confidence: HsProfileResolution["confidence"],
  hsCode = heading.dotted,
): HsProfileResolution {
  const profile = profileForDigits(heading.digits);
  return {
    hsCode,
    hsCodeNormalized: heading.dotted,
    profileId: profile.profileId,
    method,
    confidence,
    description: heading.description,
  };
}

export function resolveHsProfile(input: ClassificationInput): HsProfileResolution | null {
  if (!input.fuelType && !input.hsCode && !input.hsCodeOverride) return null;

  if (input.hsCodeOverride) {
    const normalized = normalizeHsCode(input.hsCodeOverride);
    const digits = normalized.replace(/\D/g, "");
    const profile = EXACT_HS_PROFILES[digits] ?? EXACT_HS_PROFILES[normalized];
    if (profile) {
      return {
        hsCode: input.hsCodeOverride,
        hsCodeNormalized: normalized.includes(".") ? normalized : headingDots(digits) ?? normalized,
        profileId: profile.profileId,
        method: "ADMIN_OVERRIDE",
        confidence: "VERY_HIGH",
        description: profile.description,
      };
    }
    const inferred = inferHeading(input);
    return {
      hsCode: input.hsCodeOverride,
      hsCodeNormalized: headingDots(digits) ?? inferred.dotted,
      profileId: GENERAL_PASSENGER_PROFILE_ID,
      method: "ADMIN_OVERRIDE",
      confidence: "MEDIUM",
      description: `Admin HS ${normalized}. Ghana passenger rates applied for planning.`,
    };
  }

  if (input.hsCode) {
    const normalized = normalizeHsCode(input.hsCode);
    const digits = normalized.replace(/\D/g, "").slice(0, 6);
    const profile = EXACT_HS_PROFILES[digits] ?? EXACT_HS_PROFILES[normalized];
    if (profile) {
      return {
        hsCode: input.hsCode,
        hsCodeNormalized: normalized.includes(".") ? normalized : headingDots(digits) ?? normalized,
        profileId: profile.profileId,
        method: "EXACT_HS",
        confidence: "VERY_HIGH",
        description: profile.description,
      };
    }
    if (digits.startsWith("8703") && digits.length >= 6) {
      const inferred = inferHeading(input);
      const hasSpec = resolveEngineCc(input) != null || normalizeFuel(input.fuelType) === "ELECTRIC";
      const heading = hasSpec && inferred.digits !== digits ? inferred : {
        digits,
        dotted: headingDots(digits) ?? normalized,
        description: `HS ${headingDots(digits) ?? normalized}. Ghana passenger duty lines applied for planning.`,
      };
      const mapped = profileForDigits(heading.digits);
      return {
        hsCode: heading.dotted,
        hsCodeNormalized: heading.dotted,
        profileId: mapped.profileId,
        method: "HEADING_FUEL",
        confidence: hasSpec ? "HIGH" : "MEDIUM",
        description: heading.description,
      };
    }
  }

  const heading = inferHeading(input);
  const cc = resolveEngineCc(input);
  if (heading.digits === "870380") {
    return resolutionFromHeading(heading, "CATEGORY_FUEL", "HIGH");
  }
  if (heading.digits === "870323" && cc != null && cc > 1500 && cc <= 3000) {
    return resolutionFromHeading(heading, "CATEGORY_FUEL", "HIGH");
  }
  return resolutionFromHeading(heading, cc != null ? "CATEGORY_FUEL" : "FALLBACK", cc != null ? "HIGH" : "MEDIUM");
}

function headingDots(digits: string): string | undefined {
  if (digits.length < 6) return undefined;
  return `${digits.slice(0, 4)}.${digits.slice(4, 6)}`;
}

export function requireHsProfile(input: ClassificationInput): HsProfileResolution {
  const resolved = resolveHsProfile(input);
  if (!resolved) {
    throw engineError("NEEDS_CLASSIFICATION", "Unable to resolve HS code profile. Provide fuel type and engine capacity.", {
      missingFields: ["fuelType", "engineCc"],
    });
  }
  return resolved;
}
