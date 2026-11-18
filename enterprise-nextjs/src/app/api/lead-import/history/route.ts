import { NextResponse } from "next/server";
import { handle, requireApiActor } from "@/lib/auth/api";
import { listImportHistory } from "@/server/imports/service";

export const dynamic = "force-dynamic";

export const GET = (request: Request) => handle(async () => {
  const actor = await requireApiActor();
  const limit = Number(new URL(request.url).searchParams.get("limit")) || 50;
  return NextResponse.json(await listImportHistory(actor, limit));
});
