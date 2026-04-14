import { Suspense } from "react";

import { RequestAutopartsClient } from "./request-autoparts-client";

export default function RequestAutopartsPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-3xl px-4 py-16 text-sm text-zinc-500 sm:px-6">Loading…</div>}>
      <RequestAutopartsClient />
    </Suspense>
  );
}
