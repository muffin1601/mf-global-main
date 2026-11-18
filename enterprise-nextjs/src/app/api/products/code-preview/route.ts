import { NextResponse } from "next/server";
import { handle, requireApiActor } from "@/lib/auth/api";
import { previewProductCode } from "@/server/catalog/products";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  return handle(async () => {
    const actor = await requireApiActor();
    const categoryId = new URL(request.url).searchParams.get("categoryId") ?? "";
    return NextResponse.json({ productCode: await previewProductCode(actor, categoryId) });
  });
}
