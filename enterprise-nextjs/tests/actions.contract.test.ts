// Server-action contract suite (QA matrix "Endpoint/action acceptance" rows). Each test drives the exported
// Next.js server action exactly as the UI does and verifies, against disposable PostgreSQL:
//   success  - the action reports ok and the database holds the change
//   reject   - invalid input or an unauthorised role is refused AND the database is unchanged (rollback)
//   retry    - repeating the same call is safe (idempotent, or refused without duplicating data)
// Test names start with the action name so results map 1:1 onto TEST_MATRIX rows.
import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { actorOf, makeLead, makeUser, prisma, resetDb } from "./helpers/db";
import { createMemoryStorage } from "./helpers/storage";
import { fixtures, ids, importCsv } from "./helpers/vendor-fixtures";
import { setStorageDriverForTests } from "@/lib/storage";
import { uploadImport } from "@/server/vendors/import-export";

type SessionUser = { id: string; role: "ADMIN" | "USER"; enabled: boolean; name: string; userId: string; email: string | null };
const s = vi.hoisted(() => ({
  user: null as null | SessionUser,
  createUser: vi.fn(),
  deleteUser: vi.fn(async () => ({ error: null })),
  updateUserById: vi.fn(async () => ({ error: null })),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: (to: string) => { throw new Error(`REDIRECT:${to}`); } }));
vi.mock("@/lib/auth/session", () => ({
  getCurrentUser: async () => s.user,
  requireUser: async () => { if (!s.user) throw new Error("REDIRECT:/crm/login"); return s.user; },
  requireAdmin: async () => { if (!s.user) throw new Error("REDIRECT:/crm/login"); if (s.user.role !== "ADMIN") throw new Error("REDIRECT:/crm/entrydashboard"); return s.user; },
}));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: () => ({ auth: { admin: { createUser: s.createUser, deleteUser: s.deleteUser, updateUserById: s.updateUserById } } }) }));

import * as leads from "@/app/(crm)/crm/lead-management/actions";
import * as acts from "@/app/(crm)/crm/activities/actions";
import * as quotes from "@/app/(crm)/crm/quotations/actions";
import * as users from "@/app/(crm)/crm/user-management/actions";
import * as views from "@/app/(crm)/crm/views-actions";
import * as vend from "@/app/(crm)/crm/vendors/actions";

type U = Awaited<ReturnType<typeof makeUser>>;
const as = (u: U | null) => { s.user = u && { id: u.id, role: u.role, enabled: u.enabled, name: u.name, userId: u.userId, email: u.email }; };
const fd = (o: Record<string, string>) => { const f = new FormData(); for (const [k, v] of Object.entries(o)) f.set(k, v); return f; };
const snapshot = async () => ({
  leads: await prisma.lead.count(), assignments: await prisma.leadAssignment.count(), activities: await prisma.activity.count(),
  quotations: await prisma.quotation.count(), users: await prisma.user.count(), views: await prisma.savedView.count(),
  vendors: await prisma.vendor.count(), contacts: await prisma.vendorContact.count(), addresses: await prisma.vendorAddress.count(),
});
const blankAddr = { street: "", city: "", state: "", postalCode: "", country: "" };
const leadValues = (o: Partial<leads.LeadFormValues> = {}): leads.LeadFormValues => ({
  name: "Action Lead", company: "Act Co", email: "", countryCode: "+91", phone: "9" + String(Date.now()).slice(-9), contact: "", location: "Delhi", state: "Delhi",
  category: "Pens", dataType: "B2B", quantity: "", requirements: "", remarks: "", address: "", status: "", callStatus: "", billing: blankAddr, shipping: blankAddr, ...o,
});
const quotePayload = (o: Record<string, unknown> = {}) => ({
  party: { name: "Buyer One", company: "Buyer Co" }, items: [{ name: "Item", qty: 2, price: 100, discount: 0, tax: 18 }],
  invoiceDetails: { prefix: "MF/Q/", date: "2026-11-20" }, summary: { discount: 0, discountType: "%", additionalCharges: 0, autoRoundOff: false, amountReceived: 0 }, ...o,
});

let admin: U, admin2: U, emp: U, emp2: U;
beforeEach(async () => {
  await resetDb();
  setStorageDriverForTests(createMemoryStorage());
  admin = await makeUser({ role: "ADMIN" });
  admin2 = await makeUser({ role: "ADMIN" });
  emp = await makeUser({ role: "USER" });
  emp2 = await makeUser({ role: "USER" });
  s.createUser.mockReset(); s.deleteUser.mockClear(); s.updateUserById.mockClear();
  as(admin);
});

