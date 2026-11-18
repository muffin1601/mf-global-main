import { NextResponse } from "next/server";
import { handle, requireApiActor } from "@/lib/auth/api";
import { searchProducts } from "@/server/catalog/products";

export const dynamic = "force-dynamic";

/** GET /api/products/search?query=&limit=  (any signed-in user; limit max 50) */
export function GET(request: Request) {
  return handle(async () => {
    const actor = await requireApiActor();
    const q = new URL(request.url).searchParams;
    const limit = Number(q.get("limit") ?? 50);
    return NextResponse.json({ products: await searchProducts(actor, q.get("query") ?? "", Number.isFinite(limit) ? limit : 50) });
  });
}
