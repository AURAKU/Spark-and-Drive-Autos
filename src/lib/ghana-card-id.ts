/** Normalize Ghana Card ID for storage and uniqueness checks (trim, collapse spaces, uppercase). */
export function normalizeGhanaCardId(input: string | null | undefined): string | null {
  if (input == null) return null;
  const collapsed = input.trim().replace(/\s+/g, "");
  if (!collapsed) return null;
  return collapsed.toUpperCase();
}
