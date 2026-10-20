import { DUTY_ESTIMATE_DISCLAIMER_LONG, DUTY_ESTIMATE_DISCLAIMER_SHORT } from "@/lib/duty/disclaimer";

/** Amber disclaimer copy — readable on light amber wells and dark ink panels. */
const disclosureTone = "text-xs leading-relaxed text-amber-950 dark:text-amber-100";

export function DutyEstimateDisclosure({ variant = "short" }: { variant?: "short" | "long" }) {
  if (variant === "short") {
    return <p className={disclosureTone}>{DUTY_ESTIMATE_DISCLAIMER_SHORT}</p>;
  }
  return (
    <div className={`space-y-2 ${disclosureTone}`}>
      {DUTY_ESTIMATE_DISCLAIMER_LONG.map((p, i) => (
        <p key={i}>{p}</p>
      ))}
    </div>
  );
}
