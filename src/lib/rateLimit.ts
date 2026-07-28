import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * In-memory token bucket. Per-instance on serverless, so a scaled-out or
 * cold-started deployment effectively multiplies the limit by its instance
 * count. It stays because it is free and absorbs the common case — a single
 * client polling too fast — but it is a burst damper, not a real limit.
 *
 * Anything that creates durable rows must use `rateLimitDurable` instead.
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

/**
 * Database-backed fixed-window limit, shared by every instance and unaffected
 * by cold starts. Costs a round trip, so reserve it for endpoints whose abuse
 * leaves rows behind — room creation and joins — rather than for polling.
 *
 * Fails open: the database being unreachable should degrade the limiter, not
 * take the game down. The in-memory bucket is still in front of it.
 */
export async function rateLimitDurable(
  key: string,
  max: number,
  windowSeconds = 60,
): Promise<boolean> {
  try {
    const { data, error } = await supabaseAdmin().rpc("rate_limit_hit", {
      p_key: key,
      p_max: max,
      p_window_seconds: windowSeconds,
    });
    if (error) {
      console.error("rate_limit_hit failed, allowing request:", error.message);
      return true;
    }
    return data !== false;
  } catch (err) {
    console.error("rate_limit_hit threw, allowing request:", err);
    return true;
  }
}

/**
 * Identify the caller for limiting purposes.
 *
 * `x-forwarded-for` is attacker-controlled on its own — a client can send any
 * value it likes and the platform appends to it. Prefer the headers the
 * platform sets itself, and when falling back to the forwarded chain take the
 * last entry (added by the closest trusted proxy) rather than the first.
 */
export function clientKey(req: Request, scope: string): string {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",");
  const ip =
    req.headers.get("x-vercel-forwarded-for")?.trim() ||
    req.headers.get("x-real-ip")?.trim() ||
    forwarded?.[forwarded.length - 1]?.trim() ||
    "unknown";
  return `${scope}:${ip}`;
}
