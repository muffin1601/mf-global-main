import { handle, requireApiActor } from "@/lib/auth/api";
import { csvResponse } from "@/lib/export/tabular";
import { exportVendors } from "@/server/vendors/import-export";

export const dynamic = "force-dynamic";

/** CSV of the vendors matching the same query-string filters as the list page (vendor.export, capped at 50,000). */
export async function GET(request: Request) {
  return handle(async () => {
    const actor = await requireApiActor();
    const q = Object.fromEntries(new URL(request.url).searchParams);
    const r = await exportVendors(actor, q);
    const res = csvResponse(r.fileName, r.csv);
    if (r.truncated) res.headers.set("X-Export-Truncated", "true");
    return res;
  });
}
