export function isCalibrationEligible(notes: string | null | undefined): boolean {
  return (notes ?? "").includes("[calibration:eligible]");
}

export function stripCalibrationTags(notes: string | null | undefined): string {
  return (notes ?? "")
    .split("\n")
    .filter((line) => !line.startsWith("[calibration:"))
    .join("\n")
    .trim();
}