// ===================================================================== leads
describe("lead-management actions", () => {
  it("createLeadAction: success persists lead+assignment; missing phone refused with no row; retry with same phone is a duplicate refusal", async () => {
    const v = leadValues({ assignedUserId: emp.id });
    const r = await leads.createLeadAction(v);
    expect(r.ok).toBe(true);
    const row = await prisma.lead.findFirstOrThrow({ where: { phone: v.phone }, include: { assignments: true } });
    expect(row.assignments.map((a) => a.userId)).toEqual([emp.id]);
    const before = await snapshot();
    expect((await leads.createLeadAction(leadValues({ phone: "", contact: "" }))).ok).toBe(false);
    const retry = await leads.createLeadAction(v);
    expect(retry.ok).toBe(false);
    expect(await snapshot()).toEqual(before);
  });
  it("updateLeadAction: admin edit persists; employee without update access refused and unchanged; repeat is a no-op", async () => {
    const lead = await makeLead({ name: "Before" }, [{ userId: emp.id, canUpdate: false }]);
    expect((await leads.updateLeadAction(lead.id, leadValues({ name: "After", phone: lead.phone ?? "9111111111" }))).ok).toBe(true);
    expect((await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } })).name).toBe("After");
    as(emp);
    expect((await leads.updateLeadAction(lead.id, leadValues({ name: "Hacked", phone: lead.phone ?? "9111111111" }))).ok).toBe(false);
    expect((await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } })).name).toBe("After");
    as(admin);
    expect((await leads.updateLeadAction(lead.id, leadValues({ name: "After", phone: lead.phone ?? "9111111111" }))).ok).toBe(true);
    expect((await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } })).name).toBe("After");
  });
  it("checkDuplicateAction: finds an existing phone in another format, not an absent one; read-only", async () => {
    await makeLead({ phone: "9811122233" });
    const before = await snapshot();
    const hit = await leads.checkDuplicateAction({ phone: "98111-22233" });
    expect(hit.ok && hit.result.exists).toBe(true);
    const miss = await leads.checkDuplicateAction({ phone: "9000000999" });
    expect(miss.ok && miss.result.exists).toBe(false);
    expect(await snapshot()).toEqual(before);
  });
  it("getLeadDetailAction: owner sees detail; foreign employee refused; unknown id refused", async () => {
    const lead = await makeLead({ name: "Detail" }, [{ userId: emp.id }]);
    as(emp);
    const ok = await leads.getLeadDetailAction(lead.id);
    expect(ok.ok && ok.lead.name).toBe("Detail");
    as(emp2);
    expect((await leads.getLeadDetailAction(lead.id)).ok).toBe(false);
    expect((await leads.getLeadDetailAction(randomUUID())).ok).toBe(false);
  });
  it("addContactAction / deleteContactAction: add persists, blank refused, delete by index removes, bad index refused", async () => {
    const lead = await makeLead({});
    expect((await leads.addContactAction(lead.id, { name: "Asha", contact: "9000000001", details: "Buyer" })).ok).toBe(true);
    const contacts = () => prisma.lead.findUniqueOrThrow({ where: { id: lead.id } }).then((l) => (l.additionalContacts as unknown[]) ?? []);
    expect(await contacts()).toHaveLength(1);
    expect((await leads.addContactAction(lead.id, { name: "", contact: "", details: "" })).ok).toBe(false);
    expect(await contacts()).toHaveLength(1);
    expect((await leads.deleteContactAction(lead.id, 5)).ok).toBe(false);
    expect((await leads.deleteContactAction(lead.id, 0)).ok).toBe(true);
    expect(await contacts()).toHaveLength(0);
    expect((await leads.deleteContactAction(lead.id, 0)).ok).toBe(false);
  });
  it("deleteLeadsAction: admin deletes; employee refused with rows intact; retry reports zero", async () => {
    const a = await makeLead({}, [{ userId: emp.id, canDelete: false }]);
    as(emp);
    expect((await leads.deleteLeadsAction([a.id])).ok).toBe(false);
    expect(await prisma.lead.count({ where: { id: a.id } })).toBe(1);
    as(admin);
    const r = await leads.deleteLeadsAction([a.id]);
    expect(r.ok && r.deleted).toBe(1);
    const again = await leads.deleteLeadsAction([a.id]);
    expect(again.ok ? again.deleted : 0).toBe(0);
  });
  it("deleteAllFilteredAction: deletes only matching leads; bad preset refused; employee refused", async () => {
    await makeLead({ name: "Zap One", category: "ZAP" });
    await makeLead({ name: "Keep One", category: "KEEP" });
    as(emp);
    expect((await leads.deleteAllFilteredAction("category=ZAP", "all")).ok).toBe(false);
    as(admin);
    // DEL-PRESET: an unknown preset used to fall back to "all" and widen the delete.
    expect((await leads.deleteAllFilteredAction("category=ZAP", "nonsense")).ok).toBe(false);
    expect((await leads.deleteAllFilteredAction("", "all")).ok).toBe(false); // no filter at all is refused
    expect(await prisma.lead.count()).toBe(2);
    const r = await leads.deleteAllFilteredAction("category=ZAP", "all");
    expect(r.ok && r.deleted).toBe(1);
    expect(await prisma.lead.count({ where: { category: "KEEP" } })).toBe(1);
  });
  it("bulkUpdateAction: sets category/location; empty id list refused; retry stable", async () => {
    const a = await makeLead({});
    expect((await leads.bulkUpdateAction([a.id], "Mugs", "Pune")).ok).toBe(true);
    expect(await prisma.lead.findUniqueOrThrow({ where: { id: a.id } })).toMatchObject({ category: "Mugs", location: "Pune" });
    expect((await leads.bulkUpdateAction([], "X", "Y")).ok).toBe(false);
    expect((await leads.bulkUpdateAction([a.id], "Mugs", "Pune")).ok).toBe(true);
    expect(await prisma.lead.findUniqueOrThrow({ where: { id: a.id } })).toMatchObject({ category: "Mugs", location: "Pune" });
  });
  it("assignLeadsAction: assigns; employee refused; repeating does not duplicate assignments", async () => {
    const a = await makeLead({});
    as(emp);
    expect((await leads.assignLeadsAction([a.id], [emp.id], "update")).ok).toBe(false);
    as(admin);
    expect((await leads.assignLeadsAction([a.id], [emp.id], "update")).ok).toBe(true);
    expect((await leads.assignLeadsAction([a.id], [emp.id], "update")).ok).toBe(true);
    expect(await prisma.leadAssignment.count({ where: { leadId: a.id } })).toBe(1);
    expect((await prisma.leadAssignment.findFirstOrThrow({ where: { leadId: a.id } })).canUpdate).toBe(true);
  });
  it("removeAssignmentsAction: clears owners; employee refused; retry harmless", async () => {
    const a = await makeLead({}, [{ userId: emp.id }]);
    as(emp);
    expect((await leads.removeAssignmentsAction([a.id])).ok).toBe(false);
    expect(await prisma.leadAssignment.count({ where: { leadId: a.id } })).toBe(1);
    as(admin);
    expect((await leads.removeAssignmentsAction([a.id])).ok).toBe(true);
    expect((await leads.removeAssignmentsAction([a.id])).ok).toBe(true);
    expect(await prisma.leadAssignment.count({ where: { leadId: a.id } })).toBe(0);
  });
  it("transferAssignmentsAction: replaces owner; disabled/unknown target refused with owner unchanged; retry stable", async () => {
    const a = await makeLead({}, [{ userId: emp.id }]);
    const off = await makeUser({ role: "USER", enabled: false });
    expect((await leads.transferAssignmentsAction([a.id], off.id)).ok).toBe(false);
    expect((await leads.transferAssignmentsAction([a.id], randomUUID())).ok).toBe(false);
    expect((await prisma.leadAssignment.findFirstOrThrow({ where: { leadId: a.id } })).userId).toBe(emp.id);
    expect((await leads.transferAssignmentsAction([a.id], emp2.id)).ok).toBe(true);
    expect((await leads.transferAssignmentsAction([a.id], emp2.id)).ok).toBe(true);
    expect((await prisma.leadAssignment.findMany({ where: { leadId: a.id } })).map((x) => x.userId)).toEqual([emp2.id]);
  });
  it("bulkSetFieldsAction: sets status/tags; invalid status refused unchanged; repeating does not duplicate tags", async () => {
    const a = await makeLead({ status: "New Lead" });
    expect((await leads.bulkSetFieldsAction([a.id], { status: "Not A Status" })).ok).toBe(false);
    expect((await prisma.lead.findUniqueOrThrow({ where: { id: a.id } })).status).toBe("New Lead");
    expect((await leads.bulkSetFieldsAction([a.id], { status: "In Progress", addTags: ["vip"] })).ok).toBe(true);
    expect((await leads.bulkSetFieldsAction([a.id], { addTags: ["vip"] })).ok).toBe(true);
    const row = await prisma.lead.findUniqueOrThrow({ where: { id: a.id } });
    expect(row.status).toBe("In Progress");
    expect(row.tags).toEqual(["vip"]);
  });
});

