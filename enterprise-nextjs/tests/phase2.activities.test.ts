import { beforeEach, describe, expect, it } from "vitest";
import {
  activityCounts, addActivityComment, cancelActivity, completeActivity, createActivity, deleteActivity, getActivity, listActivities, reopenActivity, updateActivity, viewWhere,
} from "@/server/activities/service";
import { deleteView, listSavedViews, sanitizeParams, saveView, viewQuery } from "@/server/views/service";
import { actorOf, makeLead, makeUser, prisma, resetDb } from "./helpers/db";

type U = Awaited<ReturnType<typeof makeUser>>;
let admin: U, alice: U, bob: U;
beforeEach(async () => {
  await resetDb();
  admin = await makeUser({ role: "ADMIN", name: "Admin" });
  alice = await makeUser({ name: "Alice" });
  bob = await makeUser({ name: "Bob" });
});

// 2026-11-20 10:00 IST = 04:30 UTC
const NOW = new Date("2026-11-20T04:30:00.000Z");
const ist = (d: string, t: string) => new Date(`${d}T${t}:00.000+05:30`);

describe("createActivity — access rules", () => {
  it("a user logs activities on leads they can edit; view-only is 403, invisible lead is 404", async () => {
    const editable = await makeLead({ name: "E" }, [{ userId: alice.id, canUpdate: true }]);
    const viewOnly = await makeLead({ name: "V" }, [{ userId: alice.id, canUpdate: false }]);
    const other = await makeLead({ name: "O" });
    const a = await createActivity(actorOf(alice), { type: "CALL", subject: "Intro", leadId: editable.id });
    expect(a).toMatchObject({ assigneeId: alice.id, createdById: alice.id, status: "OPEN" });
    await expect(createActivity(actorOf(alice), { type: "CALL", subject: "x", leadId: viewOnly.id })).rejects.toMatchObject({ status: 403 });
    await expect(createActivity(actorOf(alice), { type: "CALL", subject: "x", leadId: other.id })).rejects.toMatchObject({ status: 404 });
    expect((await prisma.lead.findUniqueOrThrow({ where: { id: editable.id } })).lastActivityAt).not.toBeNull();
    expect(await prisma.activityLog.count({ where: { action: "activity.created" } })).toBe(1);
  });

  it("only admins assign to someone else; disabled users cannot be assignees", async () => {
    await expect(createActivity(actorOf(alice), { type: "TASK", subject: "t", assigneeId: bob.id })).rejects.toMatchObject({ status: 403 });
    const t = await createActivity(actorOf(admin), { type: "TASK", subject: "t", assigneeId: bob.id });
    expect(t.assigneeId).toBe(bob.id);
    const off = await makeUser({ enabled: false });
    await expect(createActivity(actorOf(admin), { type: "TASK", subject: "t", assigneeId: off.id })).rejects.toMatchObject({ status: 404 });
  });

  it("validates: follow-ups need a due date, notes cannot be completed or have a due date, subject required", async () => {
    await expect(createActivity(actorOf(alice), { type: "FOLLOW_UP", subject: "f" })).rejects.toMatchObject({ status: 400 });
    await expect(createActivity(actorOf(alice), { type: "NOTE", subject: "n", completed: true })).rejects.toMatchObject({ status: 400 });
    await expect(createActivity(actorOf(alice), { type: "TASK", subject: "  " })).rejects.toMatchObject({ status: 400 });
    const note = await createActivity(actorOf(alice), { type: "NOTE", subject: "n", dueAt: NOW });
    expect(note.dueAt).toBeNull();
  });

  it("is only completed by an explicit action (log as done) — never automatically", async () => {
    const open = await createActivity(actorOf(alice), { type: "CALL", subject: "planned", dueAt: NOW });
    const done = await createActivity(actorOf(alice), { type: "CALL", subject: "happened", completed: true, outcome: "Interested" });
    expect(open.status).toBe("OPEN");
    expect(done).toMatchObject({ status: "COMPLETED", completedById: alice.id, outcome: "Interested" });
  });
});

describe("transitions", () => {
  it("complete is idempotent under concurrent requests and audited once; reopen and cancel work", async () => {
    const a = await createActivity(actorOf(alice), { type: "TASK", subject: "t" });
    const results = await Promise.all([completeActivity(actorOf(alice), a.id, "done"), completeActivity(actorOf(alice), a.id, "done")]);
    expect(results.every((r) => r.status === "COMPLETED")).toBe(true);
    expect(await prisma.activityLog.count({ where: { action: "activity.completed" } })).toBe(1);
    expect((await reopenActivity(actorOf(alice), a.id)).completedAt).toBeNull();
    expect((await cancelActivity(actorOf(alice), a.id)).status).toBe("CANCELLED");
  });

  it("only creator, assignee or admin may change; only creator or admin may delete", async () => {
    const lead = await makeLead({ name: "Shared" }, [{ userId: alice.id }, { userId: bob.id, canUpdate: false }]);
    const a = await createActivity(actorOf(alice), { type: "TASK", subject: "t", leadId: lead.id });
    // Bob can SEE it through the lead (timeline/detail) but cannot change it.
    await expect(getActivity(actorOf(bob), a.id)).resolves.toMatchObject({ id: a.id });
    await expect(updateActivity(actorOf(bob), a.id, { subject: "hijack" })).rejects.toMatchObject({ status: 403 });
    await expect(completeActivity(actorOf(bob), a.id)).rejects.toMatchObject({ status: 403 });
    await expect(deleteActivity(actorOf(bob), a.id)).rejects.toMatchObject({ status: 403 });
    await expect(addActivityComment(actorOf(bob), a.id, "seen")).resolves.toMatchObject({ body: "seen" });
    const outsider = await makeUser();
    await expect(getActivity(actorOf(outsider), a.id)).rejects.toMatchObject({ status: 404 });
    await deleteActivity(actorOf(admin), a.id);
    expect(await prisma.activity.count()).toBe(0);
  });
});

