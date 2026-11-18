import "server-only";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import type { Actor } from "@/server/actor";
import { HttpError } from "@/server/errors";

/** Resolve the signed-in, enabled user for a Route Handler, or throw HttpError. */
export async function requireApiActor(options: { admin?: boolean } = {}): Promise<Actor> {
  const user = await getCurrentUser();
  if (!user) throw new HttpError(401, "Authentication required", "UNAUTHENTICATED");
  if (!user.enabled) throw new HttpError(403, "This account is disabled", "DISABLED");
  if (options.admin && user.role !== "ADMIN") throw new HttpError(403, "Administrator access required", "FORBIDDEN");
  return { id: user.id, role: user.role, name: user.name, userId: user.userId, email: user.email };
}

/** Wrap a Route Handler body so HttpError becomes a JSON error response. */
export async function handle(run: () => Promise<Response>): Promise<Response> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof HttpError) {
      const headers: Record<string, string> = {};
      if (error.status === 429) headers["Retry-After"] = "60";
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status, headers });
    }
    console.error("api: unhandled error", error instanceof Error ? error.message : String(error));
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
