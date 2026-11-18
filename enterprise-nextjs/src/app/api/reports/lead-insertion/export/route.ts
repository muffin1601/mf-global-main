import { handle, requireApiActor } from "@/lib/auth/api";
import { csvResponse, pdfResponse, xlsxResponse } from "@/lib/export/tabular";
import { exportLeadInsertion } from "@/server/reports/lead-insertion-export";
import { parseFilters } from "@/server/reports/lead-insertion-filters";

export const dynamic = "force-dynamic";

// Any signed-in user may call this; the service scopes a USER to their assigned leads.
export async function GET(request: Request) {
  return handle(async () => {
    const actor = await requireApiActor();
    const params = new URL(request.url).searchParams;
    const filters = parseFilters(params);
    const result = await exportLeadInsertion(actor, filters, params.get("format") ?? "csv");
    if (result.contentType.startsWith("text/csv")) return csvResponse(result.filename, result.body as string);
    if (result.contentType === "application/pdf") return pdfResponse(result.filename, result.body as Buffer);
    return xlsxResponse(result.filename, result.body as Buffer);
  });
}
