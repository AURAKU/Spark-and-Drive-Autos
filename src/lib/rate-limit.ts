import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

type LimitResult = { success: boolean; remaining?: number; reset?: number };

const memoryBuckets = new Map<string, { count: number; resetAt: number }>();

function memoryLimit(key: string, limit: number, windowMs: number): LimitResult {
  const now = Date.now();
  const b = memoryBuckets.get(key);
  if (!b || now > b.resetAt) {
    memoryBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return { success: true, remaining: limit - 1, reset: now + windowMs };
  }
  if (b.count >= limit) {
    return { success: false, remaining: 0, reset: b.resetAt };
  }
  b.count += 1;
  return { success: true, remaining: limit - b.count, reset: b.resetAt };
}

function redisOrNull(prefix: string, limit: number, window: `${number} m`) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  const redis = new Redis({ url, token });
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(limit, window),
    prefix: `sda:${prefix}`,
  });
}

const rlAuth = redisOrNull("auth", 5, "1 m");
const rlRegister = redisOrNull("register", 5, "15 m");
const rlForm = redisOrNull("form", 30, "1 m");
const rlChat = redisOrNull("chat", 60, "1 m");
/** Edit/delete chat messages — tighter than send. */
const rlChatMod = redisOrNull("chat_mod", 40, "1 m");
const rlPay = redisOrNull("pay", 20, "1 m");

async function run(
  redis: Ratelimit | null,
  memoryKey: string,
  limit: number,
  identifier: string,
  memoryWindowMs = 60_000
): Promise<LimitResult> {
  if (redis) {
    const r = await redis.limit(`${memoryKey}:${identifier}`);
    return { success: r.success, remaining: r.remaining, reset: r.reset };
  }
  return memoryLimit(`${memoryKey}:${identifier}`, limit, memoryWindowMs);
}

/** Credential sign-in attempts per IP (sliding window). */
export async function rateLimitAuth(identifier: string): Promise<LimitResult> {
  return run(rlAuth, "auth", 5, identifier);
}

/** New account registration per IP — stricter window to reduce abuse. */
export async function rateLimitRegister(identifier: string): Promise<LimitResult> {
  return run(rlRegister, "register", 5, identifier, 15 * 60 * 1000);
}

export async function rateLimitForm(identifier: string): Promise<LimitResult> {
  return run(rlForm, "form", 30, identifier);
}

export async function rateLimitChat(identifier: string): Promise<LimitResult> {
  return run(rlChat, "chat", 60, identifier);
}

/** PATCH/DELETE on chat messages (per user IP + user id in caller). */
export async function rateLimitChatModeration(identifier: string): Promise<LimitResult> {
  return run(rlChatMod, "chat_mod", 40, identifier, 60_000);
}

export async function rateLimitPayment(identifier: string): Promise<LimitResult> {
  return run(rlPay, "pay", 20, identifier);
}
