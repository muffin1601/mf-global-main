import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma/client";
import { isAdmin, type Actor } from "@/server/actor";
import { recordAudit } from "@/server/audit/log";
import { badRequest, conflict, forbidden, notFound } from "@/server/errors";

/**
 * Saved list views: a name plus the list page's URL query parameters (filters, sort, columns, density).
 * A view stores *parameters only*. Opening one re-runs the list through the normal server-side scope,
 * so a shared view can never reveal records the viewer could not already see.
 */
export const VIEW_ENTITIES = ["leads", "activities"] as const;
export type ViewEntity = (typeof VIEW_ENTITIES)[number];
export type ViewParams = Record<string, string | string[]>;
export type SavedViewDto = { id: string; name: string; params: ViewParams; shared: boolean; mine: boolean; owner: string };

const MAX_PARAMS_BYTES = 4096;
const MAX_VIEWS_PER_USER = 50;
/** Paging is never saved: a view always opens on page 1. */
const DROPPED_KEYS = new Set(["page", "create", "view-saved"]);

const entitySchema = z.enum(VIEW_ENTITIES);
const paramsSchema = z.record(z.string().max(40), z.union([z.string().max(500), z.array(z.string().max(500)).max(200)]));

export function sanitizeParams(raw: unknown): ViewParams {
  const parsed = paramsSchema.safeParse(raw);
  if (!parsed.success) throw badRequest("Invalid view parameters.");
  const out: ViewParams = {};
  for (const [k, v] of Object.entries(parsed.data)) {
    if (DROPPED_KEYS.has(k)) continue;
    if (Array.isArray(v) ? v.length === 0 : v === "") continue;
    out[k] = v;
  }
  if (Buffer.byteLength(JSON.stringify(out)) > MAX_PARAMS_BYTES) throw badRequest("This view has too many filters to save.");
  return out;
}

/** Turn saved params back into a query string for navigation. */
export function viewQuery(params: ViewParams): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) for (const x of Array.isArray(v) ? v : [v]) p.append(k, x);
  return p.toString();
}

export async function listSavedViews(actor: Actor, entity: string): Promise<SavedViewDto[]> {
  const e = entitySchema.parse(entity);
  const rows = await prisma.savedView.findMany({
    where: { entity: e, OR: [{ userId: actor.id }, { shared: true }] },
    orderBy: [{ name: "asc" }, { id: "asc" }],
    include: { user: { select: { name: true } } },
  });
  return rows.map((r) => ({ id: r.id, name: r.name, params: r.params as ViewParams, shared: r.shared, mine: r.userId === actor.id, owner: r.user.name }));
}

const saveSchema = z.object({
  entity: entitySchema,
  name: z.string().trim().min(1, "Name the view.").max(60),
  params: z.unknown(),
  shared: z.boolean().optional().default(false),
});

/** Create a view, or overwrite the actor's own view of the same name. */
export async function saveView(actor: Actor, raw: z.input<typeof saveSchema>): Promise<SavedViewDto> {
  const r = saveSchema.safeParse(raw);
  if (!r.success) throw badRequest(r.error.issues[0]?.message ?? "Invalid view.");
  const input = r.data;
  if (input.shared && !can(actor.role, "views.share")) throw forbidden("Only administrators can share views.");
  const params = sanitizeParams(input.params);
  const existing = await prisma.savedView.findUnique({ where: { userId_entity_name: { userId: actor.id, entity: input.entity, name: input.name } }, select: { id: true } });
  if (!existing && (await prisma.savedView.count({ where: { userId: actor.id } })) >= MAX_VIEWS_PER_USER) throw conflict(`You can keep up to ${MAX_VIEWS_PER_USER} saved views.`);
  try {
    const row = await prisma.savedView.upsert({
      where: { userId_entity_name: { userId: actor.id, entity: input.entity, name: input.name } },
      create: { userId: actor.id, entity: input.entity, name: input.name, params, shared: input.shared },
      update: { params, shared: input.shared },
    });
    if (row.shared) await recordAudit(actor, "view.shared", { viewId: row.id, entity: row.entity, name: row.name });
    return { id: row.id, name: row.name, params, shared: row.shared, mine: true, owner: actor.name };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw conflict("A view with that name already exists.");
    throw error;
  }
}

export async function deleteView(actor: Actor, id: string) {
  const row = await prisma.savedView.findUnique({ where: { id } });
  if (!row || (!row.shared && row.userId !== actor.id)) throw notFound("View not found.");
  if (row.userId !== actor.id && !isAdmin(actor)) throw forbidden("You can only delete your own views.");
  await prisma.savedView.delete({ where: { id } });
}