describe("workspace views (IST)", () => {
  it("today / upcoming / overdue / completed use Asia/Kolkata days and exclude notes", async () => {
    const mk = (subject: string, dueAt: Date | null, extra: object = {}) =>
      prisma.activity.create({ data: { type: "TASK", subject, dueAt, createdById: alice.id, assigneeId: alice.id, ...extra } });
    await mk("today-early", ist("2026-11-20", "00:05"));
    await mk("today-late", ist("2026-11-20", "23:55"));
    await mk("tomorrow", ist("2026-11-21", "00:00"));
    await mk("yesterday", ist("2026-11-19", "23:59"));
    await mk("done", ist("2026-11-19", "10:00"), { status: "COMPLETED", completedAt: NOW });
    await mk("note", null, { type: "NOTE" });
    const subjects = async (view: "today" | "upcoming" | "overdue" | "completed" | "all") =>
      (await listActivities(actorOf(alice), { view, now: NOW })).rows.map((r) => r.subject);
    expect(await subjects("today")).toEqual(["today-early", "today-late"]);
    expect(await subjects("upcoming")).toEqual(["tomorrow"]);
    expect(await subjects("overdue")).toEqual(["yesterday"]);
    expect(await subjects("completed")).toEqual(["done"]);
    expect((await subjects("all")).sort()).toHaveLength(6);
    expect(await activityCounts(actorOf(alice), { now: NOW })).toEqual({ today: 2, upcoming: 1, overdue: 1 });
    expect(viewWhere("all")).toEqual({});
  });

  it("users list only their own (assigned or created); admins list everyone and can filter by assignee", async () => {
    await prisma.activity.create({ data: { type: "TASK", subject: "alice's", createdById: alice.id, assigneeId: alice.id } });
    await prisma.activity.create({ data: { type: "TASK", subject: "bob's", createdById: bob.id, assigneeId: bob.id } });
    await prisma.activity.create({ data: { type: "TASK", subject: "for alice", createdById: admin.id, assigneeId: alice.id } });
    const list = async (u: U, q: object = {}) => (await listActivities(actorOf(u), { view: "all", ...q })).rows.map((r) => r.subject).sort();
    expect(await list(alice)).toEqual(["alice's", "for alice"]);
    expect(await list(bob)).toEqual(["bob's"]);
    expect(await list(admin)).toHaveLength(3);
    expect(await list(admin, { assigneeId: bob.id })).toEqual(["bob's"]);
    expect(await list(admin, { q: "%" })).toEqual([]);
  });
});

describe("saved views", () => {
  it("saves, overwrites by name, lists own + shared, and never stores page", async () => {
    await saveView(actorOf(alice), { entity: "leads", name: "Hot", params: { priority: "High", page: "4", tag: ["expo"] } });
    await saveView(actorOf(alice), { entity: "leads", name: "Hot", params: { priority: "High" } });
    await saveView(actorOf(admin), { entity: "leads", name: "Team", params: { status: "In Progress" }, shared: true });
    await saveView(actorOf(bob), { entity: "leads", name: "Bob only", params: { q: "x" } });
    const mine = await listSavedViews(actorOf(alice), "leads");
    expect(mine.map((v) => `${v.name}:${v.mine}`)).toEqual(["Hot:true", "Team:false"]);
    expect(mine[0]!.params).toEqual({ priority: "High" });
    expect(viewQuery({ tag: ["a", "b"], q: "x y" })).toBe("tag=a&tag=b&q=x+y");
    expect(sanitizeParams({ page: "2", q: "", tag: [] })).toEqual({});
  });

  it("only admins share; users cannot delete others' views; oversized params are rejected", async () => {
    await expect(saveView(actorOf(alice), { entity: "leads", name: "S", params: {}, shared: true })).rejects.toMatchObject({ status: 403 });
    const shared = await saveView(actorOf(admin), { entity: "leads", name: "Team", params: {}, shared: true });
    await expect(deleteView(actorOf(alice), shared.id)).rejects.toMatchObject({ status: 403 });
    const bobs = await saveView(actorOf(bob), { entity: "leads", name: "B", params: {} });
    await expect(deleteView(actorOf(alice), bobs.id)).rejects.toMatchObject({ status: 404 });
    await expect(saveView(actorOf(alice), { entity: "leads", name: "Big", params: { tag: Array.from({ length: 200 }, (_, i) => `tag-${i}-xxxxxxxxxxxxxxxx`) } })).rejects.toMatchObject({ status: 400 });
    await expect(saveView(actorOf(alice), { entity: "nope" as never, name: "x", params: {} })).rejects.toMatchObject({ status: 400 });
  });
});
