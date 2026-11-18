import { handle, requireApiActor } from "@/lib/auth/api";
import { pdfResponse } from "@/lib/export/tabular";
import { quotationPdf } from "@/server/quotations/pdf";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const actor = await requireApiActor();
    const { id } = await ctx.params;
    const { name, body } = await quotationPdf(actor, id);
    return pdfResponse(name, body);
  });
}
