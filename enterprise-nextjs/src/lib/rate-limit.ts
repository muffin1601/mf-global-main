import "server-only";
import { createHmac } from "node:crypto";
import { prisma } from "@/lib/prisma/client";

export type RateLimitResult = { allowed: boolean; count: number; remaining: number; retryAfterSec: number };

/**
 * Fixed-window limiter backed by PostgreSQL so it holds across serverless
 * instances (an in-memory limiter does not). Single atomic upsert statement.
 */
export async function rateLimit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  const seconds = Math.max(1, Math.ceil(windowMs / 1000));
  const rows = await prisma.$queryRaw<{ count: number; elapsed: number }[]>`
    INSERT INTO rate_limit_buckets ("key", "count", "window_start")
    VALUES (${key}, 1, now())
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN rate_limit_buckets."window_start" < now() - make_interval(secs => ${seconds}) THEN 1 ELSE rate_limit_buckets."count" + 1 END,
      "window_start" = CASE WHEN rate_limit_buckets."window_start" < now() - make_interval(secs => ${seconds}) THEN now() ELSE rate_limit_buckets."window_start" END
    RETURNING "count", EXTRACT(EPOCH FROM (now() - "window_start"))::float AS elapsed`;
  const row = rows[0];
  if (!row) throw new Error("rate limiter returned no row");
  const { count, elapsed } = row;
  return { allowed: count <= limit, count, remaining: Math.max(0, limit - count), retryAfterSec: Math.max(1, Math.ceil(seconds - elapsed)) };
}

export const requestIp = (request: Request) =>
  request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
  request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
  request.headers.get("x-real-ip") ||
  "unknown";

/** Stable, non-reversible limiter key part (raw IPs are never stored). */
export const hashForKey = (value: string) =>
  createHmac("sha256", process.env.IP_HASH_SALT ?? "dev-only-salt").update(value).digest("hex").slice(0, 32);

export async function limitRequest(request: Request, bucket: string, limit: number, windowMs: number) {
  return rateLimit(`${bucket}:${hashForKey(requestIp(request))}`, limit, windowMs);
}

/** Housekeeping for stale buckets; safe to call from a cron. */
export async function purgeRateLimitBuckets(olderThanMs = 24 * 3600_000) {
  const { count } = await prisma.rateLimitBucket.deleteMany({ where: { windowStart: { lt: new Date(Date.now() - olderThanMs) } } });
  return count;
}
