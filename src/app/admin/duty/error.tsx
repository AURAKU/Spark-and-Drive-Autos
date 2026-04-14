"use client";

import Link from "next/link";
import { useEffect } from "react";

import { PageHeading } from "@/components/typography/page-headings";

export default function AdminDutyError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const msg = error?.message ?? "";
  const schemaHint =
    msg.includes("Unknown arg") ||
    msg.includes("does not exist") ||
    msg.includes("column") ||
    msg.includes("DutyRecord") ||
    msg.includes("dutyRecords") ||
    msg.includes("Order");

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="rounded-2xl border border-red-500/25 bg-red-500/10 p-6">
      <PageHeading variant="dashboard" className="!text-lg">
        Duty hub could not load
      </PageHeading>
      <p className="mt-2 text-sm text-zinc-300">
        {schemaHint
          ? "The database may be missing duty or order relations. Apply the latest Prisma schema to your database, then refresh."
          : "An unexpected error occurred while loading duty operations."}
      </p>
      {schemaHint ? (
        <pre className="mt-4 overflow-x-auto rounded-lg bg-black/50 p-3 text-xs text-[var(--brand)]">
          npx prisma db push
        </pre>
      ) : null}
      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-lg border border-white/15 bg-white/[0.06] px-4 py-2 text-sm font-medium text-white hover:bg-white/10"
        >
          Try again
        </button>
        <Link href="/admin" className="rounded-lg px-4 py-2 text-sm text-[var(--brand)] hover:underline">
          Command Center
        </Link>
      </div>
    </div>
  );
}
