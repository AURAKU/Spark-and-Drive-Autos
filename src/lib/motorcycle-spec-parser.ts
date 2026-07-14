/** Parse plain-text specs (Label: Value or Label newline Value) into structured rows. */
export type ParsedSpecRow = {
  label: string;
  value: string;
  sortOrder: number;
  groupName?: string;
  unit?: string;
};

const GROUP_PREFIX = /^\[([^\]]{1,80})\]\s*/;

/** Prefer trailing known units without inventing — only when clearly present. */
function splitValueAndUnit(rawValue: string): { value: string; unit?: string } {
  const v = rawValue.trim();
  const m = /^(.+?)\s+(cc|hp|kw|nm|kg|mm|cm|km|l|litre|liter|%)\s*$/i.exec(v);
  if (!m) return { value: v };
  return { value: m[1].trim(), unit: m[2] };
}

export function parseSpecificationsText(raw: string | null | undefined): ParsedSpecRow[] {
  if (!raw?.trim()) return [];
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const rows: ParsedSpecRow[] = [];
  let i = 0;
  let currentGroup: string | undefined;

  for (const line of lines) {
    const groupOnly = /^\[([^\]]{1,80})\]\s*$/.exec(line);
    if (groupOnly) {
      currentGroup = groupOnly[1].trim();
      continue;
    }

    const colonIdx = line.indexOf(":");
    if (colonIdx > 0 && colonIdx < line.length - 1) {
      let left = line.slice(0, colonIdx).trim();
      let groupName = currentGroup;
      const gm = GROUP_PREFIX.exec(left);
      if (gm) {
        groupName = gm[1].trim();
        left = left.slice(gm[0].length).trim();
      }
      const { value, unit } = splitValueAndUnit(line.slice(colonIdx + 1).trim());
      if (left && value) {
        rows.push({ label: left, value, unit, groupName, sortOrder: i++ });
      }
      continue;
    }
  }

  // Second pass: paired lines without colons (Label on one line, value on next)
  if (rows.length === 0) {
    for (let j = 0; j < lines.length - 1; j += 2) {
      const label = lines[j];
      const value = lines[j + 1];
      if (label && value && !label.includes(":")) {
        rows.push({ label, value, sortOrder: i++ });
      }
    }
  }

  return rows;
}

export const MOTORCYCLE_FEATURE_TAGS = [
  "ABS",
  "Keyless Start",
  "LED Lights",
  "Reverse Camera",
  "Bluetooth",
  "USB Charging",
  "Navigation",
  "Cruise Control",
  "Heated Grips",
  "Traction Control",
  "Quick Shifter",
  "Mobile App",
  "Alarm",
  "GPS",
] as const;

export const MOTORCYCLE_HIGHLIGHT_TAGS = [
  "Low Mileage",
  "One Owner",
  "Excellent Condition",
  "Original Paint",
  "Accident Free",
  "Full Service History",
  "New Battery",
  "Fast Charging",
  "Long Range",
  "Premium Edition",
  "Limited Edition",
] as const;

export const MOTORCYCLE_SPEC_GROUP_PRESETS = [
  "Engine",
  "Performance",
  "Chassis",
  "Brakes",
  "Suspension",
  "Tyres",
  "Dimensions",
  "Electric",
  "Features",
  "Other",
] as const;
