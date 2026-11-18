import { NextResponse } from "next/server";
import { handle, requireApiActor } from "@/lib/auth/api";
import { searchQuotationClients } from "@/server/quotations/clients";

export const dynamic = "force-dynamic";

// Quotation client picker (MERN: GET /overview/quotation-clients).
export async function GET(req: Request) {
  return handle(async () => {
    const actor = await requireApiActor();
    const p = new URL(req.url).searchParams;
    return NextResponse.json(await searchQuotationClients(actor, { q: p.get("q") ?? "", page: Number(p.get("page")) || 1, limit: Number(p.get("limit")) || 10 }));
  });
}
