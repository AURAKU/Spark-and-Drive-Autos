"use client";

import { Outfit } from "next/font/google";
import Image from "next/image";
import Link from "next/link";
import { useSession } from "next-auth/react";

import { ChatThreadView } from "@/components/chat/chat-thread-view";
import { SPARK_ASSISTANT_LABEL } from "@/lib/live-support-assistant";

const chatFont = Outfit({
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

export function ChatPageClient() {
  const { status, data: session } = useSession();
  const signedIn = status === "authenticated" && Boolean(session?.user?.id);

  return (
    <div className={cnPage}>
      <div className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--brand)]">Live support</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl">
          Talk to Spark Team
        </h1>
        <p className="mt-2 max-w-xl text-[15px] leading-7 text-zinc-400">
          Ask about our cars, parts, shipping, payments, or how the site works. SPARK answers from public help only. A
          teammate can join anytime.
        </p>
        {status !== "loading" && !signedIn ? (
          <p className="mt-3 text-sm leading-relaxed text-zinc-500">
            Want this saved to your dashboard?{" "}
            <Link
              href={`/register?callbackUrl=${encodeURIComponent("/chat")}`}
              className="font-medium text-[var(--brand)] hover:underline"
            >
              Create an account
            </Link>{" "}
            or{" "}
            <Link
              href={`/login?callbackUrl=${encodeURIComponent("/chat")}`}
              className="font-medium text-[var(--brand)] hover:underline"
            >
              sign in
            </Link>
            .
          </p>
        ) : null}

        <section className="sda-live-chat mt-8 overflow-hidden rounded-[1.75rem] border border-[var(--brand)]/25 bg-zinc-950/70 shadow-[0_24px_80px_-28px_rgba(20,216,230,0.45)]">
          <header className="flex items-center gap-3 border-b border-white/10 bg-gradient-to-r from-[var(--brand)]/12 via-transparent to-transparent px-4 py-3.5 sm:px-5">
            <div className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--brand)]/35 bg-[var(--brand)]/15">
              <Image
                src="/brand/logo-emblem.png"
                alt=""
                width={36}
                height={36}
                className="h-8 w-8 object-contain"
              />
              <span className="absolute bottom-0.5 right-0.5 h-2.5 w-2.5 rounded-full border-2 border-zinc-950 bg-emerald-400" />
            </div>
            <div className="min-w-0">
              <p className="text-[15px] font-semibold tracking-tight text-zinc-50">{SPARK_ASSISTANT_LABEL}</p>
              <p className="text-xs text-zinc-400">Online · usually replies in seconds</p>
            </div>
          </header>
          <div className="p-3 sm:p-5">
            <ChatThreadView />
          </div>
        </section>
      </div>
    </div>
  );
}

const cnPage = `${chatFont.className} sda-chat-page`;
