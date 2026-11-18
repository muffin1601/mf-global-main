import { NextResponse } from "next/server";
import { handle, requireApiActor } from "@/lib/auth/api";
import { createProduct, listProducts } from "@/server/catalog/products";
import { parseProductForm } from "@/server/catalog/http";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  return handle(async () => {
    const actor = await requireApiActor();
    const q = new URL(request.url).searchParams;
    const result = await listProducts(actor, {
      query: q.get("query") ?? "",
      categoryId: q.get("category") ?? "",
      status: q.get("status") ?? "active",
      sort: q.get("sort") ?? "",
      page: Number(q.get("page") ?? 1),
      limit: Number(q.get("limit") ?? 20),
    });
    return NextResponse.json(result);
  });
}

export function POST(request: Request) {
  return handle(async () => {
    const actor = await requireApiActor({ admin: true });
    const { input, image } = await parseProductForm(request);
    return NextResponse.json({ product: await createProduct(actor, input, image) }, { status: 201 });
  });
}
