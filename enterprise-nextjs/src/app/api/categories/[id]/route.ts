import { NextResponse } from "next/server";
import { handle, requireApiActor } from "@/lib/auth/api";
import { deleteCategory, renameCategory } from "@/server/catalog/categories";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export function PUT(request: Request, { params }: Ctx) {
  return handle(async () => {
    const actor = await requireApiActor({ admin: true });
    const body = (await request.json().catch(() => ({}))) as { name?: string };
    return NextResponse.json({ category: await renameCategory(actor, (await params).id, { name: body.name ?? "" }) });
  });
}

export function DELETE(_request: Request, { params }: Ctx) {
  return handle(async () => {
    const actor = await requireApiActor({ admin: true });
    await deleteCategory(actor, (await params).id);
    return NextResponse.json({ ok: true });
  });
}
