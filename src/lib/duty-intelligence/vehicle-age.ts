export function computeVehicleAgeYears(manufactureYear: number, referenceDate: Date): number {
  const refYear = referenceDate.getUTCFullYear();
  return Math.max(0, refYear - manufactureYear);
}
