import type { VehicleQueryPayload } from "@/lib/parts-finder/identifier-crypto";
import { orchestratePartsFinderSearch } from "@/lib/parts-finder/orchestrator";
import type { MembershipAccessSnapshot } from "@/lib/parts-finder/search-types";
import { Redis } from "@upstash/redis";
import { createHash, randomUUID } from "crypto";

type JobState = "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED" | "TIMEOUT";
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
const REDIS_JOB_TTL_SECONDS = 15 * 60;
const REDIS_RESULT_TTL_SECONDS = 10 * 60;
const REDIS_QUEUE_KEY = "sda:pf:queue";
let redisQueueKickInProgress = false;
const SEARCH_JOB_TIMEOUT_MS = 60_000;

async function runWithTimeout<T>(task: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      const err = new Error("SEARCH_TIMEOUT");
      err.name = "AbortError";
      reject(err);
    }, ms);
  });
  try {
    return await Promise.race([task, timeoutPromise]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

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

function redisClientOrNull() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

function redisJobKey(jobId: string) {
  return `sda:pf:job:${jobId}`;
}

function redisQueryInFlightKey(qk: string) {
  return `sda:pf:q:inflight:${qk}`;
}

function redisQueryResultKey(qk: string) {
  return `sda:pf:q:result:${qk}`;
}

export async function runPartsFinderSearchJob(
  payload: VehicleQueryPayload,
  userId: string,
  membership: MembershipAccessSnapshot,
  jobId?: string,
) {
  return orchestratePartsFinderSearch(payload, userId, membership, { jobId });
}

export async function getPartsFinderSearchJob(jobId: string, userId: string): Promise<JobRecord | null> {
  const redis = redisClientOrNull();
  if (redis) {
    const key = redisJobKey(jobId);
    const data = await redis.hgetall<{
      userId?: string;
      queryKey?: string;
      state?: JobState;
      createdAt?: string;
      updatedAt?: string;
      sessionId?: string;
      error?: string;
    }>(key);
    if (!data || !data.userId || data.userId !== userId || !data.state || !data.queryKey) return null;
    const row = {
      id: jobId,
      userId: data.userId,
      queryKey: data.queryKey,
      state: data.state,
      createdAt: Number(data.createdAt ?? Date.now()),
      updatedAt: Number(data.updatedAt ?? Date.now()),
      sessionId: data.sessionId,
      error: data.error,
    };
    if ((row.state === "QUEUED" || row.state === "RUNNING") && Date.now() - row.createdAt > SEARCH_JOB_TIMEOUT_MS) {
      row.state = "TIMEOUT";
      row.error = "SEARCH_TIMEOUT";
      await redis.hset(key, {
        state: "TIMEOUT",
        updatedAt: String(Date.now()),
        error: "SEARCH_TIMEOUT",
      });
      await redis.expire(key, REDIS_JOB_TTL_SECONDS);
    }
    if (row.state === "QUEUED") {
      void kickRedisQueueProcessor();
    }
    return row;
  }
  pruneMaps();
  const row = jobsById.get(jobId);
  if (!row || row.userId !== userId) return null;
  if ((row.state === "QUEUED" || row.state === "RUNNING") && Date.now() - row.createdAt > SEARCH_JOB_TIMEOUT_MS) {
    row.state = "TIMEOUT";
    row.error = "SEARCH_TIMEOUT";
    row.updatedAt = Date.now();
  }
  return row;
}

export async function queuePartsFinderSearchJob(
  payload: VehicleQueryPayload,
  userId: string,
  membership: MembershipAccessSnapshot,
): Promise<{ jobId: string; state: JobState; sessionId?: string; cached: boolean }> {
  const redis = redisClientOrNull();
  if (redis) {
    const key = queryKey(userId, payload);
    const cachedSessionId = await redis.get<string | null>(redisQueryResultKey(key));
    if (cachedSessionId) {
      const cachedJobId = randomUUID();
      await redis.hset(redisJobKey(cachedJobId), {
        userId,
        queryKey: key,
        state: "COMPLETED",
        createdAt: String(Date.now()),
        updatedAt: String(Date.now()),
        sessionId: cachedSessionId,
      });
      await redis.expire(redisJobKey(cachedJobId), REDIS_JOB_TTL_SECONDS);
      return { jobId: cachedJobId, state: "COMPLETED", sessionId: cachedSessionId, cached: true };
    }
    const existingJobId = await redis.get<string | null>(redisQueryInFlightKey(key));
    if (existingJobId) {
      const existing = await getPartsFinderSearchJob(existingJobId, userId);
      if (existing) {
        return { jobId: existing.id, state: existing.state, sessionId: existing.sessionId, cached: false };
      }
    }
    const jobId = randomUUID();
    console.info("[parts-finder] job created", { jobId, userId });
    await redis.hset(redisJobKey(jobId), {
      userId,
      queryKey: key,
      state: "RUNNING",
      createdAt: String(Date.now()),
      updatedAt: String(Date.now()),
    });
    await redis.expire(redisJobKey(jobId), REDIS_JOB_TTL_SECONDS);
    await redis.set(redisQueryInFlightKey(key), jobId, { ex: REDIS_JOB_TTL_SECONDS });
    console.info("[parts-finder] search worker started", { jobId, userId });
    try {
      const result = await runWithTimeout(runPartsFinderSearchJob(payload, userId, membership, jobId), SEARCH_JOB_TIMEOUT_MS);
      console.info("[parts-finder] database update COMPLETE started", { jobId, userId });
      await redis.hset(redisJobKey(jobId), {
        state: "COMPLETED",
        updatedAt: String(Date.now()),
        sessionId: result.sessionId,
      });
      await redis.expire(redisJobKey(jobId), REDIS_JOB_TTL_SECONDS);
      await redis.set(redisQueryResultKey(key), result.sessionId, { ex: REDIS_RESULT_TTL_SECONDS });
      await redis.del(redisQueryInFlightKey(key));
      console.info("[parts-finder] database update COMPLETE success", { jobId, userId, sessionId: result.sessionId });
      return { jobId, state: "COMPLETED", sessionId: result.sessionId, cached: false };
    } catch (error) {
      const timeout = error instanceof Error && error.name === "AbortError";
      console.error("[parts-finder] database update FAILED", { jobId, userId, error });
      await redis.hset(redisJobKey(jobId), {
        state: timeout ? "TIMEOUT" : "FAILED",
        updatedAt: String(Date.now()),
        error: timeout ? "SEARCH_TIMEOUT" : "SEARCH_FAILED",
      });
      await redis.expire(redisJobKey(jobId), REDIS_JOB_TTL_SECONDS);
      await redis.del(redisQueryInFlightKey(key));
      return { jobId, state: timeout ? "TIMEOUT" : "FAILED", cached: false };
    }
  }
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
  console.info("[parts-finder] job created", { jobId: id, userId });
  const row: JobRecord = {
    id,
    userId,
    queryKey: key,
    state: "RUNNING",
    createdAt: now,
    updatedAt: now,
  };
  jobsById.set(id, row);
  inFlightJobByQuery.set(key, id);
  console.info("[parts-finder] search worker started", { jobId: id, userId });
  try {
    const result = await runWithTimeout(runPartsFinderSearchJob(payload, userId, membership, id), SEARCH_JOB_TIMEOUT_MS);
    console.info("[parts-finder] database update COMPLETE started", { jobId: id, userId });
    row.state = "COMPLETED";
    row.updatedAt = Date.now();
    row.sessionId = result.sessionId;
    completedByQuery.set(key, { expiresAt: Date.now() + RESULT_CACHE_TTL_MS, sessionId: result.sessionId });
    console.info("[parts-finder] database update COMPLETE success", { jobId: id, userId, sessionId: result.sessionId });
    return { jobId: id, state: "COMPLETED", sessionId: result.sessionId, cached: false };
  } catch (error) {
    const timeout = error instanceof Error && error.name === "AbortError";
    console.error("[parts-finder] database update FAILED", { jobId: id, userId, error });
    row.state = timeout ? "TIMEOUT" : "FAILED";
    row.error = timeout ? "SEARCH_TIMEOUT" : "SEARCH_FAILED";
    row.updatedAt = Date.now();
    return { jobId: id, state: row.state, cached: false };
  } finally {
    inFlightByQuery.delete(key);
    inFlightJobByQuery.delete(key);
  }
}

async function kickRedisQueueProcessor() {
  if (redisQueueKickInProgress) return;
  redisQueueKickInProgress = true;
  try {
    while (await processOneQueuedPartsFinderJob()) {
      // Drain available queue items to avoid stranded jobs
      // when no separate worker process is running.
    }
  } catch (error) {
    console.error("[parts-finder] redis queue kick failed", error);
  } finally {
    redisQueueKickInProgress = false;
  }
}

export async function processOneQueuedPartsFinderJob(): Promise<boolean> {
  const redis = redisClientOrNull();
  if (!redis) return false;
  const item = await redis.lpop<string | null>(REDIS_QUEUE_KEY);
  if (!item) return false;
  type QueuedItem = {
    jobId: string;
    queryKey: string;
    userId: string;
    payload: VehicleQueryPayload;
    membership: MembershipAccessSnapshot;
  };
  let parsed: QueuedItem;
  try {
    parsed = JSON.parse(item) as QueuedItem;
  } catch {
    return true;
  }
  const now = Date.now();
  const jobKey = redisJobKey(parsed.jobId);
  await redis.hset(jobKey, { state: "RUNNING", updatedAt: String(now) });
  await redis.expire(jobKey, REDIS_JOB_TTL_SECONDS);
  try {
    const result = await runPartsFinderSearchJob(parsed.payload, parsed.userId, parsed.membership);
    await redis.hset(jobKey, {
      state: "COMPLETED",
      updatedAt: String(Date.now()),
      sessionId: result.sessionId,
    });
    await redis.expire(jobKey, REDIS_JOB_TTL_SECONDS);
    await redis.set(redisQueryResultKey(parsed.queryKey), result.sessionId, { ex: REDIS_RESULT_TTL_SECONDS });
  } catch (error) {
    console.error("[parts-finder] redis queued job failed", {
      jobId: parsed.jobId,
      userId: parsed.userId,
      error,
    });
    await redis.hset(jobKey, {
      state: "FAILED",
      updatedAt: String(Date.now()),
      error: "SEARCH_FAILED",
    });
    await redis.expire(jobKey, REDIS_JOB_TTL_SECONDS);
  } finally {
    await redis.del(redisQueryInFlightKey(parsed.queryKey));
  }
  return true;
}
