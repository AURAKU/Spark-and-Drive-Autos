export function AcceptedPolicyBadge({ accepted }: { accepted: boolean }) {
  return (
    <span
      className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
        accepted ? "border-emerald-500/35 text-emerald-500" : "border-amber-500/35 text-amber-500"
      }`}
    >
      {accepted ? "Accepted" : "Pending"}
    </span>
  );
}
