/** Parse plain-text specs (Label: Value or Label newline Value) into structured rows. */
export type ParsedSpecRow = { label: string; value: string; sortOrder: number };

export function parseSpecificationsText(raw: string | null | undefined): ParsedSpecRow[] {
  if (!raw?.trim()) return [];
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const rows: ParsedSpecRow[] = [];
  let i = 0;

  for (const line of lines) {
    const colonIdx = line.indexOf(":");
    if (colonIdx > 0 && colonIdx < line.length - 1) {
      const label = line.slice(0, colonIdx).trim();
      const value = line.slice(colonIdx + 1).trim();
      if (label && value) {
        rows.push({ label, value, sortOrder: i++ });
      }
      continue;
    }
    // "Label\nValue" pairs when colon missing — skip orphan lines
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
