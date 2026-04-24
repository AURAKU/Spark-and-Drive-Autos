import type { VehicleQueryPayload } from "@/lib/parts-finder/identifier-crypto";
import type { PartSymptom, PositionQualifier, RetrievalReadyQuery } from "@/lib/parts-finder/search-types";

export type NormalizedPartsQuery = {
  /** Single-line vehicle description for web queries. */
  vehicleLine: string;
  /** Part keywords from user (may be empty). */
  partIntent: string;
  partIntentCanonical: string | null;
  partIntentTokens: string[];
  expandedIntentTerms: string[];
  imageHints: string[];
  qualifiers: PositionQualifier[];
  symptoms: PartSymptom[];
  retrieval: RetrievalReadyQuery;
  vinTail: string | null;
  chassisTail: string | null;
  brand: string | null;
  model: string | null;
  year: number | null;
  engine: string | null;
  trim: string | null;
};

const QUALIFIER_PATTERNS: Array<{ qualifier: PositionQualifier; pattern: RegExp }> = [
  { qualifier: "LEFT", pattern: /\bleft\b|\blh\b|\bdriver side\b/i },
  { qualifier: "RIGHT", pattern: /\bright\b|\brh\b|\bpassenger side\b/i },
  { qualifier: "FRONT", pattern: /\bfront\b|\bforward\b/i },
  { qualifier: "REAR", pattern: /\brear\b|\bback\b/i },
  { qualifier: "UPPER", pattern: /\bupper\b|\btop\b/i },
  { qualifier: "LOWER", pattern: /\blower\b|\bbottom\b/i },
];

const SYMPTOM_PATTERNS: Array<{ symptom: PartSymptom; pattern: RegExp }> = [
  { symptom: "NOISE", pattern: /\bnoise\b|\bclunk\b|\bsqueak\b|\bgrind/i },
  { symptom: "VIBRATION", pattern: /\bvibration\b|\bshudder\b|\bshake\b/i },
  { symptom: "LEAK", pattern: /\bleak\b|\bdrip\b|\bfluid loss\b/i },
  { symptom: "ROUGH_IDLE", pattern: /\brough idle\b|\bidle issue\b|\bstalling\b/i },
  { symptom: "OVERHEATING", pattern: /\boverheat\b|\boverheating\b|\bhigh temp\b/i },
];

const PART_SYNONYM_GROUPS: Record<string, string[]> = {
  brake_pad: ["brake pad", "brake pads", "pad set"],
  brake_rotor: ["brake rotor", "brake disc", "disc rotor"],
  spark_plug: ["spark plug", "plug", "ignition plug"],
  control_arm: ["control arm", "wishbone", "suspension arm"],
  wheel_bearing: ["wheel bearing", "hub bearing", "bearing"],
  radiator: ["radiator", "cooling radiator", "coolant radiator"],
  water_pump: ["water pump", "coolant pump"],
  engine_mount: ["engine mount", "motor mount"],
  fuel_pump: ["fuel pump", "petrol pump"],
  cv_joint: ["cv joint", "drive shaft joint", "axle joint"],
  fuel_injector: ["injector", "fuel injector", "injection nozzle"],
  ignition_coil: ["ignition coil", "coil pack"],
  thermostat: ["thermostat", "coolant thermostat"],
  timing_chain: ["timing chain", "timing kit", "cam timing chain"],
};

