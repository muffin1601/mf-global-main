import { handle, requireApiActor } from "@/lib/auth/api";
import { csvResponse } from "@/lib/export/tabular";
import { importTemplateCsv } from "@/server/vendors/import-export";

export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => {
    const actor = await requireApiActor();
    const t = importTemplateCsv(actor);
    return csvResponse(t.fileName, t.csv);
  });
}