// ================================================================ activities
describe("activity actions", () => {
  const base = { type: "CALL", subject: "Call buyer", body: "", priority: "MEDIUM", dueAt: "2026-12-01T10:30" };
  it("createActivityAction: persists with IST due time; blank subject and bad date refused with no row; retry creates a second, distinct activity", async () => {
    const lead = await makeLead({}, [{ userId: emp.id }]);
    as(emp);
    const r = await acts.createActivityAction({ ...base, leadId: lead.id });
    expect(r.ok).toBe(true);
    const row = await prisma.activity.findFirstOrThrow();
    expect(row.dueAt?.toISOString()).toBe("2026-12-01T05:00:00.000Z");
    expect((await acts.createActivityAction({ ...base, subject: " " })).ok).toBe(false);
    expect((await acts.createActivityAction({ ...base, dueAt: "tomorrow" })).ok).toBe(false);
    expect(await prisma.activity.count()).toBe(1);
  });
  async function seeded() {
    as(emp);
    const r = await acts.createActivityAction({ ...base });
    if (!r.ok) throw new Error(r.error);
    return (await prisma.activity.findFirstOrThrow()).id;
  }
  it("updateActivityAction: owner edit persists; other employee refused unchanged", async () => {
    const id = await seeded();
    expect((await acts.updateActivityAction(id, { subject: "Renamed" })).ok).toBe(true);
    as(emp2);
    expect((await acts.updateActivityAction(id, { subject: "Hijack" })).ok).toBe(false);
    expect((await prisma.activity.findUniqueOrThrow({ where: { id } })).subject).toBe("Renamed");
  });
  it("completeActivityAction / reopenActivityAction: complete sets status and outcome; second complete refused or stable; reopen restores OPEN", async () => {
    const id = await seeded();
    expect((await acts.completeActivityAction(id, "Spoke to buyer")).ok).toBe(true);
    const done = await prisma.activity.findUniqueOrThrow({ where: { id } });
    expect(done.status).toBe("COMPLETED");
    await acts.completeActivityAction(id, "again");
    expect((await prisma.activity.findUniqueOrThrow({ where: { id } })).status).toBe("COMPLETED");
    expect((await acts.reopenActivityAction(id)).ok).toBe(true);
    expect((await prisma.activity.findUniqueOrThrow({ where: { id } })).status).toBe("OPEN");
    as(emp2);
    expect((await acts.completeActivityAction(id)).ok).toBe(false);
    expect((await prisma.activity.findUniqueOrThrow({ where: { id } })).status).toBe("OPEN");
  });
  it("cancelActivityAction: cancels; foreign employee refused; retry stable", async () => {
    const id = await seeded();
    as(emp2);
    expect((await acts.cancelActivityAction(id)).ok).toBe(false);
    as(emp);
    expect((await acts.cancelActivityAction(id)).ok).toBe(true);
    await acts.cancelActivityAction(id);
    expect((await prisma.activity.findUniqueOrThrow({ where: { id } })).status).toBe("CANCELLED");
  });
  it("deleteActivityAction: removes; foreign employee refused; retry refused without error leak", async () => {
    const id = await seeded();
    as(emp2);
    expect((await acts.deleteActivityAction(id)).ok).toBe(false);
    expect(await prisma.activity.count({ where: { id } })).toBe(1);
    as(admin);
    expect((await acts.deleteActivityAction(id)).ok).toBe(true);
    expect(await prisma.activity.count({ where: { id } })).toBe(0);
    const again = await acts.deleteActivityAction(id);
    expect(again.ok).toBe(false);
    expect(again.ok ? "" : again.error).not.toMatch(/prisma|stack|Something went wrong/i);
  });
  it("commentActivityAction: adds comment; blank refused; each retry is a separate comment", async () => {
    const id = await seeded();
    expect((await acts.commentActivityAction(id, "First")).ok).toBe(true);
    expect((await acts.commentActivityAction(id, "   ")).ok).toBe(false);
    expect(await prisma.activityComment.count({ where: { activityId: id } })).toBe(1);
  });
});

