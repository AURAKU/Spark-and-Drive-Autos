import { PolicyVersionBadge } from "@/components/legal/policy-version-badge";

export function PartsFinderDisclaimerNotice({ version }: { version: string }) {
  const showVersionBadge = version.trim().toLowerCase() !== "active";
  return (
    <div className="rounded-xl border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
      <p className="font-medium text-foreground">Parts Finder Notice</p>
      <p className="mt-1">
        Results are generated using automated systems, search engine assisted processing, and external data sources.{" "}
        {showVersionBadge ? <PolicyVersionBadge version={version} /> : null}
      </p>
      <p className="mt-1 text-foreground/90">Spark &amp; Drive Gear does not guarantee:</p>
      <ul className="mt-1 list-disc space-y-0.5 pl-5">
        <li>exact compatibility</li>
        <li>OEM accuracy</li>
        <li>availability</li>
      </ul>
      <p className="mt-1">
        Results are provided for guidance only.
      </p>
      <p className="mt-1">Users must verify all information before purchase or installation.</p>
      <p className="mt-1">Spark &amp; Drive Gear is not liable for damages arising from reliance on unverified results.</p>
    </div>
  );
}
