import { NextResponse } from "next/server";
import { z } from "zod";
import { handle, requireApiActor } from "@/lib/auth/api";
import { findExistingContacts } from "@/server/imports/service";
import { badRequest } from "@/server/errors";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const schema = z.object({ phones: z.array(z.string().max(20)).max(5000), emails: z.array(z.string().max(254)).max(5000) });

/** Preview helper: which of these phones/emails already exist as leads? (no lead data is returned) */
export const POST = (request: Request) => handle(async () => {
  const actor = await requireApiActor();
  // The check is CRM-wide (import dedupe needs it), so throttle it: without a limit any user could test thousands
  // of phone numbers per second for membership in the whole lead database.
  const limit = await rateLimit(`lead-import-check:${actor.id}`, 30, 60_000);
  if (!limit.allowed) return NextResponse.json({ error: "Too many checks. Please wait a minute." }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) throw badRequest("Invalid request.");
  const found = await findExistingContacts(parsed.data.phones, parsed.data.emails);
  return NextResponse.json({ phones: [...found.phones], emails: [...found.emails] });
});
