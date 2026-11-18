import { NextResponse } from "next/server";
import { z } from "zod";
import { handle, requireApiActor } from "@/lib/auth/api";
import { findExistingContacts } from "@/server/imports/service";
import { badRequest } from "@/server/errors";

export const dynamic = "force-dynamic";

const schema = z.object({ phones: z.array(z.string().max(20)).max(5000), emails: z.array(z.string().max(254)).max(5000) });

/** Preview helper: which of these phones/emails already exist as leads? (no lead data is returned) */
export const POST = (request: Request) => handle(async () => {
  await requireApiActor();
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) throw badRequest("Invalid request.");
  const found = await findExistingContacts(parsed.data.phones, parsed.data.emails);
  return NextResponse.json({ phones: [...found.phones], emails: [...found.emails] });
});
