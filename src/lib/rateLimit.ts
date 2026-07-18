import "server-only";

/**
 * Best-effort in-memory rate limiter (token bucket per key). On serverless
 * this is per-instance, so it caps bursts rather than providing a hard global
 * limit — acceptable for a family trivia game; swap for Upstash/Redis if you
 * need strict limits.
 */
const buckets = new Map<string, { tokens: number; updatedAt: number }>();

export function rateLimit(key: string, maxPerMinute: number): boolean {
  const now = Date.now();
  const bucket = buckets.get(key) ?? { tokens: maxPerMinute, updatedAt: now };
  const refill = ((now - bucket.updatedAt) / 60_000) * maxPerMinute;
  bucket.tokens = Math.min(maxPerMinute, bucket.tokens + refill);
  bucket.updatedAt = now;
  if (bucket.tokens < 1) {
    buckets.set(key, bucket);
    return false;
  }
  bucket.tokens -= 1;
  buckets.set(key, bucket);
  if (buckets.size > 10_000) buckets.clear(); // crude memory guard
  return true;
}

export function clientKey(req: Request, scope: string): string {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";
  return `${scope}:${ip}`;
}
