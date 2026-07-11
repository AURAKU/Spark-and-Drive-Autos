export type ProfileConflict = {
  key: string;
  make: string;
  model: string;
  manufactureYear: number;
  profileIds: string[];
  hsCodes: string[];
  fuelTypes: string[];
  reason: string;
};

type ProfileRow = {
  id: string;
  make: string;
  model: string;
  manufactureYear: number;
  hsCode: string;
  fuelType: string;
  engineCc: number | null;
  chassis: string | null;
};

/** Detect ambiguous active profiles sharing make/model/year without explicit chassis disambiguation. */
export function detectProfileConflicts(profiles: ProfileRow[]): ProfileConflict[] {
  const groups = new Map<string, ProfileRow[]>();

  for (const profile of profiles) {
    const key = `${profile.make.trim().toLowerCase()}|${profile.model.trim().toLowerCase()}|${profile.manufactureYear}`;
    const bucket = groups.get(key) ?? [];
    bucket.push(profile);
    groups.set(key, bucket);
  }

  const conflicts: ProfileConflict[] = [];

  for (const [key, rows] of groups) {
    if (rows.length < 2) continue;

    const distinctChassis = new Set(rows.map((r) => r.chassis?.trim()).filter(Boolean));
    if (distinctChassis.size === rows.length) continue;

    const hsCodes = [...new Set(rows.map((r) => r.hsCode))];
    const fuelTypes = [...new Set(rows.map((r) => r.fuelType))];

    if (hsCodes.length <= 1 && fuelTypes.length <= 1) continue;

    conflicts.push({
      key,
      make: rows[0]!.make,
      model: rows[0]!.model,
      manufactureYear: rows[0]!.manufactureYear,
      profileIds: rows.map((r) => r.id),
      hsCodes,
      fuelTypes,
      reason:
        hsCodes.length > 1 && fuelTypes.length > 1
          ? "Overlapping make/model/year with conflicting HS codes and fuel types — assign priority or disambiguate by chassis."
          : hsCodes.length > 1
            ? "Overlapping make/model/year with conflicting HS codes."
            : "Overlapping make/model/year with conflicting fuel types.",
    });
  }

  return conflicts.sort((a, b) => a.make.localeCompare(b.make));
}
