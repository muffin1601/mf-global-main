"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import type { Actor } from "@/server/actor";
import { HttpError } from "@/server/errors";
import { deleteView, saveView, type SavedViewDto } from "@/server/views/service";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

async function run<T extends object>(fn: (a: Actor) => Promise<T>): Promise<Result<T>> {
  const u = await requireUser();
  try {
    const out = await fn({ id: u.id, role: u.role, name: u.name, userId: u.userId, email: u.email });
    revalidatePath("/crm", "layout");
    return { ok: true, ...out };
  } catch (error) {
    if (error instanceof HttpError) return { ok: false, error: error.message };
    console.error("saved view action failed", error instanceof Error ? error.message : String(error));
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

/** `query` is the list page's current query string; the server sanitises it (page is never saved). */
export async function saveViewAction(entity: string, name: string, query: string, shared: boolean): Promise<Result<{ view: SavedViewDto }>> {
  const params: Record<string, string | string[]> = {};
  for (const [k, v] of new URLSearchParams(query)) {
    const prev = params[k];
    params[k] = prev === undefined ? v : Array.isArray(prev) ? [...prev, v] : [prev, v];
  }
  return run(async (a) => ({ view: await saveView(a, { entity: entity as never, name, params, shared }) }));
}

export async function deleteViewAction(id: string): Promise<Result> {
  return run(async (a) => { await deleteView(a, id); return {}; });
}
