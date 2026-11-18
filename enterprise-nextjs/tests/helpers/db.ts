import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma/client";
import type { Actor } from "@/server/actor";

export { prisma };

/** Empty every application table (keeps the migration history). */
export async function resetDb() {
  const rows = await prisma.$queryRaw<{ tablename: string }[]>`
    select tablename from pg_tables where schemaname = 'public' and tablename <> '_prisma_migrations'`;
  const list = rows.map((r) => `"public"."${r.tablename}"`).join(", ");
  await prisma.$executeRawUnsafe(`TRUNCATE ${list} RESTART IDENTITY CASCADE`);
}

let seq = 0;
export async function makeUser(overrides: { role?: "ADMIN" | "USER"; name?: string; enabled?: boolean; email?: string } = {}) {
  const n = ++seq;
  return prisma.user.create({
    data: {
      userId: `T${String(n).padStart(3, "0")}-${randomUUID().slice(0, 4)}`,
      name: overrides.name ?? `Test User ${n}`,
      username: `user${n}-${randomUUID().slice(0, 4)}`,
      email: overrides.email ?? `user${n}-${randomUUID().slice(0, 4)}@example.test`,
      role: overrides.role ?? "USER",
      enabled: overrides.enabled ?? true,
      authUserId: randomUUID(),
    },
  });
}

export const actorOf = (user: { id: string; role: "ADMIN" | "USER"; name: string; userId: string; email: string | null }): Actor => ({
  id: user.id, role: user.role, name: user.name, userId: user.userId, email: user.email,
});

export async function makeLead(data: Record<string, unknown> = {}, assignTo?: { userId: string; canUpdate?: boolean; canDelete?: boolean }[]) {
  const n = ++seq;
  const lead = await prisma.lead.create({
    data: { name: `Lead ${n}`, company: `Company ${n}`, phone: `9${String(n).padStart(9, "0")}`, ...data } as never,
  });
  for (const a of assignTo ?? []) {
    await prisma.leadAssignment.create({ data: { leadId: lead.id, userId: a.userId, canView: true, canUpdate: a.canUpdate ?? true, canDelete: a.canDelete ?? false } });
  }
  return lead;
}
