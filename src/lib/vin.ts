import { z } from "zod";

export type DecodedVin = {
  vin: string;
  year: number | null;
  make: string | null;
  model: string | null;
  trim: string | null;
  engine: string | null;
  fuelType: string | null;
  driveType: string | null;
  transmission: string | null;
  confidence: "high" | "medium" | "low";
};

const vinSchema = z
  .string()
  .trim()
  .regex(/^[A-HJ-NPR-Z0-9]{17}$/, "VIN must be 17 characters and use valid VIN format.");

function asText(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const clean = v.trim();
  if (!clean || clean === "0" || clean.toUpperCase() === "NOT APPLICABLE") return null;
  return clean;
}

export function parseVin(input: string): string {
  return vinSchema.parse(input);
}

function computeConfidence(decoded: Omit<DecodedVin, "confidence">): DecodedVin["confidence"] {
  const hasCore = Boolean(decoded.year && decoded.make && decoded.model);
  const hasEngineAndTrim = Boolean(decoded.engine && decoded.trim);
  if (hasCore && hasEngineAndTrim) return "high";
  if (hasCore && (decoded.engine || decoded.trim)) return "medium";
  return "low";
}

async function getVinRedis() {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token || !/^https:\/\//i.test(url)) return null;
  try {
    const { Redis } = await import("@upstash/redis");
    return new Redis({ url, token });
  } catch {
    return null;
  }
}

export async function decodeVin(inputVin: string): Promise<DecodedVin> {
  const vin = parseVin(inputVin);
  const redis = await getVinRedis();
  const cacheKey = `vin:${vin}`;
  if (redis) {
    try {
      const cached = await redis.get<DecodedVin>(cacheKey);
      if (cached?.vin === vin) return cached;
    } catch {
      // Ignore cache read failure and continue with provider decode.
    }
  }

  const provider = (process.env.VIN_PROVIDER ?? "nhtsa").trim().toLowerCase();
  let decoded: Omit<DecodedVin, "confidence">;
  if (provider === "mock") {
    decoded = {
      vin,
      year: 2015,
      make: "Toyota",
      model: "Corolla",
      trim: "Base",
      engine: "1.8L",
      fuelType: "Gasoline",
      driveType: "FWD",
      transmission: "Automatic",
    };
  } else {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 9000);
    try {
      const res = await fetch(
        `https://vpic.nhtsa.dot.gov/api/vehicles/decodevinvaluesextended/${encodeURIComponent(vin)}?format=json`,
        { method: "GET", signal: controller.signal, cache: "no-store" },
      );
      if (!res.ok) {
        decoded = {
          vin,
          year: null,
          make: null,
          model: null,
          trim: null,
          engine: null,
          fuelType: null,
          driveType: null,
          transmission: null,
        };
      } else {
        const json = (await res.json()) as { Results?: Array<Record<string, unknown>> };
        const row = json.Results?.[0] ?? {};
        const yearRaw = asText(row.ModelYear);
        const year = yearRaw ? Number.parseInt(yearRaw, 10) : null;
        decoded = {
          vin,
          year: Number.isFinite(year) ? year : null,
          make: asText(row.Make),
          model: asText(row.Model),
          trim: asText(row.Trim),
          engine: asText(row.EngineModel) ?? asText(row.DisplacementL),
          fuelType: asText(row.FuelTypePrimary),
          driveType: asText(row.DriveType),
          transmission: asText(row.TransmissionStyle),
        };
      }
    } catch {
      decoded = {
        vin,
        year: null,
        make: null,
        model: null,
        trim: null,
        engine: null,
        fuelType: null,
        driveType: null,
        transmission: null,
      };
    } finally {
      clearTimeout(timer);
    }
  }

  const result: DecodedVin = {
    ...decoded,
    confidence: computeConfidence(decoded),
  };
  if (redis) {
    try {
      await redis.set(cacheKey, result, { ex: 60 * 60 * 24 * 30 });
    } catch {
      // Ignore cache write failure.
    }
  }
  return result;
}
