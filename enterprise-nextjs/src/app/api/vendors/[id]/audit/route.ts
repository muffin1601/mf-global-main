import { NextResponse } from "next/server";
import { handle, requireApiActor } from "@/lib/auth/api";
import { vendorAudit } from "@/server/vendors/vendors";

export const dynamic = "force-dynamic";

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const actor = await requireApiActor();
    const { id } = await ctx.params;
    const q = Object.fromEntries(new URL(request.url).searchParams);
    return NextResponse.json(await vendorAudit(actor, id, q), { headers: { "Cache-Control": "no-store" } });
  });
}
