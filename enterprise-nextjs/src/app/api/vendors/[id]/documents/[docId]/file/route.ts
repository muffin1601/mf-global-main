import { NextResponse } from "next/server";
import { handle, requireApiActor } from "@/lib/auth/api";
import { badRequest } from "@/server/errors";
import { documentSignedUrl, readDocument, replaceDocumentFile } from "@/server/vendors/documents";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

type Ctx = { params: Promise<{ id: string; docId: string }> };

/**
 * Authorised download/preview. The private bucket is never exposed: either the server streams
 * the bytes after the permission check, or (mode=signed) redirects to a 2-minute signed URL.
 */
export async function GET(request: Request, ctx: Ctx) {
  return handle(async () => {
    const actor = await requireApiActor();
    const { id, docId } = await ctx.params;
    const url = new URL(request.url);
    const inline = url.searchParams.get("disposition") === "inline";
    if (url.searchParams.get("mode") === "signed") {
      const signed = await documentSignedUrl(actor, id, docId, { inline });
      return NextResponse.redirect(signed.url, { status: 302, headers: { "Cache-Control": "no-store" } });
    }
    const doc = await readDocument(actor, id, docId, { inline });
    // Header values must be Latin-1: a name such as "GST – cert.pdf" or Hindi text made every download throw (500).
    // Send an ASCII fallback plus the RFC 5987 UTF-8 form that browsers prefer.
    const safeName = doc.fileName.replace(/["\r\n\\]/g, "_").replace(/[^\x20-\x7e]/g, "_");
    const utf8Name = encodeURIComponent(doc.fileName.replace(/[\r\n]/g, ""));
    return new Response(new Uint8Array(doc.body), {
      headers: {
        "Content-Type": doc.mimeType,
        "Content-Disposition": `${doc.inline ? "inline" : "attachment"}; filename="${safeName}"; filename*=UTF-8''${utf8Name}`,
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; img-src 'self'; object-src 'none'; sandbox",
        "Cache-Control": "private, no-store",
      },
    });
  });
}

/** Replace the file of an existing document (multipart, field "file"). */
export async function PUT(request: Request, ctx: Ctx) {
  return handle(async () => {
    const actor = await requireApiActor();
    const { id, docId } = await ctx.params;
    const form = await request.formData().catch(() => { throw badRequest("Invalid upload"); });
    const file = form.get("file");
    const upload = file instanceof File && file.size > 0 ? { buffer: Buffer.from(await file.arrayBuffer()), name: file.name } : null;
    return NextResponse.json({ ok: true, document: await replaceDocumentFile(actor, id, docId, upload) });
  });
}
