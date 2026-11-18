import { NextResponse } from "next/server";
import { handle, requireApiActor } from "@/lib/auth/api";
import { listVendors } from "@/server/vendors/vendors";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handle(async () => {
    const actor = await requireApiActor();
    const q = Object.fromEntries(new URL(request.url).searchParams);
    return NextResponse.json(await listVendors(actor, q), { headers: { "Cache-Control": "no-store" } });
  });
}
