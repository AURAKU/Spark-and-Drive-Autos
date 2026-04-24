type PartMatchConfidenceLabel = "VERIFIED_MATCH" | "LIKELY_MATCH" | "NEEDS_VERIFICATION" | string;

/** User-facing confidence tier — never implies manufacturer guarantee of fit. */
export function partsFinderConfidenceTitle(label: PartMatchConfidenceLabel): string {
  switch (label) {
    case "VERIFIED_MATCH":
      return "Verified match";
    case "LIKELY_MATCH":
      return "Likely match";
    case "NEEDS_VERIFICATION":
      return "Needs verification";
    default:
      return String(label).replace(/_/g, " ");
  }
}
