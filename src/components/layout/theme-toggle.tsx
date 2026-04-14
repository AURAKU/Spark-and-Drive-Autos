"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const current = theme === "system" ? resolvedTheme : theme;
  const isDark = !mounted ? true : current !== "light";

  return (
    <button
      type="button"
      suppressHydrationWarning
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={cn(
        "group relative isolate inline-flex h-9 w-[3.75rem] shrink-0 items-stretch rounded-full border p-0.5 transition-[border-color,background-color,box-shadow,transform] duration-300 ease-out",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]/45 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "active:scale-[0.96]",
        isDark
          ? "border-white/15 bg-zinc-950/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] hover:border-white/25 hover:bg-zinc-950/90"
          : "border-zinc-300/80 bg-zinc-100/95 shadow-sm hover:border-zinc-400/90 hover:bg-white",
        className,
      )}
    >
      {/* Sliding thumb — springy easing reads as intentional, tactile */}
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute left-0.5 top-0.5 z-0 h-7 w-7 rounded-full bg-gradient-to-br from-[var(--brand)] to-[var(--brand-deep)]",
          "shadow-[0_0_18px_-4px_color-mix(in_srgb,var(--brand)_55%,transparent)]",
          "transition-[transform,box-shadow] duration-500 ease-[cubic-bezier(0.34,1.45,0.4,1)] will-change-transform",
          "group-hover:shadow-[0_0_22px_-3px_color-mix(in_srgb,var(--brand)_65%,transparent)]",
          "group-active:duration-200 group-active:ease-out",
          isDark ? "translate-x-0" : "translate-x-[1.75rem]",
        )}
      />

      <span className="relative z-10 flex h-full w-full items-center justify-between px-[5px]">
        <Moon
          className={cn(
            "size-3.5 transition-[color,transform,opacity] duration-300 ease-out",
            isDark ? "scale-105 text-zinc-950" : "text-zinc-500 opacity-80 group-hover:opacity-100",
          )}
          aria-hidden
          strokeWidth={isDark ? 2.25 : 2}
        />
        <Sun
          className={cn(
            "size-3.5 transition-[color,transform,opacity] duration-300 ease-out",
            !isDark ? "scale-105 text-zinc-950" : "text-zinc-400 opacity-80 group-hover:opacity-100",
          )}
          aria-hidden
          strokeWidth={!isDark ? 2.25 : 2}
        />
      </span>
    </button>
  );
}
