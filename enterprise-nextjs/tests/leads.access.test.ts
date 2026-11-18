import { beforeEach, describe, expect, it } from "vitest";
import { exportLeads } from "@/server/leads/export";
import { assignLeads, addAdditionalContact, bulkUpdateLeads, deleteAllFiltered, deleteLead, deleteLeads, removeAssignments, transferAssignments, updateLead, createManualLead } from "@/server/leads/mutations";
import { checkDuplicate, getFilterMeta, getLeadDetail, listLeads } from "@/server/leads/queries";
import { actorOf, makeLead, makeUser, prisma, resetDb } from "./helpers/db";

async function setup() {
  const admin = actorOf(await makeUser({ role: "ADMIN" }));
  const updater = actorOf(await makeUser());
  const viewer = actorOf(await makeUser());
  const outsider = actorOf(await makeUser());
  const lead = await makeLead({ name: "Shared", phone: "9000000100", category: "A" });
  await prisma.leadAssignment.createMany({ data: [
    { leadId: lead.id, userId: updater.id, canView: true, canUpdate: true },
    { leadId: lead.id, userId: viewer.id, canView: true, canUpdate: false },
  ] });
  const other = await makeLead({ name: "Other", phone: "9000000101" });
  return { admin, updater, viewer, outsider, lead, other };
}
const status = (e: unknown) => (e as { status?: number }).status;
const denied = async (p: Promise<unknown>, codes: number[] = [403, 404]) => {
  const err = await p.then(() => null, (e) => e);
  expect(err, "expected a rejection").not.toBeNull();
  expect(codes).toContain(status(err));
};

