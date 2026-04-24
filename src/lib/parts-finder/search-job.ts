import type { VehicleQueryPayload } from "@/lib/parts-finder/identifier-crypto";
import { orchestratePartsFinderSearch } from "@/lib/parts-finder/orchestrator";
import type { MembershipAccessSnapshot } from "@/lib/parts-finder/search-types";
import { createHash, randomUUID } from "crypto";

type JobState = "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED";
type JobRecord = {
  id: string;
  userId: string;
  queryKey: string;
  state: JobState;
  createdAt: number;
  updatedAt: number;
  sessionId?: string;
  error?: string;
};

const JOB_TTL_MS = 15 * 60 * 1000;
const RESULT_CACHE_TTL_MS = 10 * 60 * 1000;
const jobsById = new Map<string, JobRecord>();
const inFlightByQuery = new Map<string, Promise<void>>();
const inFlightJobByQuery = new Map<string, string>();
const completedByQuery = new Map<string, { expiresAt: number; sessionId: string }>();

function pruneMaps() {
  const now = Date.now();
  for (const [id, job] of jobsById.entries()) {
    if (now - job.updatedAt > JOB_TTL_MS) jobsById.delete(id);
  }
  for (const [key, row] of completedByQuery.entries()) {
    if (row.expiresAt <= now) completedByQuery.delete(key);
  }
}

function queryKey(userId: string, payload: VehicleQueryPayload) {
  const canonical = JSON.stringify({
    userId,
    vin: payload.vin ?? null,
    chassis: payload.chassis ?? null,
    brand: payload.brand ?? null,
    model: payload.model ?? null,
    year: payload.year ?? null,
    trim: payload.trim ?? null,
    engine: payload.engine ?? null,
    partDescription: payload.partDescription ?? null,
    partImage: payload.partImage ?? null,
  });
  return createHash("sha256").update(canonical).digest("hex");
}

export async function runPartsFinderSearchJob(
  payload: VehicleQueryPayload,
  userId: string,
  membership: MembershipAccessSnapshot,
) {
  return orchestratePartsFinderSearch(payload, userId, membership);
}

export function getPartsFinderSearchJob(jobId: string, userId: string): JobRecord | null {
  pruneMaps();
  const row = jobsById.get(jobId);
  if (!row || row.userId !== userId) return null;
  return row;
}

export function queuePartsFinderSearchJob(
  payload: VehicleQueryPayload,
  userId: string,
  membership: MembershipAccessSnapshot,
): { jobId: string; state: JobState; sessionId?: string; cached: boolean } {
  pruneMaps();
  const key = queryKey(userId, payload);
  const now = Date.now();
  const cached = completedByQuery.get(key);
  if (cached && cached.expiresAt > now) {
    const id = randomUUID();
    const row: JobRecord = {
      id,
      userId,
      queryKey: key,
      state: "COMPLETED",
      createdAt: now,
      updatedAt: now,
      sessionId: cached.sessionId,
    };
    jobsById.set(id, row);
    return { jobId: id, state: row.state, sessionId: row.sessionId, cached: true };
  }

  const existingJobId = inFlightJobByQuery.get(key);
  if (existingJobId) {
    const existing = jobsById.get(existingJobId);
    if (existing) {
      return { jobId: existing.id, state: existing.state, cached: false };
    }
  }

  const id = randomUUID();
  const row: JobRecord = {
    id,
    userId,
    queryKey: key,
    state: "QUEUED",
    createdAt: now,
    updatedAt: now,
  };
  jobsById.set(id, row);
  inFlightJobByQuery.set(key, id);
  const task = (async () => {
    try {
      const active = jobsById.get(id);
      if (!active) return;
      active.state = "RUNNING";
      active.updatedAt = Date.now();
      const result = await runPartsFinderSearchJob(payload, userId, membership);
      const finished = jobsById.get(id);
      if (!finished) return;
      finished.state = "COMPLETED";
      finished.updatedAt = Date.now();
      finished.sessionId = result.sessionId;
      completedByQuery.set(key, { expiresAt: Date.now() + RESULT_CACHE_TTL_MS, sessionId: result.sessionId });
    } catch (error) {
      const failed = jobsById.get(id);
      if (!failed) return;
      failed.state = "FAILED";
      failed.error = error instanceof Error ? error.message : "Search job failed.";
      failed.updatedAt = Date.now();
    } finally {
      inFlightByQuery.delete(key);
      inFlightJobByQuery.delete(key);
    }
  })();
  inFlightByQuery.set(key, task);
  return { jobId: id, state: row.state, cached: false };
}
