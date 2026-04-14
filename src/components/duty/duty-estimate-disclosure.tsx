import { DUTY_ESTIMATE_DISCLAIMER_LONG, DUTY_ESTIMATE_DISCLAIMER_SHORT } from "@/lib/duty/disclaimer";

export function DutyEstimateDisclosure({ variant = "short" }: { variant?: "short" | "long" }) {
  if (variant === "short") {
    return <p className="text-xs leading-relaxed text-amber-100/90">{DUTY_ESTIMATE_DISCLAIMER_SHORT}</p>;
  }
  return (
    <div className="space-y-2 text-xs leading-relaxed text-amber-100/85">
      {DUTY_ESTIMATE_DISCLAIMER_LONG.map((p, i) => (
        <p key={i}>{p}</p>
      ))}
    </div>
  );
}