// ================================================================ quotations
describe("quotation actions", () => {
  it("saveQuotationAction: create computes totals; invalid payload refused with no row; update keeps number; foreign employee refused", async () => {
    as(emp);
    const r = await quotes.saveQuotationAction(null, quotePayload());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const q = await prisma.quotation.findUniqueOrThrow({ where: { id: r.id } });
    expect(q.grandTotal.toString()).toBe("236");
    expect((await quotes.saveQuotationAction(null, quotePayload({ items: [] }))).ok).toBe(false);
    expect(await prisma.quotation.count()).toBe(1);
    const u = await quotes.saveQuotationAction(r.id, quotePayload({ items: [{ name: "Item", qty: 1, price: 100, discount: 0, tax: 0 }] }));
    expect(u.ok && u.number).toBe(r.number);
    expect((await prisma.quotation.findUniqueOrThrow({ where: { id: r.id } })).grandTotal.toString()).toBe("100");
    as(emp2);
    expect((await quotes.saveQuotationAction(r.id, quotePayload())).ok).toBe(false);
    expect((await prisma.quotation.findUniqueOrThrow({ where: { id: r.id } })).grandTotal.toString()).toBe("100");
  });
  it("deleteQuotationAction: admin deletes with items (audited); owner and other employees refused; retry refused", async () => {
    as(emp);
    const r = await quotes.saveQuotationAction(null, quotePayload());
    if (!r.ok) throw new Error(r.error);
    expect((await quotes.deleteQuotationAction(r.id)).ok).toBe(false);
    as(emp2);
    expect((await quotes.deleteQuotationAction(r.id)).ok).toBe(false);
    expect(await prisma.quotation.count()).toBe(1);
    as(admin);
    expect((await quotes.deleteQuotationAction(r.id)).ok).toBe(true);
    expect(await prisma.activityLog.count({ where: { action: "quotation.deleted" } })).toBe(1);
    expect(await prisma.quotation.count()).toBe(0);
    expect(await prisma.quotationItem.count()).toBe(0);
    expect((await quotes.deleteQuotationAction(r.id)).ok).toBe(false);
  });
});

