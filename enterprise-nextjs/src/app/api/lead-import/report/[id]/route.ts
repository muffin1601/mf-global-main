import { handle, requireApiActor } from "@/lib/auth/api";
import { csvResponse } from "@/lib/export/tabular";
import { buildImportReportCsv } from "@/server/imports/service";

export const dynamic = "force-dynamic";

export const GET = (_request: Request, ctx: { params: Promise<{ id: string }> }) => handle(async () => {
  const actor = await requireApiActor();
  const { id } = await ctx.params;
  const { csv, fileName } = await buildImportReportCsv(actor, id);
  return csvResponse(fileName, csv);
});
