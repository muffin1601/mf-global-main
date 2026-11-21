import { beforeAll, describe, expect, it } from "vitest";
import { actorOf, makeUser, prisma, resetDb } from "./helpers/db";
import { listActivity, listActivityUsers, recordClientActivity } from "@/server/activity/service";

let admin: Awaited<ReturnType<typeof makeUser>>;
let alice: Awaited<ReturnType<typeof makeUser>>;
let bob: Awaited<ReturnType<typeof makeUser>>;

const at = (s: string) => new Date(s);

beforeAll(async () => {
  await resetDb();
  admin = await makeUser({ role: "ADMIN" });
  alice = await makeUser({ name: "Alice Anand" });
  bob = await makeUser({ name: "Bob Bhat" });
  const rows = [
    { userId: alice.id, action: "lead.updated", occurredAt: at("2026-11-17T18:29:59Z"), details: { leadId: "x" } },
    { userId: alice.id, action: "lead.created", occurredAt: at("2026-11-17T18:30:00Z") },
    { userId: bob.id, action: "download.leads", occurredAt: at("2026-11-18T10:00:00Z") },
    // migrated row with no user link
    { userId: null, actorUserCode: alice.userId, actorName: "Alice Legacy", actorRole: "user", action: "legacy.login", occurredAt: at("2026-11-18T11:00:00Z") },
    { userId: null, actorUserCode: "OLD-9", actorName: "Gone Person", actorRole: "admin", action: "legacy.export", occurredAt: at("2026-11-18T12:00:00Z") },
  ];
  for (const r of rows) await prisma.activityLog.create({ data: r });
  for (let i = 0; i < 30; i++) await prisma.activityLog.create({ data: { userId: bob.id, action: `bulk.${i}`, occurredAt: at("2026-10-01T00:00:00Z") } });
});

describe("activity log listing", () => {
  it("is admin only", async () => {
    await expect(listActivity(actorOf(alice))).rejects.toMatchObject({ status: 403 });
    await expect(listActivityUsers(actorOf(alice))).rejects.toMatchObject({ status: 403 });
    expect((await listActivity(actorOf(admin))).total).toBe(35);
  });
  it("filters by user, including legacy rows matched by user code", async () => {
    const r = await listActivity(actorOf(admin), { userId: alice.id });
    expect(r.items.map((i) => i.action).sort()).toEqual(["lead.created", "lead.updated", "legacy.login"]);
    const legacy = r.items.find((i) => i.action === "legacy.login")!;
    expect(legacy.name).toBe("Alice Legacy");
    expect(legacy.role).toBe("user");
  });
  it("filters by IST dates (boundary 18:30Z) and rejects bad ranges", async () => {
    const day17 = await listActivity(actorOf(admin), { from: "2026-11-17", to: "2026-11-17" });
    expect(day17.items.map((i) => i.action)).toEqual(["lead.updated"]);
    const day18 = await listActivity(actorOf(admin), { from: "2026-11-18", to: "2026-11-18" });
    expect(day18.total).toBe(4);
    expect(day18.items[0]?.action).toBe("legacy.export"); // newest first
    await expect(listActivity(actorOf(admin), { from: "2026-11-18", to: "2026-11-01" })).rejects.toMatchObject({ status: 400 });
    await expect(listActivity(actorOf(admin), { from: "nope" })).rejects.toMatchObject({ status: 400 });
    await expect(listActivity(actorOf(admin), { userId: "not-a-uuid" })).rejects.toMatchObject({ status: 400 });
  });
  it("text search covers action, user name and legacy actor fields", async () => {
    expect((await listActivity(actorOf(admin), { q: "DOWNLOAD" })).items.map((i) => i.action)).toEqual(["download.leads"]);
    expect((await listActivity(actorOf(admin), { q: "bob bhat" })).total).toBe(31);
    expect((await listActivity(actorOf(admin), { q: "gone person" })).items.map((i) => i.action)).toEqual(["legacy.export"]);
    expect((await listActivity(actorOf(admin), { q: "OLD-9" })).total).toBe(1);
  });
  it("paginates server-side without overlap", async () => {
    const p1 = await listActivity(actorOf(admin), { pageSize: 20, page: 1 });
    const p2 = await listActivity(actorOf(admin), { pageSize: 20, page: 2 });
    expect(p1.items).toHaveLength(20);
    expect(p2.items).toHaveLength(15);
    expect(p1.pages).toBe(2);
    const ids = new Set([...p1.items, ...p2.items].map((i) => i.id));
    expect(ids.size).toBe(35);
    expect((await listActivity(actorOf(admin), { pageSize: 9999 })).pageSize).toBe(200);
  });
});

describe("POST /activity/log service", () => {
  it("logs as the caller and stores details", async () => {
    const { id } = await recordClientActivity(actorOf(alice), { action: "download.excel", details: { file: "a.xlsx" } });
    const row = await prisma.activityLog.findUniqueOrThrow({ where: { id } });
    expect(row).toMatchObject({ userId: alice.id, action: "client.download.excel", details: { file: "a.xlsx" } });
  });
  it("cannot forge a server audit event: client actions are namespaced", async () => {
    const { id } = await recordClientActivity(actorOf(alice), { action: "lead.deleted", details: { count: 999 } });
    expect((await prisma.activityLog.findUniqueOrThrow({ where: { id } })).action).toBe("client.lead.deleted");
    expect(await prisma.activityLog.count({ where: { action: "lead.deleted", userId: alice.id } })).toBe(0);
  });
  it("lets a user pass their own code or id, never someone else", async () => {
    await recordClientActivity(actorOf(alice), { action: "self", userRef: alice.userId });
    await recordClientActivity(actorOf(alice), { action: "self2", userRef: alice.id });
    await expect(recordClientActivity(actorOf(alice), { action: "spoof", userRef: bob.userId })).rejects.toMatchObject({ status: 403 });
    await expect(recordClientActivity(actorOf(alice), { action: "spoof", userRef: bob.id })).rejects.toMatchObject({ status: 403 });
    expect(await prisma.activityLog.count({ where: { action: { in: ["spoof", "client.spoof"] } } })).toBe(0);
  });
  it("admin may log for another user; unknown user is 404", async () => {
    const { id } = await recordClientActivity(actorOf(admin), { action: "on-behalf", userRef: bob.userId });
    const row = await prisma.activityLog.findUniqueOrThrow({ where: { id } });
    expect(row.userId).toBe(bob.id);
    expect(row.details).toMatchObject({ loggedBy: { id: admin.id } });
    await expect(recordClientActivity(actorOf(admin), { action: "x", userRef: "NOPE" })).rejects.toMatchObject({ status: 404 });
  });
  it("validates and limits the payload", async () => {
    await expect(recordClientActivity(actorOf(alice), { action: "" })).rejects.toMatchObject({ status: 400 });
    await expect(recordClientActivity(actorOf(alice), { action: 5 })).rejects.toMatchObject({ status: 400 });
    await expect(recordClientActivity(actorOf(alice), { action: "a".repeat(101) })).rejects.toMatchObject({ status: 400 });
    await expect(recordClientActivity(actorOf(alice), { action: "big", details: { blob: "x".repeat(9000) } })).rejects.toMatchObject({ status: 400 });
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    await expect(recordClientActivity(actorOf(alice), { action: "circ", details: circular })).rejects.toMatchObject({ status: 400 });
  });
});
