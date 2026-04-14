"use client";

import { useEffect } from "react";

import { PageHeading } from "@/components/typography/page-headings";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const isPrisma =
    error?.name === "PrismaClientInitializationError" ||
    error?.message?.includes("Prisma") ||
    error?.message?.includes("Can't reach database") ||
    error?.message?.includes("P1001") ||
    error?.message?.includes("connection");

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-lg px-4 py-16">
      <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6">
        <PageHeading variant="dashboard" className="!text-lg">
          {isPrisma ? "Database not connected" : "Something went wrong"}
        </PageHeading>
        {isPrisma ? (
          <div className="mt-4 space-y-3 text-sm leading-relaxed text-muted-foreground">
            <p>
              Prisma cannot reach PostgreSQL. This app reads <code className="rounded bg-black/40 px-1">DATABASE_URL</code>{" "}
              from <code className="rounded bg-black/40 px-1">.env</code> (default: Docker Postgres on port 5433).
            </p>
            <ol className="list-decimal space-y-2 pl-5">
              <li>Install and start <strong>Docker Desktop</strong>.</li>
              <li>In the project folder, run:</li>
            </ol>
            <pre className="overflow-x-auto rounded-lg bg-black/50 p-3 text-xs text-[var(--brand)]">
              npm run setup:local
            </pre>
            <p>Then:</p>
            <pre className="overflow-x-auto rounded-lg bg-black/50 p-3 text-xs text-[var(--brand)]">npm run dev</pre>
            <p className="text-muted-foreground">
              Or: <code className="rounded bg-black/40 px-1">npm run docker:up</code> →{" "}
              <code className="rounded bg-black/40 px-1">npx prisma db push</code> →{" "}
              <code className="rounded bg-black/40 px-1">npm run db:seed</code>
            </p>
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">{error.message}</p>
        )}
        <button
          type="button"
          onClick={() => reset()}
          className="mt-6 rounded-lg bg-white px-4 py-2 text-sm font-medium text-black"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
