import { beforeEach, describe, expect, it } from "vitest";
import { createLead } from "@/server/leads/ingest";
import {
  assignLeads, bulkSetLeadFields, createManualLead, deleteAllFiltered, getLeadOwnershipHistory, removeAssignments, transferAssignments, updateLead,
} from "@/server/leads/mutations";
import { listLeads } from "@/server/leads/queries";
import { parseLeadFilter, parseSort } from "@/server/leads/filter-schema";
import { getLeadTimeline } from "@/server/leads/timeline";
import { listVendors } from "@/server/vendors/vendors";
import { listProducts } from "@/server/catalog/products";
import { normalizeTags } from "@/lib/crm/constants";
import { actorOf, makeLead, makeUser, prisma, resetDb } from "./helpers/db";

type U = Awaited<ReturnType<typeof makeUser>>;
let admin: U, alice: U, bob: U;
const events = (leadId: string) =>
  prisma.leadAssignmentEvent.findMany({ where: { leadId }, orderBy: [{ createdAt: "asc" }, { action: "asc" }], select: { userId: true, action: true, reason: true, canUpdate: true, actorId: true } });

beforeEach(async () => {
  await resetDb();
  admin = await makeUser({ role: "ADMIN", name: "Admin" });
  alice = await makeUser({ name: "Alice" });
  bob = await makeUser({ name: "Bob" });
});

describe("LIKE wildcards are literal in list filters", () => {
  it("leads, vendors and products: '%' and '_' no longer match everything", async () => {
    await makeLead({ name: "Plain" });
    const pct = await makeLead({ name: "100% cotton" });
    expect((await listLeads(actorOf(admin), { filter: { q: "%" } })).rows.map((r) => r.id)).toEqual([pct.id]);
    expect((await listLeads(actorOf(admin), { filter: { q: "_" } })).total).toBe(0);
    await prisma.vendor.create({ data: { vendorCode: "VA001", name: "Acme", status: "ACTIVE" } });
    expect((await listVendors(actorOf(admin), { search: "%" })).total).toBe(0);
    await prisma.product.create({ data: { code: "P-1", name: "Mug", status: "ACTIVE" } });
    expect((await listProducts(actorOf(admin), { query: "_" })).total).toBe(0);
  });
});

describe("ownership history", () => {
  it("records create, assign, access change, transfer, unassign and edit with actor and reason", async () => {
    const { id } = await createManualLead(actorOf(alice), { name: "Hist", phone: "9000000001" });
    expect(await events(id)).toEqual([{ userId: alice.id, action: "ASSIGNED", reason: "create", canUpdate: true, actorId: alice.id }]);

    await assignLeads(actorOf(admin), { leadIds: [id], userIds: [bob.id], level: "view" });
    await assignLeads(actorOf(admin), { leadIds: [id], userIds: [bob.id], level: "update" });
    await transferAssignments(actorOf(admin), { leadIds: [id], targetUserId: alice.id });
    await updateLead(actorOf(admin), id, { assignedTo: [{ userId: bob.id, canUpdate: false }] });
    await removeAssignments(actorOf(admin), [id]);

    const rows = (await events(id)).map((e) => `${e.reason}:${e.action}:${e.userId === alice.id ? "alice" : "bob"}`);
    expect(rows).toEqual([
      "create:ASSIGNED:alice",
      "assign:ASSIGNED:bob",
      "assign:ACCESS_CHANGED:bob",
      "transfer:UNASSIGNED:bob", // alice is the target and keeps the same access, so she gets no row
      "edit:ASSIGNED:bob",
      "edit:UNASSIGNED:alice",
      "unassign:UNASSIGNED:bob",
    ]);
  });

  it("records import assignments with reason 'import' and does not write history for no-op re-assignments", async () => {
    const res = await createLead({ name: "Imp", phone: "9000000002" }, { source: "IMPORT", createdById: admin.id, assignTo: [{ userId: bob.id, canUpdate: false }], assignedBy: admin.id });
    if (res.status !== "created") throw new Error("expected created");
    await assignLeads(actorOf(admin), { leadIds: [res.leadId], userIds: [bob.id], level: "view" }); // same access: no event
    expect(await events(res.leadId)).toEqual([{ userId: bob.id, action: "ASSIGNED", reason: "import", canUpdate: false, actorId: admin.id }]);
  });

  it("history follows lead visibility", async () => {
    const lead = await makeLead({ name: "Scoped" }, [{ userId: alice.id }]);
    await expect(getLeadOwnershipHistory(actorOf(alice), lead.id)).resolves.toEqual([]);
    await expect(getLeadOwnershipHistory(actorOf(bob), lead.id)).rejects.toMatchObject({ status: 404 });
  });
});