// ============================================================ user management
describe("user-management actions", () => {
  const newUser = (o: Record<string, string> = {}) => fd({ name: "New Person", username: "new.person", email: "new.person@example.test", password: "Long-enough-pass-1", role: "USER", ...o });
  it("createUserAction: success links auth id and audits; short password refused before Supabase; duplicate username refused; DB failure deletes the Supabase identity (rollback)", async () => {
    s.createUser.mockResolvedValueOnce({ data: { user: { id: randomUUID() } }, error: null });
    expect(await users.createUserAction(newUser())).toEqual({});
    const u = await prisma.user.findFirstOrThrow({ where: { username: "new.person" } });
    expect(u.enabled && u.role === "USER" && u.authUserId).toBeTruthy();
    expect(await prisma.activityLog.count({ where: { action: "user.created" } })).toBe(1);
    expect((await users.createUserAction(newUser({ username: "short.pw", email: "s@example.test", password: "short" }))).error).toBeTruthy();
    expect((await users.createUserAction(newUser())).error).toMatch(/already exists/);
    expect(s.createUser).toHaveBeenCalledTimes(1);
    // Rollback: Supabase succeeds but the CRM insert fails (auth id already linked) -> identity removed, no row.
    s.createUser.mockResolvedValueOnce({ data: { user: { id: u.authUserId } }, error: null });
    const before = await prisma.user.count();
    expect((await users.createUserAction(newUser({ username: "rollback.case", email: "rb@example.test" }))).error).toMatch(/could not be saved/);
    expect(s.deleteUser).toHaveBeenCalledWith(u.authUserId);
    expect(await prisma.user.count()).toBe(before);
  });
  it("createUserAction: employees are bounced (admin only)", async () => {
    as(emp);
    await expect(users.createUserAction(newUser())).rejects.toThrow(/REDIRECT/);
    expect(s.createUser).not.toHaveBeenCalled();
  });
  it("toggleUserAction: disable then enable, audited; self-disable, unknown id and last-enabled-admin disable refused", async () => {
    expect(await users.toggleUserAction(fd({ id: emp.id }))).toEqual({});
    expect((await prisma.user.findUniqueOrThrow({ where: { id: emp.id } })).enabled).toBe(false);
    expect(await users.toggleUserAction(fd({ id: emp.id }))).toEqual({});
    expect((await prisma.user.findUniqueOrThrow({ where: { id: emp.id } })).enabled).toBe(true);
    expect((await users.toggleUserAction(fd({ id: admin.id }))).error).toMatch(/own account/);
    expect((await users.toggleUserAction(fd({ id: "not-a-uuid" }))).error).toBeTruthy();
    expect((await users.toggleUserAction(fd({ id: randomUUID() }))).error).toMatch(/Unknown/);
    // Stale session: `admin` was disabled elsewhere, so admin2 is the only enabled administrator left.
    await prisma.user.update({ where: { id: admin.id }, data: { enabled: false } });
    expect((await users.toggleUserAction(fd({ id: admin2.id }))).error).toMatch(/At least one administrator/);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: admin2.id } })).enabled).toBe(true);
    expect(await prisma.activityLog.count({ where: { action: { in: ["user.disabled", "user.enabled"] } } })).toBe(2);
  });
  it("changePasswordAction: calls Supabase and audits; short password and disabled target refused without Supabase call", async () => {
    expect(await users.changePasswordAction(fd({ id: emp.id, password: "Another-long-pass-2" }))).toEqual({});
    expect(s.updateUserById).toHaveBeenCalledTimes(1);
    expect((await users.changePasswordAction(fd({ id: emp.id, password: "short" }))).error).toBeTruthy();
    await prisma.user.update({ where: { id: emp2.id }, data: { enabled: false } });
    expect((await users.changePasswordAction(fd({ id: emp2.id, password: "Another-long-pass-2" }))).error).toMatch(/Enable/);
    expect(s.updateUserById).toHaveBeenCalledTimes(1);
    expect(await prisma.activityLog.count({ where: { action: "user.password_changed" } })).toBe(1);
  });
  it("updateUserAction: name/location persist; duplicate email refused; Supabase email failure leaves CRM unchanged; retry is a no-op", async () => {
    expect(await users.updateUserAction(fd({ id: emp.id, name: "Renamed Person", location: "Pune", email: "" }))).toEqual({});
    expect(await prisma.user.findUniqueOrThrow({ where: { id: emp.id } })).toMatchObject({ name: "Renamed Person", location: "Pune" });
    expect((await users.updateUserAction(fd({ id: emp.id, name: "Renamed Person", email: emp2.email! }))).error).toMatch(/already in use/);
    s.updateUserById.mockResolvedValueOnce({ error: { message: "auth down" } } as never);
    expect((await users.updateUserAction(fd({ id: emp.id, name: "Renamed Person", email: "fresh@example.test" }))).error).toMatch(/could not be changed/);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: emp.id } })).email).toBe(emp.email);
    expect(await users.updateUserAction(fd({ id: emp.id, name: "Renamed Person", location: "Pune", email: "" }))).toEqual({});
  });
});

// ================================================================ saved views
describe("saved view actions", () => {
  it("saveViewAction: saves; same name upserts (retry); employee cannot share; bad entity refused", async () => {
    as(emp);
    const r = await views.saveViewAction("leads", "Hot", "status=Won+Lead&q=a", false);
    expect(r.ok).toBe(true);
    expect((await views.saveViewAction("leads", "Hot", "status=Lost+Lead", false)).ok).toBe(true);
    expect(await prisma.savedView.count({ where: { userId: emp.id } })).toBe(1);
    expect((await views.saveViewAction("leads", "Shared", "q=x", true)).ok).toBe(false);
    expect((await views.saveViewAction("nonsense", "X", "q=x", false)).ok).toBe(false);
    expect(await prisma.savedView.count()).toBe(1);
  });
  it("deleteViewAction: owner deletes; another employee cannot; retry refused", async () => {
    as(emp);
    const r = await views.saveViewAction("leads", "Mine", "q=a", false);
    if (!r.ok) throw new Error(r.error);
    as(emp2);
    expect((await views.deleteViewAction(r.view.id)).ok).toBe(false);
    as(emp);
    expect((await views.deleteViewAction(r.view.id)).ok).toBe(true);
    expect(await prisma.savedView.count()).toBe(0);
    expect((await views.deleteViewAction(r.view.id)).ok).toBe(false);
  });
});

