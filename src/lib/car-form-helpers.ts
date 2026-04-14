import type { Prisma } from "@prisma/client";

export function tagsToCommaList(tags: Prisma.JsonValue | null | undefined): string {
  if (tags == null) return "";
  if (Array.isArray(tags)) {
    return tags.filter((x): x is string => typeof x === "string").join(", ");
  }
  return "";
}

export function specificationsToTextarea(spec: Prisma.JsonValue | null): string {
  if (spec === null || spec === undefined) return "";
  try {
    return JSON.stringify(spec, null, 2);
  } catch {
    return "";
  }
}
