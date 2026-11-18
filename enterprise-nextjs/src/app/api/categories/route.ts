import { NextResponse } from "next/server";
import { handle, requireApiActor } from "@/lib/auth/api";
import { createCategory, listCategories } from "@/server/catalog/categories";

export const dynamic = "force-dynamic";

export function GET() {
  return handle(async () => NextResponse.json({ categories: await listCategories(await requireApiActor()) }));
}

export function POST(request: Request) {
  return handle(async () => {
    const actor = await requireApiActor({ admin: true });
    const body = (await request.json().catch(() => ({}))) as { name?: string };
    return NextResponse.json({ category: await createCategory(actor, { name: body.name ?? "" }) }, { status: 201 });
  });
}
