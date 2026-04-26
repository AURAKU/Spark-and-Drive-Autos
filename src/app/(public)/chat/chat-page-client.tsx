"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";

import { ChatThreadView } from "@/components/chat/chat-thread-view";
import { PageHeading } from "@/components/typography/page-headings";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const CALLBACK = "/chat";

export function ChatPageClient() {
  const { status } = useSession();

  const registerHref = `/register?callbackUrl=${encodeURIComponent(CALLBACK)}`;
  const loginHref = `/login?callbackUrl=${encodeURIComponent(CALLBACK)}`;

  if (status === "loading") {
    return <div className="mx-auto max-w-3xl px-4 py-12 text-sm text-zinc-500">Loading…</div>;
  }

  if (status !== "authenticated") {
    return (
      <div className="mx-auto max-w-lg px-4 py-12 sm:px-6">
        <PageHeading variant="dashboard">Customer Service Live Support Chat</PageHeading>
        <p className="mt-4 text-sm leading-relaxed text-zinc-400">
          Live support chat is available to signed-in customers only, so we can tie your conversation to your account,
          send updates, and help you securely. Create Account or sign in to start or continue a chat.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            href={registerHref}
            className={cn(
              buttonVariants({ size: "default" }),
              "bg-[var(--brand)] text-center font-semibold text-black hover:opacity-90",
            )}
          >
            Create Account
          </Link>
          <Link
            href={loginHref}
            className={cn(buttonVariants({ variant: "outline", size: "default" }), "border-white/20 text-center")}
          >
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <PageHeading variant="dashboard">Customer Service Live Support Chat</PageHeading>
      <p className="mt-2 text-sm text-zinc-400">
        Send text, images, video, documents, and voice notes — use the round mic in the composer: tap once to record,
        tap again to send. Messages update in real time when configured, with quick refresh otherwise.
      </p>
      <div className="mt-8">
        <ChatThreadView />
      </div>
    </div>
  );
}