// ==================================================================== vendors
describe("vendor actions", () => {
  const adminActor = () => actorOf(admin);
  it("createVendorAction: creates with contact+address; invalid GSTIN refused with nothing written; exact duplicate refused on retry", async () => {
    const pair = ids(8100);
    const form = { name: "Acme Supplies", gstin: pair.gstin, pan: pair.pan, contactName: "Ravi", contactEmail: "ravi@example.test", line1: "1 Road", city: "Pune", postalCode: "411001" };
    const r = await vend.createVendorAction(fd(form));
    expect(r.ok).toBe(true);
    const v = await prisma.vendor.findFirstOrThrow({ where: { name: "Acme Supplies" }, include: { contacts: true, addresses: true } });
    expect(v.contacts).toHaveLength(1);
    expect(v.addresses).toHaveLength(1);
    const before = await snapshot();
    expect((await vend.createVendorAction(fd({ name: "Bad Tax", gstin: "123" }))).ok).toBe(false);
    expect((await vend.createVendorAction(fd(form))).ok).toBe(false);
    expect(await snapshot()).toEqual(before);
  });
  it("updateVendorAction: persists; stale updatedAt refused (optimistic lock); employee can edit but not bank", async () => {
    const f = await fixtures(adminActor());
    const current = await prisma.vendor.findUniqueOrThrow({ where: { id: f.vendor.id } });
    expect((await vend.updateVendorAction(f.vendor.id, fd({ name: "Renamed Vendor", updatedAt: current.updatedAt.toISOString() }))).ok).toBe(true);
    expect((await prisma.vendor.findUniqueOrThrow({ where: { id: f.vendor.id } })).name).toBe("Renamed Vendor");
    expect((await vend.updateVendorAction(f.vendor.id, fd({ name: "Stale Write", updatedAt: current.updatedAt.toISOString() }))).ok).toBe(false);
    expect((await prisma.vendor.findUniqueOrThrow({ where: { id: f.vendor.id } })).name).toBe("Renamed Vendor");
    as(emp);
    expect((await vend.updateVendorAction(f.vendor.id, fd({ bank_accountNumber: "123456789012" }))).ok).toBe(false);
  });
  it("checkDuplicatesAction: blocking on same GSTIN, none for a fresh name; read-only", async () => {
    const pair = ids(8200);
    await vend.createVendorAction(fd({ name: "Dup Base", gstin: pair.gstin, pan: pair.pan }));
    const before = await snapshot();
    const r = await vend.checkDuplicatesAction({ name: "Other", gstin: pair.gstin });
    expect(r.ok && r.blocking.length).toBeGreaterThan(0);
    const none = await vend.checkDuplicatesAction({ name: "Completely Fresh Name" });
    expect(none.ok && none.blocking.length).toBe(0);
    expect(await snapshot()).toEqual(before);
  });
  it("setStatusAction / changeStatusAction / bulkStatusAction: status persists; invalid status refused; repeat reports unchanged", async () => {
    const f = await fixtures(adminActor());
    expect((await vend.setStatusAction(f.vendor.id, "ACTIVE")).ok).toBe(true);
    const again = await vend.setStatusAction(f.vendor.id, "ACTIVE");
    expect(again.ok && again.message).toMatch(/unchanged/);
    expect((await vend.setStatusAction(f.vendor.id, "BOGUS")).ok).toBe(false);
    expect((await vend.changeStatusAction(f.vendor.id, fd({ status: "INACTIVE", reason: "Paused" }))).ok).toBe(true);
    expect((await prisma.vendor.findUniqueOrThrow({ where: { id: f.vendor.id } })).status).toBe("INACTIVE");
    expect((await vend.bulkStatusAction([f.vendor.id], "ACTIVE")).ok).toBe(true);
    expect((await prisma.vendor.findUniqueOrThrow({ where: { id: f.vendor.id } })).status).toBe("ACTIVE");
    expect((await vend.bulkStatusAction([], "ACTIVE")).ok).toBe(false);
  });
  it("archiveAction / restoreAction / bulkArchiveAction: admin archives and restores; employee refused", async () => {
    const f = await fixtures(adminActor());
    as(emp);
    expect((await vend.archiveAction(f.vendor.id)).ok).toBe(false);
    as(admin);
    expect((await vend.archiveAction(f.vendor.id)).ok).toBe(true);
    expect((await prisma.vendor.findUniqueOrThrow({ where: { id: f.vendor.id } })).archivedAt).not.toBeNull();
    expect((await vend.restoreAction(f.vendor.id)).ok).toBe(true);
    expect((await prisma.vendor.findUniqueOrThrow({ where: { id: f.vendor.id } })).archivedAt).toBeNull();
    expect((await vend.bulkArchiveAction([f.vendor.id], false)).ok).toBe(true);
    expect((await vend.bulkArchiveAction([f.vendor.id], true)).ok).toBe(true);
    expect((await prisma.vendor.findUniqueOrThrow({ where: { id: f.vendor.id } })).archivedAt).toBeNull();
  });
  it("deleteVendorAction: only archived vendor with matching confirm code; wrong code refused intact; retry refused", async () => {
    const f = await fixtures(adminActor());
    const code = (await prisma.vendor.findUniqueOrThrow({ where: { id: f.archived.id } })).vendorCode;
    expect((await vend.deleteVendorAction(f.vendor.id, fd({ confirmCode: f.vendor.vendorCode }))).ok).toBe(false);
    expect((await vend.deleteVendorAction(f.archived.id, fd({ confirmCode: "WRONG" }))).ok).toBe(false);
    expect(await prisma.vendor.count({ where: { id: f.archived.id } })).toBe(1);
    expect((await vend.deleteVendorAction(f.archived.id, fd({ confirmCode: code }))).ok).toBe(true);
    expect(await prisma.vendor.count({ where: { id: f.archived.id } })).toBe(0);
    expect((await vend.deleteVendorAction(f.archived.id, fd({ confirmCode: code }))).ok).toBe(false);
  });
  it("addContactAction / updateContactAction / primaryContactAction / deleteContactAction: full lifecycle with validation", async () => {
    const f = await fixtures(adminActor());
    expect((await vend.addContactAction(f.vendor.id, fd({ name: "", email: "bad" }))).ok).toBe(false);
    expect((await vend.addContactAction(f.vendor.id, fd({ name: "Second", email: "two@example.test" }))).ok).toBe(true);
    const second = await prisma.vendorContact.findFirstOrThrow({ where: { vendorId: f.vendor.id, name: "Second" } });
    expect((await vend.updateContactAction(f.vendor.id, second.id, fd({ name: "Second Renamed", email: "two@example.test" }))).ok).toBe(true);
    expect((await vend.primaryContactAction(f.vendor.id, second.id)).ok).toBe(true);
    expect((await vend.primaryContactAction(f.vendor.id, second.id)).ok).toBe(true);
    expect(await prisma.vendorContact.count({ where: { vendorId: f.vendor.id, isPrimary: true } })).toBe(1);
    expect((await vend.deleteContactAction(f.vendor.id, f.contact.id)).ok).toBe(true);
    expect((await vend.deleteContactAction(f.vendor.id, f.contact.id)).ok).toBe(false);
    expect((await prisma.vendorContact.findUniqueOrThrow({ where: { id: second.id } })).name).toBe("Second Renamed");
  });
  it("addAddressAction / updateAddressAction / primaryAddressAction / deleteAddressAction: full lifecycle with validation", async () => {
    const f = await fixtures(adminActor());
    expect((await vend.addAddressAction(f.vendor.id, fd({ line1: "", postalCode: "abc" }))).ok).toBe(false);
    expect((await vend.addAddressAction(f.vendor.id, fd({ line1: "2 Street", city: "Pune", postalCode: "411002" }))).ok).toBe(true);
    const a2 = await prisma.vendorAddress.findFirstOrThrow({ where: { vendorId: f.vendor.id, line1: "2 Street" } });
    expect((await vend.updateAddressAction(f.vendor.id, a2.id, fd({ line1: "2B Street", city: "Pune", postalCode: "411002" }))).ok).toBe(true);
    expect((await vend.primaryAddressAction(f.vendor.id, a2.id)).ok).toBe(true);
    expect(await prisma.vendorAddress.count({ where: { vendorId: f.vendor.id, isPrimary: true } })).toBe(1);
    expect((await vend.deleteAddressAction(f.vendor.id, f.address.id)).ok).toBe(true);
    expect((await vend.deleteAddressAction(f.vendor.id, f.address.id)).ok).toBe(false);
    expect((await prisma.vendorAddress.findUniqueOrThrow({ where: { id: a2.id } })).line1).toBe("2B Street");
  });
  it("addProductAction / updateProductAction / deleteProductAction: pricing lifecycle; negative price refused", async () => {
    const f = await fixtures(adminActor());
    const p2 = await prisma.product.create({ data: { code: "VP-2", name: "Second Widget" } });
    expect((await vend.addProductAction(f.vendor.id, fd({ productId: p2.id, purchasePrice: "-5", effectiveFrom: "2026-01-01" }))).ok).toBe(false);
    expect((await vend.addProductAction(f.vendor.id, fd({ productId: p2.id, purchasePrice: "12.50", effectiveFrom: "2026-01-01", isActive: "on" }))).ok).toBe(true);
    const row = await prisma.vendorProduct.findFirstOrThrow({ where: { vendorId: f.vendor.id, productId: p2.id } });
    expect(row.purchasePrice.toString()).toBe("12.5");
    expect((await vend.updateProductAction(f.vendor.id, row.id, fd({ purchasePrice: "13", effectiveFrom: "2026-01-01", isActive: "on" }))).ok).toBe(true);
    expect((await prisma.vendorProduct.findUniqueOrThrow({ where: { id: row.id } })).purchasePrice.toString()).toBe("13");
    expect((await vend.deleteProductAction(f.vendor.id, row.id)).ok).toBe(true);
    expect((await vend.deleteProductAction(f.vendor.id, row.id)).ok).toBe(false);
  });
  it("addActivityAction / updateActivityAction / deleteActivityAction: lifecycle; blank description refused", async () => {
    const f = await fixtures(adminActor());
    expect((await vend.addActivityAction(f.vendor.id, fd({ type: "Call", description: "" }))).ok).toBe(false);
    expect((await vend.addActivityAction(f.vendor.id, fd({ type: "Call", description: "Negotiated price" }))).ok).toBe(true);
    const a = await prisma.vendorActivity.findFirstOrThrow({ where: { vendorId: f.vendor.id, description: "Negotiated price" } });
    expect((await vend.updateActivityAction(f.vendor.id, a.id, fd({ type: "Call", description: "Negotiated price again" }))).ok).toBe(true);
    expect((await prisma.vendorActivity.findUniqueOrThrow({ where: { id: a.id } })).description).toBe("Negotiated price again");
    expect((await vend.deleteActivityAction(f.vendor.id, a.id)).ok).toBe(true);
    expect((await vend.deleteActivityAction(f.vendor.id, a.id)).ok).toBe(false);
  });
  it("addEvaluationAction / deleteEvaluationAction: admin records and deletes; out-of-range score refused; employee refused", async () => {
    const f = await fixtures(adminActor());
    const scores = { quality: "5", delivery: "4", leadTime: "4", pricing: "3", responsiveness: "4", compliance: "5" };
    expect((await vend.addEvaluationAction(f.vendor.id, fd({ ...scores, quality: "9" }))).ok).toBe(false);
    as(emp);
    expect((await vend.addEvaluationAction(f.vendor.id, fd(scores))).ok).toBe(false);
    as(admin);
    const before = await prisma.vendorEvaluation.count();
    expect((await vend.addEvaluationAction(f.vendor.id, fd(scores))).ok).toBe(true);
    expect(await prisma.vendorEvaluation.count()).toBe(before + 1);
    const e = await prisma.vendorEvaluation.findFirstOrThrow({ where: { vendorId: f.vendor.id }, orderBy: { createdAt: "desc" } });
    expect((await vend.deleteEvaluationAction(f.vendor.id, e.id)).ok).toBe(true);
    expect((await vend.deleteEvaluationAction(f.vendor.id, e.id)).ok).toBe(false);
  });
  it("updateDocumentAction / archiveDocumentAction / deleteDocumentAction: metadata, archive/restore, delete; expiry before issue refused", async () => {
    const f = await fixtures(adminActor());
    expect((await vend.updateDocumentAction(f.vendor.id, f.doc.id, fd({ name: "GST", documentType: "GST Certificate", issueDate: "2026-05-01", expiryDate: "2026-01-01" }))).ok).toBe(false);
    expect((await vend.updateDocumentAction(f.vendor.id, f.doc.id, fd({ name: "GST 2026", documentType: "GST Certificate" }))).ok).toBe(true);
    expect((await prisma.vendorDocument.findUniqueOrThrow({ where: { id: f.doc.id } })).name).toBe("GST 2026");
    expect((await vend.archiveDocumentAction(f.vendor.id, f.doc.id, "ARCHIVED")).ok).toBe(true);
    expect((await prisma.vendorDocument.findUniqueOrThrow({ where: { id: f.doc.id } })).status).toBe("ARCHIVED");
    expect((await vend.archiveDocumentAction(f.vendor.id, f.doc.id, "ACTIVE")).ok).toBe(true);
    expect((await vend.deleteDocumentAction(f.vendor.id, f.doc.id)).ok).toBe(true);
    expect(await prisma.vendorDocument.count({ where: { id: f.doc.id } })).toBe(0);
    expect((await vend.deleteDocumentAction(f.vendor.id, f.doc.id)).ok).toBe(false);
  });
  it("createCategoryAction / updateCategoryAction / deleteCategoryAction: admin lifecycle; duplicate name refused; employee refused; in-use delete requires reassignment", async () => {
    as(emp);
    expect((await vend.createCategoryAction(fd({ name: "Printing Co" }))).ok).toBe(false);
    as(admin);
    expect((await vend.createCategoryAction(fd({ name: "Printing Co" }))).ok).toBe(true);
    expect((await vend.createCategoryAction(fd({ name: "Printing Co" }))).ok).toBe(false);
    const c = await prisma.vendorCategory.findFirstOrThrow({ where: { name: "Printing Co" } });
    const other = await prisma.vendorCategory.create({ data: { name: "Other Co" } });
    expect((await vend.updateCategoryAction(c.id, fd({ name: "Printing House", isActive: "on" }))).ok).toBe(true);
    const v = await prisma.vendor.create({ data: { vendorCode: "CAT-USE-1", name: "Uses Category", categoryId: c.id } });
    expect((await vend.deleteCategoryAction(c.id, fd({}))).ok).toBe(false);
    expect(await prisma.vendorCategory.count({ where: { id: c.id } })).toBe(1);
    expect((await vend.deleteCategoryAction(c.id, fd({ reassignTo: other.id }))).ok).toBe(true);
    expect((await prisma.vendor.findUniqueOrThrow({ where: { id: v.id } })).categoryId).toBe(other.id);
  });
  it("validateImportAction / commitImportAction: validates mapping, commits valid rows only, second commit does not duplicate (retry)", async () => {
    const pair = ids(8300);
    const up = await uploadImport(actorOf(admin), { fileName: "v.csv", buffer: importCsv([["Import Good", "good@example.test", pair.gstin, pair.pan, "", "ACTIVE", "", "", ""], ["", "", "", "", "", "", "", "", ""]]) });
    const mapping = { "Vendor Name": "name", Email: "email", GSTIN: "gstin", PAN: "pan" };
    const v = await vend.validateImportAction(up.jobId, mapping);
    expect(v.ok).toBe(true);
    const before = await prisma.vendor.count();
    const c = await vend.commitImportAction(up.jobId);
    expect(c.ok).toBe(true);
    expect(await prisma.vendor.count()).toBe(before + 1);
    await vend.commitImportAction(up.jobId);
    expect(await prisma.vendor.count()).toBe(before + 1);
    expect((await vend.validateImportAction(randomUUID(), mapping)).ok).toBe(false);
  });
});
