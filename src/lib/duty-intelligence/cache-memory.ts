type CacheEntry<T> = { value: T; expiresAt: number; fingerprint: string };

const memoryCache = new Map<string, CacheEntry<unknown>>();
const DEFAULT_TTL_MS = 5 * 60 * 1000;

export async function dutyCacheGet<T>(key: string, fingerprint?: string): Promise<T | null> {
  const entry = memoryCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    memoryCache.delete(key);
    return null;
  }
  if (fingerprint && entry.fingerprint !== fingerprint) {
    memoryCache.delete(key);
    return null;
  }
  return entry.value as T;
}

export async function dutyCacheSet<T>(
  key: string,
  value: T,
  opts?: { ttlMs?: number; fingerprint?: string },
): Promise<void> {
  memoryCache.set(key, {
    value,
    expiresAt: Date.now() + (opts?.ttlMs ?? DEFAULT_TTL_MS),
    fingerprint: opts?.fingerprint ?? "",
  });
}

export async function dutyCacheInvalidate(prefix: string): Promise<void> {
  for (const key of memoryCache.keys()) {
    if (key.startsWith(prefix)) memoryCache.delete(key);
  }
}

export function dutyCacheKey(...parts: string[]): string {
  return `duty:${parts.join(":")}`;
}