describe("leads authorization matrix", () => {
  beforeEach(resetDb);

  it("listing scope: admin sees all, assignees see only theirs, outsider sees nothing", async () => {
    const s = await setup();
    expect((await listLeads(s.admin)).total).toBe(2);
    expect((await listLeads(s.updater)).rows.map((r) => r.id)).toEqual([s.lead.id]);
    expect((await listLeads(s.viewer)).total).toBe(1);
    expect((await listLeads(s.outsider)).total).toBe(0);
    expect((await listLeads(s.viewer)).rows[0]?.canUpdate).toBe(false);
    expect((await listLeads(s.updater)).rows[0]?.canUpdate).toBe(true);
  });

  it("assigned-to filters cannot widen a non-admin's scope", async () => {
    const s = await setup();
    const r = await listLeads(s.outsider, { filter: { assigned: "unassigned" } });
    expect(r.total).toBe(0); // 'other' is unassigned but not visible to the outsider
    expect((await listLeads(s.outsider, { filter: { assignedTo: [s.updater.id] } })).total).toBe(0);
  });

  it("admin-only presets reject users; per-user presets work for admin and users", async () => {
    const s = await setup();
    for (const preset of ["unassigned", "assigned", "new", "trending", "won"] as const) {
      await denied(listLeads(s.updater, { preset }), [403]);
      await listLeads(s.admin, { preset });
    }
    expect((await listLeads(s.updater, { preset: "mine" })).total).toBe(1);
    expect((await listLeads(s.outsider, { preset: "mine" })).total).toBe(0);
    expect((await listLeads(s.admin, { preset: "mine" })).total).toBe(0); // admin has no assignments
  });

  it("detail: admin and assignees yes, outsider gets 404", async () => {
    const s = await setup();
    expect((await getLeadDetail(s.admin, s.lead.id)).assignees).toHaveLength(2);
    await getLeadDetail(s.viewer, s.lead.id);
    await denied(getLeadDetail(s.outsider, s.lead.id), [404]);
    await denied(getLeadDetail(s.updater, s.other.id), [404]);
  });

  it("edit: admin and updater allowed; viewer (403) and outsider (404) denied; no reassign or identity edits by users", async () => {
    const s = await setup();
    await updateLead(s.admin, s.lead.id, { name: "A1", phone: "9111111111" });
    await updateLead(s.updater, s.lead.id, { name: "U1", remarks: "r" });
    await denied(updateLead(s.viewer, s.lead.id, { name: "V" }), [403]);
    await denied(updateLead(s.outsider, s.lead.id, { name: "O" }), [404]);
    await denied(updateLead(s.updater, s.lead.id, { phone: "9222222222" }), [403]);
    await denied(updateLead(s.updater, s.lead.id, { company: "New Co" }), [403]);
    await denied(updateLead(s.updater, s.lead.id, { contact: "9333333333" }), [403]);
    await denied(updateLead(s.updater, s.lead.id, { assignedTo: [{ userId: s.outsider.id, canUpdate: true }] }), [403]);
    await updateLead(s.updater, s.lead.id, { phone: "9111111111", company: (await prisma.lead.findUniqueOrThrow({ where: { id: s.lead.id } })).company }); // unchanged values are fine
    const after = await prisma.lead.findUniqueOrThrow({ where: { id: s.lead.id } });
    expect(after.name).toBe("U1");
    expect(await prisma.leadAssignment.count({ where: { leadId: s.lead.id } })).toBe(2);
    await denied(addAdditionalContact(s.viewer, s.lead.id, { name: "x", contact: "1" }), [403]);
    await denied(addAdditionalContact(s.outsider, s.lead.id, { name: "x", contact: "1" }), [404]);
  });

  it("delete, bulk delete, delete-all-filtered, bulk update and every assignment op are admin-only", async () => {
    const s = await setup();
    for (const who of [s.updater, s.viewer, s.outsider]) {
      await denied(deleteLead(who, s.lead.id), [403]);
      await denied(deleteLeads(who, [s.lead.id]), [403]);
      await denied(deleteAllFiltered(who, { filter: { q: "Shared" } }), [403]);
      await denied(bulkUpdateLeads(who, { ids: [s.lead.id], category: "Z" }), [403]);
      await denied(assignLeads(who, { leadIds: [s.lead.id], userIds: [who.id], level: "update" }), [403]);
      await denied(removeAssignments(who, [s.lead.id]), [403]);
      await denied(transferAssignments(who, { leadIds: [s.lead.id], targetUserId: who.id }), [403]);
    }
    expect(await prisma.lead.count()).toBe(2);
    expect(await prisma.leadAssignment.count()).toBe(2);
    await deleteLead(s.admin, s.other.id);
    expect(await prisma.lead.count()).toBe(1);
  });

  it("filter metadata scopes: all / assigned-to-user / unassigned", async () => {
    const s = await setup();
    await makeLead({ category: "Hidden", location: "Pune" }); // unassigned, not visible to users
    expect((await getFilterMeta(s.admin)).categories).toEqual(expect.arrayContaining(["A", "Hidden", ""]));
    expect((await getFilterMeta(s.updater)).categories).toEqual(["A"]);
    expect((await getFilterMeta(s.outsider)).categories).toEqual([]);
    expect((await getFilterMeta(s.updater, { scope: "assigned", userId: s.updater.id })).categories).toEqual(["A"]);
    await denied(getFilterMeta(s.updater, { scope: "assigned", userId: s.viewer.id }), [403]);
    await denied(getFilterMeta(s.updater, { scope: "unassigned" }), [403]);
    expect((await getFilterMeta(s.admin, { scope: "unassigned" })).categories).toEqual(expect.arrayContaining(["Hidden", ""]));
    expect((await getFilterMeta(s.admin, { scope: "assigned", userId: s.viewer.id })).categories).toEqual(["A"]);
  });

  it("create: non-admin lead is force-assigned to self with update permission; admin may leave unassigned or assign", async () => {
    const s = await setup();
    const { id } = await createManualLead(s.outsider, { name: "Mine", phone: "9555555555", assignedUserId: s.updater.id });
    const a = await prisma.leadAssignment.findMany({ where: { leadId: id } });
    expect(a).toHaveLength(1);
    expect(a[0]).toMatchObject({ userId: s.outsider.id, canView: true, canUpdate: true, canDelete: false });
    const lead = await prisma.lead.findUniqueOrThrow({ where: { id } });
    expect(lead.source).toBe("MANUAL");
    expect(lead.createdById).toBe(s.outsider.id);
    const free = await createManualLead(s.admin, { name: "Free", phone: "9555555556" });
    expect(await prisma.leadAssignment.count({ where: { leadId: free.id } })).toBe(0);
    const given = await createManualLead(s.admin, { name: "Given", phone: "9555555557", assignedUserId: s.viewer.id });
    expect(await prisma.leadAssignment.count({ where: { leadId: given.id, userId: s.viewer.id, canUpdate: true } })).toBe(1);
  });

  it("duplicate check discloses lead details only when the lead is visible", async () => {
    const s = await setup();
    expect(await checkDuplicate(s.admin, { phone: "9000000100" })).toMatchObject({ exists: true, field: "phone", lead: { id: s.lead.id } });
    expect(await checkDuplicate(s.viewer, { phone: "9000000100" })).toMatchObject({ exists: true, lead: { id: s.lead.id } });
    expect(await checkDuplicate(s.outsider, { phone: "9000000100" })).toEqual({ exists: true, field: "phone", lead: null });
    expect(await checkDuplicate(s.outsider, { contact: "9000000100" })).toMatchObject({ exists: true });
    expect(await checkDuplicate(s.outsider, { phone: "123" })).toEqual({ exists: false });
    await denied(checkDuplicate(s.outsider, {}), [400]);
    await denied(createManualLead(s.outsider, { name: "dup", phone: "9000000100" }), [409]);
    await denied(createManualLead(s.outsider, { name: "none" }), [400]);
  });

  it("export: scope respected for every role; outsider gets only header", async () => {
    const s = await setup();
    const count = async (a: typeof s.admin) => (await exportLeads(a, { format: "csv" })).rows;
    expect(await count(s.admin)).toBe(2);
    expect(await count(s.updater)).toBe(1);
    expect(await count(s.viewer)).toBe(1);
    expect(await count(s.outsider)).toBe(0);
    await denied(exportLeads(s.updater, { format: "csv", preset: "unassigned" }), [403]);
    // an assignee-filter cannot be used to read someone else's leads
    expect((await exportLeads(s.outsider, { format: "csv", filter: { assignedTo: [s.updater.id] } })).rows).toBe(0);
  });
});
