import { NextResponse } from "next/server";
import { z } from "zod";
import { handle, requireApiActor } from "@/lib/auth/api";
import { BATCH_SIZE } from "@/lib/imports/lead-csv";
import { processImportBatch } from "@/server/imports/service";
import { badRequest } from "@/server/errors";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const text = z.string().max(2000).optional();
const data = z.object({
  company: text, name: text, phone: text, email: text, location: text, state: text, category: text,
  requirements: z.string().max(5000).optional(), remarks: z.string().max(5000).optional(), contact: text,
  datatype: text, quantity: text, address: text,
}).strict();
const schema = z.object({
  sha256: z.string(),
  entries: z.array(z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("row"), rowNumber: z.number().int(), data }),
    z.object({ kind: z.literal("report"), rowNumber: z.number().int(), company: z.string().max(300), status: z.enum(["Skipped", "Duplicate"]), reason: z.string().max(300) }),
  ])).max(BATCH_SIZE),
});

export const POST = (request: Request, ctx: { params: Promise<{ id: string }> }) => handle(async () => {
  const actor = await requireApiActor();
  const { id } = await ctx.params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) throw badRequest("Invalid batch.");
  return NextResponse.json(await processImportBatch(actor, id, parsed.data));
});
