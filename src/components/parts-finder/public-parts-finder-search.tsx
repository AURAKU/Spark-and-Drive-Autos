"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type SearchResponse = {
  ok: boolean;
  job?: {
    jobId: string;
    state: "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED";
    cached?: boolean;
    sessionId?: string | null;
  };
  error?: string;
};

export function PublicPartsFinderSearch() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  async function onSubmit(formData: FormData) {
    setLoading(true);
    setError(null);
    setStatus("Submitting search...");
    const payload = {
      vin: String(formData.get("vin") ?? "").trim() || undefined,
      chassis: String(formData.get("chassis") ?? "").trim() || undefined,
      brand: String(formData.get("brand") ?? "").trim() || undefined,
      model: String(formData.get("model") ?? "").trim() || undefined,
      year: String(formData.get("year") ?? "").trim() || undefined,
      engine: String(formData.get("engine") ?? "").trim() || undefined,
      partDescription: String(formData.get("partDescription") ?? "").trim() || undefined,
      partImage:
        formData.get("partImage") instanceof File && (formData.get("partImage") as File).size > 0
          ? {
              fileName: (formData.get("partImage") as File).name,
              mimeType: (formData.get("partImage") as File).type || "application/octet-stream",
              sizeBytes: (formData.get("partImage") as File).size,
            }
          : undefined,
    };

    const res = await fetch("/api/parts-finder/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = (await res.json()) as SearchResponse;
    if (!data.ok || !data.job?.jobId) {
      setLoading(false);
      setError(data.error ?? "Search failed.");
      setStatus(null);
      return;
    }

    if (data.job.sessionId) {
      setLoading(false);
      setStatus("Result ready from cache.");
      router.push(`/parts-finder/results/${data.job.sessionId}`);
      return;
    }

    setStatus("Search queued. Gathering evidence...");
    const startedAt = Date.now();
    while (Date.now() - startedAt < 65000) {
      await new Promise((resolve) => setTimeout(resolve, 1800));
      const pollRes = await fetch(`/api/parts-finder/search/jobs/${encodeURIComponent(data.job.jobId)}`, { method: "GET" });
      const poll = (await pollRes.json().catch(() => ({}))) as {
        ok?: boolean;
        status?: "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED" | "NOT_FOUND";
        job?: { sessionId?: string | null; error?: string | null };
      };
      if (!pollRes.ok || poll.ok === false) continue;
      if (poll.status === "QUEUED") {
        setStatus("Queued. Waiting for worker slot...");
        continue;
      }
      if (poll.status === "RUNNING") {
        setStatus("Analyzing external and internal evidence...");
        continue;
      }
      if (poll.status === "COMPLETED" && poll.job?.sessionId) {
        setLoading(false);
        setStatus("Search complete.");
        router.push(`/parts-finder/results/${poll.job.sessionId}`);
        return;
      }
      if (poll.status === "FAILED") {
        setLoading(false);
        setStatus(null);
        setError(poll.job?.error ?? "Search job failed.");
        return;
      }
    }
    setLoading(false);
    setStatus(null);
    setError("Search is taking longer than expected. Please retry in a moment.");
  }

  return (
    <form action={onSubmit} className="mt-6 grid gap-3 rounded-2xl border border-border bg-card p-4 text-sm">
      <input name="vin" placeholder="VIN (optional)" className="h-10 rounded-lg border border-border bg-background px-3" />
      <input name="chassis" placeholder="Chassis (optional)" className="h-10 rounded-lg border border-border bg-background px-3" />
      <div className="grid gap-3 sm:grid-cols-3">
        <input name="brand" placeholder="Brand" className="h-10 rounded-lg border border-border bg-background px-3" />
        <input name="model" placeholder="Model" className="h-10 rounded-lg border border-border bg-background px-3" />
        <input name="year" placeholder="Year" className="h-10 rounded-lg border border-border bg-background px-3" />
      </div>
      <input name="engine" placeholder="Engine (optional)" className="h-10 rounded-lg border border-border bg-background px-3" />
      <textarea
        name="partDescription"
        placeholder="Describe part needed and symptoms (e.g. front left control arm noise)"
        className="min-h-24 rounded-lg border border-border bg-background p-3"
        required
      />
      <input
        name="partImage"
        type="file"
        accept="image/*"
        className="h-10 rounded-lg border border-border bg-background px-3 py-2 text-xs"
      />
      <p className="text-[11px] text-muted-foreground">
        Optional part image helps context ranking; filename metadata is used, and final fitment still requires VIN/chassis verification.
      </p>
      <button
        disabled={loading}
        type="submit"
        className="inline-flex h-10 items-center justify-center rounded-lg bg-[var(--brand)] px-4 font-semibold text-black disabled:opacity-60"
      >
        {loading ? "Searching..." : "Run parts intelligence search"}
      </button>
      {status ? <p className="text-xs text-muted-foreground">{status}</p> : null}
      {error ? <p className="text-xs text-red-500">{error}</p> : null}
    </form>
  );
}
