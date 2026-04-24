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

/** Continues with Apple; relies on Apple provider in `src/auth.ts`. */
export function AppleSignInButton({ callbackUrl, disabled, className, children }: Props) {
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
        void signIn("apple", { callbackUrl, redirectTo: callbackUrl }).catch(() => {
          setPending(false);
          toast.error("Could not start Apple sign-in. Check your connection and try again.");
        });
      }}
      className={cn(
        "inline-flex h-11 min-h-11 w-full items-center justify-center gap-2 rounded-lg border px-4 text-sm font-semibold transition",
        "border-zinc-900 bg-zinc-950 text-white hover:bg-zinc-900",
        "dark:border-white/15 dark:bg-black dark:hover:bg-black/85",
        "disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
    >
      <AppleGlyph className="size-5 shrink-0" />
      {pending ? "Redirecting…" : (children ?? "Continue with Apple")}
    </button>
  );
}

function AppleGlyph({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="currentColor"
        d="M16.365 1.43c0 1.14-.43 2.18-1.149 2.95-.822.89-2.18 1.58-3.33 1.48-.14-1.08.36-2.23 1.04-2.99.76-.86 2.08-1.46 3.24-1.44.14.01.2.01.2 0zM20.53 17.1c-.44 1.01-.96 1.93-1.56 2.78-.82 1.18-1.49 2-2.55 2.02-1.05.02-1.37-.67-2.56-.67-1.19 0-1.54.65-2.54.69-1.02.04-1.8-.93-2.63-2.11-2.3-3.29-4.05-9.29-1.7-13.38 1.17-2.04 3.27-3.33 5.55-3.37 1.03-.02 2 .7 2.63.7.63 0 1.81-.86 3.05-.74.52.02 1.99.21 2.93 1.58-.08.05-1.75 1.01-1.73 3.03.03 2.42 2.13 3.22 2.15 3.23-.02.06-.33 1.13-1.04 2.24z"
      />
    </svg>
  );
}
