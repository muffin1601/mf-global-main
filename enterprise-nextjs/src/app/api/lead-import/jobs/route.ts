import { NextResponse } from "next/server";
import { z } from "zod";
import { handle, requireApiActor } from "@/lib/auth/api";
import { startImportJob } from "@/server/imports/service";
import { badRequest } from "@/server/errors";

export const dynamic = "force-dynamic";

const schema = z.object({
  fileName: z.string().trim().min(1).max(255),
  totalRows: z.number().int(),
  sha256: z.string(),
  clientKey: z.string(),
  assignTo: z.string().nullish(),
});

export const POST = (request: Request) => handle(async () => {
  const actor = await requireApiActor();
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) throw badRequest("Invalid request.");
  const { job, resumed } = await startImportJob(actor, parsed.data);
  return NextResponse.json({ jobId: job.id, resumed, totalRows: job.totalRows, imported: job.imported, status: job.status });
});
