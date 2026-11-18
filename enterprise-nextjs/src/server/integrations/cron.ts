import "server-only";
import { indiaMartEnabled, integrationsEnabled, isCronAuthorized, type FetchLike, type Sleep } from "./common";
import { pullIndiaMart } from "./indiamart";
import { pullTradeIndia } from "./tradeindia";

export type CronProvider = "tradeindia" | "indiamart";

/**
 * Shared body of the two cron Route Handlers. Auth first (401), then the safety gates, then the pull.
 * Disabled runs make NO outbound call and are not written to IntegrationRun (a disabled deployment
 * would otherwise add a row every 5 minutes).
 */
export async function runCron(
  provider: CronProvider, request: Request, deps: { fetch?: FetchLike; sleep?: Sleep; now?: Date } = {},
): Promise<Response> {
  if (!isCronAuthorized(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!integrationsEnabled()) return Response.json({ ok: true, skipped: true, reason: "INTEGRATIONS_ENABLED is not 'true'" });
  if (provider === "indiamart" && !indiaMartEnabled()) {
    return Response.json({ ok: true, skipped: true, reason: "ENABLE_INDIAMART_SYNC is not 'true'" });
  }
  const fetchImpl: FetchLike = deps.fetch ?? ((url, init) => fetch(url, init));
  const run = provider === "indiamart" ? pullIndiaMart : pullTradeIndia;
  const out = await run({ fetch: fetchImpl, sleep: deps.sleep, now: deps.now, trigger: "cron" });
  // Provider failures return 200 with the outcome (the run is recorded; Vercel should not treat it as a crash).
  return Response.json({ ok: out.status !== "FAILED", status: out.status, runId: out.runId, fetched: out.fetched, created: out.created, duplicates: out.duplicates, failed: out.failed });
}
