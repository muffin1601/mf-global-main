import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { provisionAuthUsers, type AuthAdminPort } from "@/server/auth/provision";
import { prisma, resetDb } from "./helpers/db";

function fakeAuth(existing: Record<string, string> = {}) {
  const created: { email: string; password: string; banned: boolean; metadata: Record<string, string> }[] = [];
  const invites: string[] = [];
  const port: AuthAdminPort & { failFor?: string } = {
    async findUserIdByEmail(email) { return existing[email] ?? null; },
    async createUser(input) {
      if (port.failFor === input.email) throw new Error(`boom for ${input.email}`);
      created.push(input);
      const id = randomUUID(); existing[input.email] = id; return { id };
    },
    async sendRecoveryEmail(email) { invites.push(email); },
  };
  return { port, created, invites, existing };
}

async function legacyUsers() {
  // Migrated rows: have legacy ids and roles, but NO auth identity.
  const mk = (userId: string, role: "ADMIN" | "USER", enabled: boolean, email: string | null) =>
    prisma.user.create({ data: { userId, name: `Name ${userId}`, username: userId.toLowerCase(), email, role, enabled, legacyId: `legacy-${userId}` } });
  return {
    admin: await mk("A001", "ADMIN", true, "admin@example.test"),
    admin2: await mk("A002", "ADMIN", true, "admin2@example.test"),
    user: await mk("U001", "USER", true, "user@example.test"),
    off: await mk("U002", "USER", false, "off@example.test"),
    noEmail: await mk("U003", "USER", true, null),
  };
}

describe("auth identity provisioning (DB-03)", () => {
  beforeEach(resetDb);

  it("dry run changes nothing and reports the plan", async () => {
    await legacyUsers();
    const { port, created } = fakeAuth();
    const report = await provisionAuthUsers(prisma, port, { apply: false });
    expect(created).toHaveLength(0);
    expect(await prisma.user.count({ where: { authUserId: { not: null } } })).toBe(0);
    expect(report).toMatchObject({ mode: "dry-run", considered: 5, skippedNoEmail: ["U003"] });
    expect(report.plan.filter((p) => p.action === "create")).toHaveLength(4);
  });

  it("links every user with an email, preserving role, username, code and enabled state", async () => {
    const before = await legacyUsers();
    const { port, created } = fakeAuth();
    const report = await provisionAuthUsers(prisma, port, { apply: true });
    expect(report).toMatchObject({ created: 4, alreadyLinked: 0, failures: [], bannedBecauseDisabled: 1, hasLinkedEnabledAdmin: true });
    const after = await prisma.user.findMany({ orderBy: { userId: "asc" } });
    for (const u of after) {
      const was = Object.values(before).find((b) => b.id === u.id)!;
      expect({ role: u.role, enabled: u.enabled, username: u.username, userId: u.userId, name: u.name, email: u.email }).toEqual({ role: was.role, enabled: was.enabled, username: was.username, userId: was.userId, name: was.name, email: was.email });
    }
    expect(after.filter((u) => u.authUserId).length).toBe(4);
    expect(after.find((u) => u.userId === "U003")!.authUserId).toBeNull(); // no email: reported, not invented
    expect(created.find((c) => c.email === "off@example.test")!.banned).toBe(true);
    expect(created.find((c) => c.email === "user@example.test")!.banned).toBe(false);
  });

  it("never reuses a legacy password hash: every identity gets a unique random password that is not reported", async () => {
    await legacyUsers();
    const { port, created } = fakeAuth();
    const report = await provisionAuthUsers(prisma, port, { apply: true });
    const passwords = created.map((c) => c.password);
    expect(new Set(passwords).size).toBe(passwords.length);
    for (const p of passwords) { expect(p.length).toBeGreaterThanOrEqual(32); expect(JSON.stringify(report)).not.toContain(p); }
  });

  it("is idempotent and resumes after a partial failure without duplicating identities", async () => {
    await legacyUsers();
    const fake = fakeAuth();
    fake.port.failFor = "user@example.test";
    const first = await provisionAuthUsers(prisma, fake.port, { apply: true });
    expect(first.failures).toEqual([{ userCode: "U001", reason: expect.stringContaining("boom") }]);
    expect(JSON.stringify(first.failures)).not.toContain("user@example.test"); // no email in reports
    fake.port.failFor = undefined;
    const second = await provisionAuthUsers(prisma, fake.port, { apply: true });
    expect(second).toMatchObject({ created: 1, alreadyLinked: 3, failures: [] });
    const third = await provisionAuthUsers(prisma, fake.port, { apply: true });
    expect(third).toMatchObject({ created: 0, alreadyLinked: 4 });
    expect(fake.created).toHaveLength(4);
  });

  it("links an identity that already exists in Supabase instead of creating a duplicate", async () => {
    await legacyUsers();
    const preExisting = randomUUID();
    const fake = fakeAuth({ "admin@example.test": preExisting });
    const report = await provisionAuthUsers(prisma, fake.port, { apply: true });
    expect(report.linkedExisting).toBe(1);
    expect((await prisma.user.findFirstOrThrow({ where: { userId: "A001" } })).authUserId).toBe(preExisting);
    expect(fake.created.find((c) => c.email === "admin@example.test")).toBeUndefined();
  });

  it("sends reset emails only when explicitly requested, and never to disabled users", async () => {
    await legacyUsers();
    const quiet = fakeAuth();
    await provisionAuthUsers(prisma, quiet.port, { apply: true });
    expect(quiet.invites).toHaveLength(0);
    await resetDb(); await legacyUsers();
    const loud = fakeAuth();
    const report = await provisionAuthUsers(prisma, loud.port, { apply: true, sendInvites: true });
    expect(report.invitesSent).toBe(3);
    expect(loud.invites).not.toContain("off@example.test");
  });

  it("flags a run that leaves no enabled administrator with a login", async () => {
    await prisma.user.create({ data: { userId: "A009", name: "Only Admin", username: "a9", email: null, role: "ADMIN", enabled: true } });
    const report = await provisionAuthUsers(prisma, fakeAuth().port, { apply: true });
    expect(report.hasLinkedEnabledAdmin).toBe(false);
  });
});