describe("priority, tags, bulk fields, filters and sorting", () => {
  it("assignees with update access can set priority and normalised tags; invalid priority is rejected", async () => {
    const lead = await makeLead({ name: "P" }, [{ userId: alice.id, canUpdate: true }]);
    await updateLead(actorOf(alice), lead.id, { priority: "High", tags: [" Hot ", "hot", "Expo  2026"] });
    expect(await prisma.lead.findUniqueOrThrow({ where: { id: lead.id }, select: { priority: true, tags: true } })).toEqual({ priority: "High", tags: ["Hot", "Expo 2026"] });
    await expect(updateLead(actorOf(alice), lead.id, { priority: "Urgent" as never })).rejects.toMatchObject({ status: 400 });
    expect(normalizeTags(Array.from({ length: 30 }, (_, i) => `t${i}`))).toHaveLength(20);
  });

  it("existing leads keep priority NULL and no tags (no back-fill)", async () => {
    const lead = await makeLead({ name: "Old" });
    expect(await prisma.lead.findUniqueOrThrow({ where: { id: lead.id }, select: { priority: true, tags: true } })).toEqual({ priority: null, tags: [] });
  });

  it("bulkSetLeadFields is admin-only, writes status history only for leads that changed, and merges tags", async () => {
    const a = await makeLead({ name: "A", status: "New Lead" });
    const b = await makeLead({ name: "B", status: "In Progress", tags: ["vip"] });
    await expect(bulkSetLeadFields(actorOf(alice), { ids: [a.id], status: "Won Lead" })).rejects.toMatchObject({ status: 403 });
    await expect(bulkSetLeadFields(actorOf(admin), { ids: [a.id] })).rejects.toMatchObject({ status: 400 });
    const r = await bulkSetLeadFields(actorOf(admin), { ids: [a.id, b.id], status: "In Progress", priority: "Medium", addTags: ["VIP", "q4"] });
    expect(r).toEqual({ updated: 2, statusChanged: 1 });
    expect(await prisma.leadStatusHistory.count({ where: { leadId: a.id, fromStatus: "New Lead", toStatus: "In Progress" } })).toBe(1);
    expect(await prisma.leadStatusHistory.count({ where: { leadId: b.id } })).toBe(0);
    expect((await prisma.lead.findUniqueOrThrow({ where: { id: b.id } })).tags).toEqual(["vip", "q4"]);
    expect(await prisma.activityLog.count({ where: { action: "lead.bulk_fields_updated" } })).toBe(1);
  });

  it("filters by priority (incl. blank) and tag, and sorts by several keys with nulls last", async () => {
    const hi = await makeLead({ name: "Beta", priority: "High", tags: ["expo"] });
    const lo = await makeLead({ name: "Alpha", priority: "Low" });
    const none = await makeLead({ name: "Gamma" });
    const ids = async (f: Parameters<typeof parseLeadFilter>[0]) => (await listLeads(actorOf(admin), { filter: parseLeadFilter(f) })).rows.map((r) => r.id);
    expect(await ids({ priority: "High" })).toEqual([hi.id]);
    expect(await ids({ priority: "" })).toEqual([none.id]);
    expect(await ids({ tag: "expo" })).toEqual([hi.id]);
    expect(await ids({ sort: "name:asc" })).toEqual([lo.id, hi.id, none.id]);
    expect(await ids({ sort: ["status:asc", "name:desc"] })).toEqual([none.id, hi.id, lo.id]); // same status -> name desc breaks the tie
    expect(await ids({ sort: "priority:asc" })).toEqual([none.id, lo.id, hi.id]); // not sortable -> ignored -> default (newest first)
    expect(parseSort(["bogus:asc", "name:up", "name:asc", "company,status:asc,priority,location"])).toEqual([
      { field: "name", dir: "desc" }, { field: "company", dir: "desc" }, { field: "status", dir: "asc" },
    ]);
  });

  it("delete-all-matching still refuses when only a sort is given", async () => {
    await makeLead({ name: "Keep" });
    await expect(deleteAllFiltered(actorOf(admin), { filter: { sort: [{ field: "name", dir: "asc" }] } })).rejects.toMatchObject({ status: 400 });
    expect(await prisma.lead.count()).toBe(1);
  });
});

describe("lead timeline", () => {
  it("merges creation, status changes, ownership and activities newest-first; scoped like the lead", async () => {
    const { id } = await createManualLead(actorOf(alice), { name: "TL", phone: "9000000003" });
    await updateLead(actorOf(alice), id, { status: "In Progress" });
    await prisma.activity.create({ data: { type: "CALL", subject: "Intro call", leadId: id, createdById: alice.id, assigneeId: alice.id } });
    const tl = await getLeadTimeline(actorOf(alice), id);
    expect(tl.map((e) => e.kind).sort()).toEqual(["activity", "created", "ownership", "status"]);
    expect(tl.find((e) => e.kind === "status")?.title).toBe("Status: New Lead → In Progress");
    expect(tl.find((e) => e.kind === "activity")?.title).toBe("Call: Intro call");
    for (let i = 1; i < tl.length; i++) expect(tl[i - 1]!.at >= tl[i]!.at).toBe(true);
    await expect(getLeadTimeline(actorOf(bob), id)).rejects.toMatchObject({ status: 404 });
  });
});
