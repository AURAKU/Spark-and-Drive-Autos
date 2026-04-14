import { Suspense } from "react";

import { ChatPageClient } from "./chat-page-client";

export default function ChatPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-3xl px-4 py-12 text-sm text-zinc-500">Loading…</div>}>
      <ChatPageClient />
    </Suspense>
  );
}
