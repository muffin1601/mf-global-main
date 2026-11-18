import { NextResponse } from "next/server";
import { handle, requireApiActor } from "@/lib/auth/api";
import { archiveProduct, getProduct, updateProduct } from "@/server/catalog/products";
import { parseProductForm } from "@/server/catalog/http";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export function GET(_request: Request, { params }: Ctx) {
  return handle(async () => {
    const actor = await requireApiActor();
    return NextResponse.json({ product: await getProduct(actor, (await params).id) });
  });
}

export function PUT(request: Request, { params }: Ctx) {
  return handle(async () => {
    const actor = await requireApiActor({ admin: true });
    const { input, image, expectedUpdatedAt, removeImage } = await parseProductForm(request);
    return NextResponse.json({ product: await updateProduct(actor, (await params).id, { ...input, expectedUpdatedAt, removeImage }, image) });
  });
}

/** Soft delete: archives the product. */
export function DELETE(_request: Request, { params }: Ctx) {
  return handle(async () => {
    const actor = await requireApiActor({ admin: true });
    return NextResponse.json({ product: await archiveProduct(actor, (await params).id) });
  });
}