function cleanFreeText(v: string): string {
  return v
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(v: string): string[] {
  return [...new Set(cleanFreeText(v).split(/\s+/g).filter((t) => t.length > 1))];
}

function imageHintsFromFileName(fileName: string | undefined): string[] {
  const raw = (fileName ?? "").trim().toLowerCase();
  if (!raw) return [];
  const stem = raw.replace(/\.[a-z0-9]+$/i, "");
  return tokenize(stem).slice(0, 8);
}

function detectQualifiers(text: string): PositionQualifier[] {
  return QUALIFIER_PATTERNS.filter((entry) => entry.pattern.test(text)).map((entry) => entry.qualifier);
}

function detectSymptoms(text: string): PartSymptom[] {
  return SYMPTOM_PATTERNS.filter((entry) => entry.pattern.test(text)).map((entry) => entry.symptom);
}

function resolveCanonicalPartIntent(text: string): { canonical: string | null; expanded: string[] } {
  const cleaned = cleanFreeText(text);
  for (const [canonical, synonyms] of Object.entries(PART_SYNONYM_GROUPS)) {
    if (synonyms.some((term) => cleaned.includes(term))) {
      return {
        canonical,
        expanded: synonyms,
      };
    }
  }
  return {
    canonical: null,
    expanded: [],
  };
}

function withSymptomExpansion(symptoms: PartSymptom[]): string[] {
  const expansions: Record<PartSymptom, string[]> = {
    NOISE: ["clunk", "rattle", "squeal", "grind"],
    VIBRATION: ["shake", "shudder", "wobble"],
    LEAK: ["oil leak", "coolant leak", "fluid leak"],
    ROUGH_IDLE: ["misfire", "unstable idle", "stalling"],
    OVERHEATING: ["high temp", "cooling issue", "overheat"],
  };
  return [...new Set(symptoms.flatMap((symptom) => expansions[symptom] ?? []))];
}

/**
 * Turns raw user input into structured fields used for external search strings (no PII beyond what user typed).
 */
export function normalizePartsQuery(payload: VehicleQueryPayload): NormalizedPartsQuery {
  const vin = payload.vin?.trim() ?? "";
  const chassis = payload.chassis?.trim() ?? "";
  const brand = payload.brand?.trim() ?? "";
  const model = payload.model?.trim() ?? "";
  const yearRaw = payload.year;
  const year =
    typeof yearRaw === "number"
      ? yearRaw
      : typeof yearRaw === "string"
        ? Number.parseInt(yearRaw, 10) || null
        : null;
  const engine = payload.engine?.trim() ?? "";
  const trim = payload.trim?.trim() ?? "";
  const desc = payload.partDescription?.trim() ?? "";
  const imageHints = imageHintsFromFileName(payload.partImage?.fileName);

  const vinTail = vin.length >= 6 ? vin.slice(-8).toUpperCase() : vin ? vin.toUpperCase() : null;
  const chassisTail =
    chassis.length >= 4 ? chassis.slice(-12).toUpperCase() : chassis ? chassis.toUpperCase() : null;

  const vehicleParts = [brand, model, year ? String(year) : "", engine, trim].filter(Boolean);
  const vehicleLine = vehicleParts.length ? vehicleParts.join(" ") : "";

  const partIntent = desc;
  const partIntentTokens = tokenize(partIntent);
  const qualifiers = detectQualifiers(partIntent);
  const symptoms = detectSymptoms(partIntent);
  const canonical = resolveCanonicalPartIntent(partIntent);
  const symptomTerms = withSymptomExpansion(symptoms);
  const expandedIntentTerms = [...new Set([...canonical.expanded, ...partIntentTokens, ...imageHints, ...symptomTerms])].slice(0, 24);

  return {
    vehicleLine,
    partIntent,
    partIntentCanonical: canonical.canonical,
    partIntentTokens,
    expandedIntentTerms,
    imageHints,
    qualifiers,
    symptoms,
    retrieval: {
      identifier: {
        vinTail: vinTail || null,
        chassisTail: chassisTail || null,
      },
      vehicle: {
        brand: brand || null,
        model: model || null,
        year,
        engine: engine || null,
        trim: trim || null,
      },
      intent: {
        rawDescription: partIntent,
        canonicalPart: canonical.canonical,
        tokens: partIntentTokens,
        expandedTerms: expandedIntentTerms,
        imageHints,
        qualifiers,
        symptoms,
      },
    },
    vinTail: vinTail || null,
    chassisTail: chassisTail || null,
    brand: brand || null,
    model: model || null,
    year,
    engine: engine || null,
    trim: trim || null,
  };
}

/** Builds web search query strings (never logs raw full VIN to external title in MVP — use tails + vehicle line). */
export function buildExternalSearchQueries(n: NormalizedPartsQuery): string[] {
  const queries: string[] = [];
  const part = n.partIntent ? ` ${n.partIntent}` : "";
  const coreVehicle = [n.brand, n.model, n.year ? String(n.year) : ""].filter(Boolean).join(" ");
  const qualifierText = n.qualifiers.join(" ").toLowerCase();
  const symptomText = n.symptoms.join(" ").toLowerCase();
  const expandedTerms = n.expandedIntentTerms.join(" ");

  if (coreVehicle) {
    queries.push(`${coreVehicle} OEM part${part} ${qualifierText}`.trim());
    queries.push(`${coreVehicle} aftermarket replacement${part} ${qualifierText}`.trim());
    if (symptomText) {
      queries.push(`${coreVehicle} ${symptomText} likely failed part`);
    }
  }
  if (n.vinTail && n.partIntent) {
    queries.push(`VIN ending ${n.vinTail} ${n.partIntent} ${expandedTerms}`.trim());
  }
  if (n.chassisTail && n.partIntent) {
    queries.push(`chassis ${n.chassisTail} ${n.partIntent} ${expandedTerms}`.trim());
  }
  if (queries.length === 0 && (n.partIntent || n.brand || n.model)) {
    queries.push(`${[n.brand, n.model, n.year, n.partIntent, expandedTerms].filter(Boolean).join(" ")} auto part`);
  }
  if (queries.length === 0) {
    queries.push(`automotive spare parts ${n.partIntent || "replacement"}`);
  }

  return [...new Set(queries)].slice(0, 5);
}
