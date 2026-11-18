import { NextResponse } from "next/server";
import { z } from "zod";
import { handle, requireApiActor } from "@/lib/auth/api";
import { rateLimit } from "@/lib/rate-limit";
import { recordClientActivity } from "@/server/activity/service";
import { badRequest, tooMany } from "@/server/errors";

const body = z.object({
  action: z.string().min(1).max(100),
  details: z.unknown().optional(),
  userId: z.string().max(64).optional(),
});

export async function POST(request: Request) {
  return handle(async () => {
    const actor = await requireApiActor();
    // Per-user ceiling so a signed-in client cannot flood the audit table.
    if (!(await rateLimit(`activity-log:${actor.id}`, 120, 60_000)).allowed) throw tooMany();
    const text = await request.text();
    if (text.length > 16 * 1024) throw badRequest("Payload too large.");
    let json: unknown;
    try { json = JSON.parse(text); } catch { throw badRequest("Invalid JSON."); }
    const parsed = body.safeParse(json);
    if (!parsed.success) throw badRequest("Invalid activity payload.");
    await recordClientActivity(actor, { action: parsed.data.action, details: parsed.data.details, userRef: parsed.data.userId });
    return NextResponse.json({ success: true });
  });
}
