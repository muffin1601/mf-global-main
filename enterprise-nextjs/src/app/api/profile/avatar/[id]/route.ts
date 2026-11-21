import { handle, requireApiActor } from "@/lib/auth/api";
import { HttpError } from "@/server/errors";
import { readAvatar } from "@/server/profile/service";

export const dynamic = "force-dynamic";

/** GET /api/profile/avatar/:userId — a colleague's profile photo, for signed-in enabled users only (private bucket). */
export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    await requireApiActor();
    const { id } = await ctx.params;
    const photo = await readAvatar(id);
    if (!photo) throw new HttpError(404, "No profile photo.", "NOT_FOUND");
    return new Response(new Uint8Array(photo.bytes), {
      headers: {
        "Content-Type": photo.contentType,
        // Versioned URLs (?v=<updatedAt>) make long private caching safe; never cached by shared proxies.
        "Cache-Control": "private, max-age=86400",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
      },
    });
  });
}
