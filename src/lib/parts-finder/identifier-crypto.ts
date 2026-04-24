export type VehicleQueryPayload = {
  vin?: string;
  chassis?: string;
  brand?: string;
  model?: string;
  year?: string | number;
  engine?: string;
  trim?: string;
  partDescription?: string;
  partImage?: {
    fileName?: string;
    mimeType?: string;
    sizeBytes?: number;
  };
};

function parseJsonPayload(raw: string): VehicleQueryPayload {
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  return {
    vin: typeof parsed.vin === "string" ? parsed.vin : undefined,
    chassis: typeof parsed.chassis === "string" ? parsed.chassis : undefined,
    brand: typeof parsed.brand === "string" ? parsed.brand : undefined,
    model: typeof parsed.model === "string" ? parsed.model : undefined,
    year: typeof parsed.year === "string" || typeof parsed.year === "number" ? parsed.year : undefined,
    engine: typeof parsed.engine === "string" ? parsed.engine : undefined,
    trim: typeof parsed.trim === "string" ? parsed.trim : undefined,
    partDescription: typeof parsed.partDescription === "string" ? parsed.partDescription : undefined,
    partImage:
      typeof parsed.partImage === "object" && parsed.partImage != null
        ? {
            fileName:
              typeof (parsed.partImage as Record<string, unknown>).fileName === "string"
                ? ((parsed.partImage as Record<string, unknown>).fileName as string)
                : undefined,
            mimeType:
              typeof (parsed.partImage as Record<string, unknown>).mimeType === "string"
                ? ((parsed.partImage as Record<string, unknown>).mimeType as string)
                : undefined,
            sizeBytes:
              typeof (parsed.partImage as Record<string, unknown>).sizeBytes === "number"
                ? ((parsed.partImage as Record<string, unknown>).sizeBytes as number)
                : undefined,
          }
        : undefined,
  };
}

export function decryptVehicleQueryPayload(payload: string): VehicleQueryPayload {
  const raw = payload?.trim();
  if (!raw) return {};

  try {
    return parseJsonPayload(raw);
  } catch {
    // Accept base64 JSON payloads from older sessions.
    const decoded = Buffer.from(raw, "base64").toString("utf8");
    return parseJsonPayload(decoded);
  }
}

export function encryptVehicleQueryPayload(payload: VehicleQueryPayload): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64");
}
