import { normalizeHsCode } from "@/lib/duty-assessment/identity";

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

const EXACT_HS_PROFILES: Record<string, { profileId: string; description: string }> = {
  "870323": { profileId: "GH-HS-870323-VERIFIED-V1", description: "Passenger ICE 1500–3000cc — Jetour-calibrated profile" },
  "8703.23": { profileId: "GH-HS-870323-VERIFIED-V1", description: "Passenger ICE 1500–3000cc — Jetour-calibrated profile" },
  "870380": { profileId: "GH-HS-870380-VERIFIED-V1", description: "Electric passenger — BYD Sealion 6 calibrated profile" },
  "8703.80": { profileId: "GH-HS-870380-VERIFIED-V1", description: "Electric passenger — BYD Sealion 6 calibrated profile" },
};

export function resolveHsProfile(input: ClassificationInput): HsProfileResolution | null {
  if (input.hsCodeOverride) {
    const normalized = normalizeHsCode(input.hsCodeOverride);
    const digits = normalized.replace(/\D/g, "");
    const profile = EXACT_HS_PROFILES[digits] ?? EXACT_HS_PROFILES[normalized];
    return {
      hsCode: input.hsCodeOverride,
      hsCodeNormalized: normalized,
      profileId: profile?.profileId ?? `GH-HS-${digits}-UNVERIFIED`,
      method: "ADMIN_OVERRIDE",
      confidence: profile ? "VERY_HIGH" : "LOW",
      description: profile?.description ?? "Admin HS override without verified profile",
    };
  }

  if (input.hsCode) {
    const normalized = normalizeHsCode(input.hsCode);
    const digits = normalized.replace(/\D/g, "");
    const profile = EXACT_HS_PROFILES[digits] ?? EXACT_HS_PROFILES[normalized];
    if (profile) {
      return {
        hsCode: input.hsCode,
        hsCodeNormalized: normalized,
        profileId: profile.profileId,
        method: "EXACT_HS",
        confidence: "VERY_HIGH",
        description: profile.description,
      };
    }
    return {
      hsCode: input.hsCode,
      hsCodeNormalized: normalized,
      profileId: `GH-HS-${digits}-UNVERIFIED`,
      method: "HEADING_FUEL",
      confidence: "LOW",
      description: `HS ${normalized} without verified calibration profile`,
    };
  }

  if (input.fuelType === "ELECTRIC") {
    return {
      hsCode: "870380",
      hsCodeNormalized: "8703.80",
      profileId: "GH-HS-870380-VERIFIED-V1",
      method: "CATEGORY_FUEL",
      confidence: "MEDIUM",
      description: "Inferred electric HS 8703.80 — verify before relying on total",
    };
  }

  if (input.engineCc != null) {
    if (input.engineCc <= 1000) {
      return null;
    }
    if (input.engineCc <= 1500) {
      return null;
    }
    if (input.engineCc <= 3000) {
      return null;
    }
  }

  return null;
}

export function requireHsProfile(input: ClassificationInput): HsProfileResolution {
  const resolved = resolveHsProfile(input);
  if (!resolved) {
    throw engineError("NEEDS_CLASSIFICATION", "Unable to resolve HS code profile. Provide HS code, fuel type, and engine capacity.", {
      missingFields: ["hsCode", "engineCc", "fuelType"],
    });
  }
  if (resolved.confidence === "LOW" && resolved.method !== "ADMIN_OVERRIDE") {
    throw engineError("NEEDS_CLASSIFICATION", "Classification confidence is insufficient for a precise duty total.", {
      details: { resolution: resolved },
      missingFields: ["hsCodeOverride"],
    });
  }
  return resolved;
}
