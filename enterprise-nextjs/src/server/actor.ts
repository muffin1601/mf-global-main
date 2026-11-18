import { forbidden } from "./errors";

// The authenticated, enabled application user. Services take an Actor so they
// can be unit-tested without Next.js request context.
export type Actor = { id: string; role: "ADMIN" | "USER"; name: string; userId?: string; email?: string | null };

export const isAdmin = (actor: Actor) => actor.role === "ADMIN";

export function assertAdmin(actor: Actor) {
  if (!isAdmin(actor)) throw forbidden("Administrator access required.");
}

/** Prisma `where` that limits leads to what the actor may see. */
export const leadScope = (actor: Actor) =>
  isAdmin(actor) ? {} : { assignments: { some: { userId: actor.id, canView: true } } };
