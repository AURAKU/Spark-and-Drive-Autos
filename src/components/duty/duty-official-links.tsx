import { DUTY_OFFICIAL_LINKS } from "@/lib/duty/references";

export function DutyOfficialLinks({ compact }: { compact?: boolean }) {
  return (
    <div className={compact ? "space-y-2" : "space-y-3"}>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Confirm with official sources</p>
      <ul className={`grid gap-2 ${compact ? "sm:grid-cols-1" : "sm:grid-cols-2"}`}>
        {DUTY_OFFICIAL_LINKS.map((link) => (
          <li key={link.id}>
            <a
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="group block rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2.5 transition hover:border-[var(--brand)]/35 hover:bg-white/[0.04]"
            >
              <span className="text-sm font-medium text-[var(--brand)] group-hover:underline">{link.label}</span>
              <span className="mt-0.5 block text-xs leading-snug text-zinc-500">{link.description}</span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
