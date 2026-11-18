import { handle, requireApiActor } from "@/lib/auth/api";
import { csvResponse } from "@/lib/export/tabular";
import { importReportCsv } from "@/server/vendors/import-export";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, ctx: { params: Promise<{ jobId: string }> }) {
  return handle(async () => {
    const actor = await requireApiActor();
    const { jobId } = await ctx.params;
    const r = await importReportCsv(actor, jobId);
    return csvResponse(r.fileName, r.csv);
  });
}
