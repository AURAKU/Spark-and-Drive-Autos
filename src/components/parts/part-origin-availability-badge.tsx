import { type Part } from "@prisma/client";

import { cn } from "@/lib/utils";
import { partOriginAvailabilityUi } from "@/lib/part-origin-availability";

type Props = {
  part: Pick<Part, "origin" | "stockStatus">;
  className?: string;
};

export function PartOriginAvailabilityBadge({ part, className }: Props) {
  const { label, className: tone } = partOriginAvailabilityUi(part);
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold leading-tight tracking-wide shadow-sm backdrop-blur-sm",
        tone,
        className,
      )}
    >
      {label}
    </span>
  );
}
