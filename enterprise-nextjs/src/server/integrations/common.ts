import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma/client";

export type FetchLike = (url: string, init?: { signal?: AbortSignal; headers?: Record<string, string> }) => Promise<Response>;
export type Sleep = (ms: number) => Promise<void>;
export const realSleep: Sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** SAFETY: no outbound provider call unless explicitly enabled (default off, so staging never hits live integrations). */
export const integrationsEnabled = () => process.env.INTEGRATIONS_ENABLED === "true";
/** MERN: IndiaMART is additionally opt-in (key was expired). */
export const indiaMartEnabled = () => integrationsEnabled() && process.env.ENABLE_INDIAMART_SYNC === "true";

/** Constant-time string comparison that does not leak length (both sides hashed first). */
export function safeEqual(a: string | null | undefined, b: string | null | undefined): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb) && a.length === b.length;
}

/** Vercel Cron sends `Authorization: Bearer $CRON_SECRET`. Fails closed when CRON_SECRET is unset. */
export function isCronAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization") ?? "";
  return header.startsWith("Bearer ") && safeEqual(header.slice(7), secret);
}

/** Error text that is safe to persist: URLs (which carry provider keys) and known secrets are removed. */
export function safeMessage(error: unknown, secrets: (string | undefined)[] = []): string {
  let text = error instanceof Error ? error.message : String(error);
  text = text.replace(/https?:\/\/\S+/gi, "[url]");
  for (const s of secrets) if (s && s.length >= 4) text = text.split(s).join("[redacted]");
  return text.slice(0, 300);
}

export class TransientError extends Error {}
export class ProviderError extends Error {}

/**
 * GET with bounded retry + exponential backoff on network errors, 5xx and 429.
 * Never includes the URL in thrown messages (it contains the provider key).
 */
export async function fetchWithRetry(
  fetchImpl: FetchLike, url: string, opts: { sleep?: Sleep; attempts?: number; baseDelayMs?: number; timeoutMs?: number } = {},
): Promise<Response> {
  const { sleep = realSleep, attempts = 3, baseDelayMs = 500, timeoutMs = 10_000 } = opts;
  let last = "request failed";
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const res = await fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs) });
      if (res.status >= 500 || res.status === 429) last = `HTTP ${res.status}`;
      else return res;
    } catch (e) {
      last = e instanceof Error && e.name ? `network error (${e.name})` : "network error";
    }
    if (attempt < attempts) await sleep(Math.min(5_000, baseDelayMs * 2 ** (attempt - 1)));
  }
  throw new TransientError(`Provider unavailable after ${attempts} attempts: ${last}`);
}

export const formatPhone = (phone: unknown): string => {
  if (phone == null || phone === "") return "";
  let cleaned = String(phone).replace(/\D/g, "");
  if (cleaned.startsWith("91") && cleaned.length > 10) cleaned = cleaned.slice(2);
  return cleaned.slice(-10);
};

export type RunCounters = { fetched: number; created: number; duplicates: number; failed: number };
export type RunOutcome = RunCounters & { runId: string; status: "SUCCESS" | "PARTIAL" | "FAILED"; error?: string };

/** Record one run in IntegrationRun around `body`. Counters are persisted even when the body throws. */
export async function recordRun(
  provider: string, trigger: string, secrets: (string | undefined)[],
  body: (c: RunCounters) => Promise<void>,
): Promise<RunOutcome> {
  const run = await prisma.integrationRun.create({ data: { provider, trigger, status: "RUNNING" } });
  const c: RunCounters = { fetched: 0, created: 0, duplicates: 0, failed: 0 };
  let error: string | undefined;
  try {
    await body(c);
  } catch (e) {
    error = safeMessage(e, secrets);
  }
  const status = error ? (c.created + c.duplicates > 0 ? "PARTIAL" : "FAILED") : c.failed > 0 ? "PARTIAL" : "SUCCESS";
  await prisma.integrationRun.update({
    where: { id: run.id },
    data: { finishedAt: new Date(), status, ...c, errorMessage: error ?? (c.failed ? `${c.failed} lead(s) failed to save` : null) },
  });
  // Counts only: never secrets, URLs or lead data.
  console.info(`integration:${provider} run ${status}`, c);
  return { runId: run.id, status, error, ...c };
}
