type Bucket = {
  timestamps: number[];
};

const buckets = new Map<string, Bucket>();

function prune(bucket: Bucket, now: number, windowMs: number) {
  bucket.timestamps = bucket.timestamps.filter((ts) => now - ts <= windowMs);
}

export function checkPartsFinderRateLimit(params: {
  key: string;
  maxRequests: number;
  windowMs: number;
}): { allowed: true } | { allowed: false; retryAfterSeconds: number } {
  const now = Date.now();
  const bucket = buckets.get(params.key) ?? { timestamps: [] };
  prune(bucket, now, params.windowMs);

  if (bucket.timestamps.length >= params.maxRequests) {
    const earliest = bucket.timestamps[0] ?? now;
    const retryAfterMs = Math.max(1000, params.windowMs - (now - earliest));
    const retryAfterSeconds = Math.ceil(retryAfterMs / 1000);
    buckets.set(params.key, bucket);
    return { allowed: false, retryAfterSeconds };
  }

  bucket.timestamps.push(now);
  buckets.set(params.key, bucket);
  return { allowed: true };
}

