type Props = {
  /** Messages from `parseCarSummaryForAutofill` / `parsePartSummaryForAutofill` (unknown labels, caveats). */
  items: string[];
};

export function AutofillUnmappedHint({ items }: Props) {
  const unique = [...new Set(items.map((s) => s.trim()).filter(Boolean))];
  if (!unique.length) return null;

  return (
    <div
      className="mt-3 rounded-lg border border-amber-500/25 bg-amber-500/5 px-3 py-2 text-xs text-amber-50/95"
      role="status"
    >
      <p className="font-medium text-amber-100/90">Not mapped to a dedicated field</p>
      <ul className="mt-1.5 list-inside list-disc space-y-0.5 text-amber-50/85">
        {unique.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </div>
  );
}
