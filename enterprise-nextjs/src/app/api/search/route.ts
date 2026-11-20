import { NextResponse } from "next/server";
import { handle, requireApiActor } from "@/lib/auth/api";
import { globalSearch } from "@/server/search/service";

export const dynamic = "force-dynamic";

/** GET /api/search?q=&limit=  Signed-in users only; results are scoped per entity (see server/search/service.ts). */
export function GET(request: Request) {
  return handle(async () => {
    const actor = await requireApiActor();
    const params = new URL(request.url).searchParams;
    const limit = Number(params.get("limit") ?? 5);
    const result = await globalSearch(actor, params.get("q"), { limit: Number.isFinite(limit) ? limit : 5 });
    return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
  });
}
