export type PartMatchConfidenceLabel = "VERIFIED_MATCH" | "LIKELY_MATCH" | "NEEDS_VERIFICATION";
export type PositionQualifier = "LEFT" | "RIGHT" | "FRONT" | "REAR" | "UPPER" | "LOWER";
export type PartSymptom = "NOISE" | "VIBRATION" | "LEAK" | "ROUGH_IDLE" | "OVERHEATING";

export type RetrievalReadyQuery = {
  identifier: {
    vinTail: string | null;
    chassisTail: string | null;
  };
  vehicle: {
    brand: string | null;
    model: string | null;
    year: number | null;
    engine: string | null;
    trim: string | null;
  };
  intent: {
    rawDescription: string;
    canonicalPart: string | null;
    tokens: string[];
    expandedTerms: string[];
    imageHints: string[];
    qualifiers: PositionQualifier[];
    symptoms: PartSymptom[];
  };
};

export type PartsFinderMembershipState =
  | "UNAUTHENTICATED"
  | "UPSELL_ONLY"
  | "INACTIVE"
  | "PENDING_PAYMENT"
  | "PENDING_APPROVAL"
  | "ACTIVE"
  | "EXPIRED"
  | "SUSPENDED";

export type PartsFinderAccessLevel = "UPSELL" | "ACTIVATION" | "SEARCH" | "RESULTS" | "ADMIN";

export type MembershipAccessSnapshot = {
  userId: string | null;
  state: PartsFinderMembershipState;
  allowActivation: boolean;
  allowSearch: boolean;
  allowResults: boolean;
  activeFrom: string | null;
  activeUntil: string | null;
  suspensionReason: string | null;
  renewalRequired: boolean;
};

export type ParsedVehicleData = {
  identifier: string | null;
  identifierKind: "VIN_OR_CHASSIS" | "NONE";
  brand: string | null;
  model: string | null;
  year: number | null;
  engine: string | null;
  trim: string | null;
  tokens: string[];
};

export type QueryForms = {
  internal: string[];
  external: string[];
  retrieval?: RetrievalReadyQuery;
};

export type ParsedSearchHit = {
  title: string;
  snippet: string;
  sourceHint: string;
  ingestionSource: "SERPER_WEB" | "FALLBACK_PREVIEW";
  thumbnailUrl: string | null;
  matchTokens: string[];
  oemReferences?: string[];
  alternateReferences?: string[];
  fitmentClues?: string[];
  description?: string | null;
  imageHints?: string[];
  sourceIdentity?: string;
  sourceUrl?: string | null;
  evidenceSignature?: string;
};

export type RankingScoreBreakdown = {
  vehicleFit: number;
  querySimilarity: number;
  oemConsistency: number;
  alternateConsistency: number;
  sourceQuality: number;
  imageRelevance: number;
  conflictsPenalty: number;
  weakContextPenalty: number;
  yearMismatchPenalty: number;
  fitmentContradictionPenalty: number;
  total: number;
};

export type ConfidenceBreakdown = {
  oemMatchConfidence: number;
  aftermarketAlternativeConfidence: number;
  fitmentConfidence: number;
  overallConfidence: number;
  label: PartMatchConfidenceLabel;
};

export type StructuredSummary = {
  headline: string;
  fitmentExplanation: string;
  oemConfidenceText: string;
  aftermarketConfidenceText: string;
  warnings: string[];
  userSafeSummary?: string;
  whyTopRanked?: string[];
  uncertaintyNotes?: string[];
};

export type ReviewStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "LOW_CONFIDENCE"
  | "VERIFIED"
  | "LIKELY"
  | "FLAGGED_SOURCING";

export type SearchPipelineResultRow = {
  candidatePartName: string;
  confidenceScore: number;
  confidenceLabel: PartMatchConfidenceLabel;
  summaryExplanation: string;
  partFunctionSummary?: string;
  fitmentNotes: string | null;
  catalogPartId: string | null;
  oemCodes: Array<{ code: string; label: string | null }>;
  fitments: Array<{
    brand: string | null;
    model: string | null;
    yearFrom: number | null;
    yearTo: number | null;
    notes: string | null;
  }>;
  images: Array<{ url: string; kind: string }>;
  ingestionSource: string;
  safetyFlagManualReview: boolean;
  metadataJson?: Record<string, unknown>;
  scoreBreakdown?: {
    vehicleFit: number;
    querySimilarity: number;
    oemConsistency: number;
    alternateConsistency: number;
    sourceQuality: number;
    imageRelevance: number;
    conflictsPenalty: number;
    weakContextPenalty: number;
    yearMismatchPenalty: number;
    fitmentContradictionPenalty: number;
    total: number;
  };
};
