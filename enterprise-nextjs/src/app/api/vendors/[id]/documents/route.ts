import { NextResponse } from "next/server";
import { handle, requireApiActor } from "@/lib/auth/api";
import { badRequest } from "@/server/errors";
import { listDocuments, uploadDocument } from "@/server/vendors/documents";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const actor = await requireApiActor();
    const { id } = await ctx.params;
    const q = Object.fromEntries(new URL(request.url).searchParams);
    return NextResponse.json(await listDocuments(actor, id, q), { headers: { "Cache-Control": "no-store" } });
  });
}

/** multipart/form-data: file + name, documentType, description, issueDate, expiryDate. */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const actor = await requireApiActor();
    const { id } = await ctx.params;
    const form = await request.formData().catch(() => { throw badRequest("Invalid upload"); });
    const file = form.get("file");
    const fields = Object.fromEntries([...form.entries()].filter(([, v]) => typeof v === "string"));
    const upload = file instanceof File && file.size > 0 ? { buffer: Buffer.from(await file.arrayBuffer()), name: file.name } : null;
    const document = await uploadDocument(actor, id, fields, upload);
    return NextResponse.json({ ok: true, document }, { status: 201 });
  });
}
