export function PolicyVersionBadge({ version }: { version: string }) {
  return <span className="inline-flex rounded-full border border-border px-2 py-0.5 font-mono text-[11px]">v{version}</span>;
}
