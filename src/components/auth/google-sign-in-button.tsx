"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";

type Props = {
  callbackUrl: string;
  disabled?: boolean;
  className?: string;
  children?: React.ReactNode;
};

/**
 * Continues with Google; relies on `Google` provider in `src/auth.ts`.
 */
export function GoogleSignInButton({ callbackUrl, disabled, className, children }: Props) {
  const [pending, setPending] = useState(false);
  const busy = Boolean(disabled || pending);

  return (
    <button
      type="button"
      disabled={busy}
      aria-busy={pending}
      onClick={() => {
        if (busy) return;
        setPending(true);
        void signIn("google", { callbackUrl, redirectTo: callbackUrl }).catch(() => {
          setPending(false);
          toast.error("Could not start Google sign-in. Check your connection and try again.");
        });
      }}
      className={cn(
        "inline-flex h-11 min-h-11 w-full items-center justify-center gap-2 rounded-lg border px-4 text-sm font-semibold transition",
        "border-zinc-300/90 bg-white text-zinc-800 shadow-sm hover:bg-zinc-50 hover:text-zinc-950",
        "dark:border-white/15 dark:bg-white/[0.06] dark:text-white dark:shadow-none dark:hover:bg-white/10",
        "disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
    >
      <GoogleGlyph className="size-5 shrink-0" />
      {pending ? "Redirecting…" : (children ?? "Continue with Google")}
    </button>
  );
}

function GoogleGlyph({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}
