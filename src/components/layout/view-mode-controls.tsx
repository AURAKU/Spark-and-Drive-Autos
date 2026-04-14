"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import type { ViewModePreference } from "@/lib/view-mode";

type Props = {
  targetMode: ViewModePreference;
  redirectTo: string;
  className?: string;
  variant?: "primary" | "outline" | "ghost";
  children: React.ReactNode;
};

/**
 * Sets the view-mode cookie (server) then navigates — same session, RBAC unchanged.
 */
export function ViewModeButton({ targetMode, redirectTo, className = "", variant = "primary", children }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  async function onClick() {
    const res = await fetch("/api/view-mode", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: targetMode }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      toast.error(data.error === "Forbidden" ? "Only operations admins can switch preview mode." : "Could not update view mode.");
      return;
    }
    startTransition(() => {
      router.push(redirectTo);
      router.refresh();
    });
  }

  const base =
    variant === "primary"
      ? "bg-[var(--brand)] text-black hover:opacity-90"
      : variant === "outline"
        ? "border border-white/15 bg-white/[0.04] text-white hover:bg-white/[0.08]"
        : "text-[var(--brand)] hover:underline";

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => void onClick()}
      className={`inline-flex min-h-9 items-center justify-center rounded-lg px-3 text-xs font-semibold transition disabled:opacity-50 sm:text-sm ${base} ${className}`}
    >
      {pending ? "…" : children}
    </button>
  );
}
