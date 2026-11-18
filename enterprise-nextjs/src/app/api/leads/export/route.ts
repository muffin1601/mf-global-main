import { csvResponse, xlsxResponse } from "@/lib/export/tabular";
import { handle, requireApiActor } from "@/lib/auth/api";
import { badRequest } from "@/server/errors";
import { exportLeads } from "@/server/leads/export";
import { isLeadPreset, parseLeadFilter } from "@/server/leads/filter-schema";

export const dynamic = "force-dynamic";

/** GET /api/leads/export?format=csv|xlsx&<filters>&preset=&dateType=&from=&to= (inclusive IST dates). */
export async function GET(request: Request) {
  return handle(async () => {
    const actor = await requireApiActor();
    const params = new URL(request.url).searchParams;
    const format = params.get("format") ?? "csv";
    if (format !== "csv" && format !== "xlsx") throw badRequest("format must be csv or xlsx.");
    const presetParam = params.get("preset") ?? "all";
    if (!isLeadPreset(presetParam)) throw badRequest("Unknown preset.");
    const result = await exportLeads(actor, { format, filter: parseLeadFilter(params), preset: presetParam });
    const res = format === "csv" ? csvResponse(result.filename, result.body as string) : xlsxResponse(result.filename, result.body as Buffer);
    res.headers.set("X-Row-Count", String(result.rows));
    if (result.truncated) res.headers.set("X-Export-Truncated", "true");
    return res;
  });
}
