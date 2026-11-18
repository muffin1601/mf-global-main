import { NextResponse } from "next/server";
import { handle, requireApiActor } from "@/lib/auth/api";
import { badRequest } from "@/server/errors";
import { uploadImport } from "@/server/vendors/import-export";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** Step 1 of the import: store the CSV, detect headers, suggest a column mapping. Body limit on Vercel is 4.5 MB. */
export async function POST(request: Request) {
  return handle(async () => {
    const actor = await requireApiActor();
    const form = await request.formData().catch(() => { throw badRequest("Invalid upload"); });
    const file = form.get("file");
    if (!(file instanceof File) || !file.size) throw badRequest("Upload a .csv file to import vendors");
    const key = form.get("idempotencyKey");
    const job = await uploadImport(actor, { fileName: file.name, buffer: Buffer.from(await file.arrayBuffer()), idempotencyKey: typeof key === "string" && key ? key : undefined });
    return NextResponse.json({ ok: true, ...job }, { status: 201 });
  });
}
