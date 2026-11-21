import { NextResponse } from "next/server";
import { handle, requireApiActor } from "@/lib/auth/api";
import { badRequest } from "@/server/errors";
import { MAX_AVATAR_BYTES, removeAvatar, setAvatar } from "@/server/profile/service";

export const dynamic = "force-dynamic";

/** POST /api/profile/avatar — replace the signed-in user's OWN photo (multipart field "photo", <= 2 MB, JPEG/PNG/WebP). */
export async function POST(request: Request) {
  return handle(async () => {
    const actor = await requireApiActor();
    const length = Number(request.headers.get("content-length") ?? 0);
    if (length > MAX_AVATAR_BYTES + 64 * 1024) throw badRequest("The photo must be 2 MB or smaller.");
    const form = await request.formData().catch(() => { throw badRequest("Upload the photo as multipart form data."); });
    const f = form.get("photo");
    if (f instanceof File && f.size > MAX_AVATAR_BYTES) throw badRequest("The photo must be 2 MB or smaller.");
    const file = f instanceof File && f.size > 0 ? { buffer: Buffer.from(await f.arrayBuffer()), size: f.size } : null;
    await setAvatar(actor, file);
    return NextResponse.json({ ok: true, message: "Profile photo updated." });
  });
}

/** DELETE /api/profile/avatar — remove the signed-in user's own photo (idempotent). */
export async function DELETE() {
  return handle(async () => {
    const actor = await requireApiActor();
    const r = await removeAvatar(actor);
    return NextResponse.json({ ok: true, removed: r.removed, message: r.removed ? "Profile photo removed." : "There was no photo to remove." });
  });
}
