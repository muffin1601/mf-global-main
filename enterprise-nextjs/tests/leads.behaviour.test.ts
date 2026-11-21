import ExcelJS from "exceljs";
import { beforeEach, describe, expect, it } from "vitest";
import { istDayStart } from "@/lib/time/ist";
import { exportLeads } from "@/server/leads/export";
import { parseLeadFilter, filterToParams, rotateFollowUp } from "@/server/leads/filter-schema";
import { assignLeads, bulkUpdateLeads, deleteAllFiltered, deleteLeads, deleteAdditionalContact, addAdditionalContact, removeAssignments, transferAssignments, updateLead } from "@/server/leads/mutations";
import { getLeadDetail, listLeads } from "@/server/leads/queries";
import { actorOf, makeLead, makeUser, prisma, resetDb } from "./helpers/db";

const mkAdmin = async () => actorOf(await makeUser({ role: "ADMIN" }));
const ids = (r: { rows: { id: string }[] }) => r.rows.map((x) => x.id).sort();

describe("lead filters and pagination", () => {
  beforeEach(resetDb);

  it("combines multi-select filters, blanks, assigned/unassigned and assignee", async () => {
    const admin = await mkAdmin();
    const u1 = await makeUser(), u2 = await makeUser();
    const a = await makeLead({ category: "Books", location: "Delhi", state: "DL", status: "In Progress", dataType: "Offline", fileName: "f1.csv" }, [{ userId: u1.id }]);
    const b = await makeLead({ category: "books", location: "Pune", state: "MH", status: "Won Lead", callStatus: "Ring" }, [{ userId: u2.id }]);
    const c = await makeLead({ category: null, location: "", state: "DL" });
    const d = await makeLead({ category: "Toys", location: "Delhi" });
    const f = (filter: object) => listLeads(admin, { filter }).then(ids);
    expect(await f({ category: ["BOOKS"] })).toEqual([a.id, b.id].sort()); // case-insensitive
    expect(await f({ category: [""] })).toEqual([c.id]);
    expect(await f({ category: ["", "Toys"] })).toEqual([c.id, d.id].sort());
    expect(await f({ location: [""] })).toEqual([c.id]);
    expect(await f({ location: ["Delhi"], category: ["Books", "Toys"] })).toEqual([a.id, d.id].sort());
    expect(await f({ state: ["DL"], status: ["In Progress"] })).toEqual([a.id]);
    expect(await f({ callStatus: ["Ring"] })).toEqual([b.id]);
    expect(await f({ dataType: ["Offline"] })).toEqual([a.id]);
    expect(await f({ fileName: ["f1.csv"] })).toEqual([a.id]);
    expect(await f({ fileName: [""] })).toEqual([b.id, c.id, d.id].sort());
    expect(await f({ assigned: "unassigned" })).toEqual([c.id, d.id].sort());
    expect(await f({ assigned: "assigned" })).toEqual([a.id, b.id].sort());
    expect(await f({ assignedTo: [u2.id] })).toEqual([b.id]);
    expect(await f({ assignedTo: [u1.id, u2.id], state: ["MH"] })).toEqual([b.id]);
    expect(await f({ assignedTo: [u1.id], assigned: "unassigned" })).toEqual([]);
    expect(await f({ q: "delhi" })).toEqual([]); // q searches name/company/phone/contact/email, not location
    expect(await f({ q: b.phone ?? "" })).toEqual([b.id]);
  });

  it("round-trips the filter through URL params (including blank values)", () => {
    const filter = { q: "x", category: ["", "A"], assigned: "assigned" as const, assignedTo: ["12345678-1234-4234-8234-123456789abc"], dateType: "followUpDate" as const, from: "2026-01-01", to: "2026-01-31" };
    expect(parseLeadFilter(filterToParams(filter))).toEqual(filter);
    expect(parseLeadFilter({ assigned: "bogus", from: "nope", status: ["a", "a"] })).toEqual({ status: ["a"] });
  });

  it("paginates with correct totals and clamps out-of-range pages", async () => {
    const admin = await mkAdmin();
    await prisma.lead.createMany({ data: Array.from({ length: 60 }, (_, i) => ({ name: `L${i}`, phone: `8${String(i).padStart(9, "0")}` })) });
    const p1 = await listLeads(admin, { pageSize: 25, page: 1 });
    expect(p1).toMatchObject({ total: 60, pages: 3, page: 1, pageSize: 25 });
    expect(p1.rows).toHaveLength(25);
    const p3 = await listLeads(admin, { pageSize: 25, page: 3 });
    expect(p3.rows).toHaveLength(10);
    const all = new Set([...p1.rows, ...(await listLeads(admin, { pageSize: 25, page: 2 })).rows, ...p3.rows].map((r) => r.id));
    expect(all.size).toBe(60); // stable, no overlap
    expect((await listLeads(admin, { pageSize: 25, page: 99 })).page).toBe(3);
    expect((await listLeads(admin, { pageSize: 50 })).rows).toHaveLength(50);
    expect((await listLeads(admin, { pageSize: 7 })).pageSize).toBe(25); // only 25/50/100/200
    expect((await listLeads(admin, { pageSize: 200 })).rows).toHaveLength(60);
  });
});

describe("assignment operations", () => {
  beforeEach(resetDb);

  it("bulk assign MERGES with existing assignees and updates levels", async () => {
    const admin = await mkAdmin();
    const [u1, u2, u3] = [await makeUser(), await makeUser(), await makeUser()];
    const l1 = await makeLead({}, [{ userId: u1.id, canUpdate: true }]);
    const l2 = await makeLead();
    await assignLeads(admin, { leadIds: [l1.id, l2.id], userIds: [u2.id, u3.id], level: "view" });
    const rows = await prisma.leadAssignment.findMany({ where: { leadId: l1.id } });
    expect(rows.map((r) => r.userId).sort()).toEqual([u1.id, u2.id, u3.id].sort());
    expect(rows.find((r) => r.userId === u1.id)?.canUpdate).toBe(true); // untouched
    expect(rows.find((r) => r.userId === u2.id)).toMatchObject({ canView: true, canUpdate: false, canDelete: false, assignedBy: admin.id });
    expect(await prisma.leadAssignment.count({ where: { leadId: l2.id } })).toBe(2);
    await assignLeads(admin, { leadIds: [l1.id], userIds: [u2.id], level: "update" }); // upgrade, no duplicates
    expect(await prisma.leadAssignment.count({ where: { leadId: l1.id } })).toBe(3);
    expect((await prisma.leadAssignment.findFirstOrThrow({ where: { leadId: l1.id, userId: u2.id } })).canUpdate).toBe(true);
    expect(await prisma.activityLog.count({ where: { action: "lead.assigned" } })).toBe(2);
  });

  it("rejects bad input and disabled users", async () => {
    const admin = await mkAdmin();
    const off = await makeUser({ enabled: false });
    const l = await makeLead();
    await expect(assignLeads(admin, { leadIds: [l.id], userIds: [off.id], level: "view" })).rejects.toMatchObject({ status: 404 });
    await expect(assignLeads(admin, { leadIds: [], userIds: [off.id], level: "view" })).rejects.toMatchObject({ status: 400 });
    await expect(assignLeads(admin, { leadIds: [l.id], userIds: [off.id], level: "delete" as never })).rejects.toMatchObject({ status: 400 });
  });

  it("removes assignments in bulk and transfers (replace with target view+update)", async () => {
    const admin = await mkAdmin();
    const [u1, u2, t] = [await makeUser(), await makeUser(), await makeUser()];
    const l1 = await makeLead({}, [{ userId: u1.id }, { userId: u2.id }]);
    const l2 = await makeLead({}, [{ userId: u1.id }]);
    const l3 = await makeLead({}, [{ userId: u1.id }]);
    await transferAssignments(admin, { leadIds: [l1.id, l2.id], targetUserId: t.id });
    for (const l of [l1, l2]) {
      const a = await prisma.leadAssignment.findMany({ where: { leadId: l.id } });
      expect(a).toHaveLength(1);
      expect(a[0]).toMatchObject({ userId: t.id, canView: true, canUpdate: true, canDelete: false });
    }
    expect(await prisma.leadAssignment.count({ where: { leadId: l3.id } })).toBe(1);
    await removeAssignments(admin, [l1.id, l3.id]);
    expect(await prisma.leadAssignment.count({ where: { leadId: { in: [l1.id, l3.id] } } })).toBe(0);
    expect(await prisma.leadAssignment.count({ where: { leadId: l2.id } })).toBe(1);
  });
});

describe("delete and bulk update", () => {
  beforeEach(resetDb);

  it("bulk delete, delete-all-filtered (refuses unfiltered), bulk update", async () => {
    const admin = await mkAdmin();
    const keep = await makeLead({ category: "Keep" });
    const x = await makeLead({ category: "Kill" }), y = await makeLead({ category: "Kill" }), z = await makeLead({ category: "Other" });
    expect((await deleteLeads(admin, [z.id])).deleted).toBe(1);
    await expect(deleteAllFiltered(admin, { filter: {} })).rejects.toMatchObject({ status: 400 });
    expect((await deleteAllFiltered(admin, { filter: { category: ["kill"] } })).deleted).toBe(2);
    expect(await prisma.lead.count()).toBe(1);
    expect(x.id).not.toBe(y.id);
    await expect(bulkUpdateLeads(admin, { ids: [keep.id] })).rejects.toMatchObject({ status: 400 });
    expect((await bulkUpdateLeads(admin, { ids: [keep.id], category: "New Cat", location: "Goa" })).updated).toBe(1);
    expect(await prisma.lead.findUniqueOrThrow({ where: { id: keep.id } })).toMatchObject({ category: "New Cat", location: "Goa" });
    expect(await prisma.activityLog.count({ where: { action: { in: ["lead.deleted", "lead.deleted_filtered", "lead.bulk_updated"] } } })).toBe(3);
  });
});

describe("edit: status history, follow-up rotation, contacts, addresses", () => {
  beforeEach(resetDb);

  it("writes status history for status and call-status changes only when they change", async () => {
    const admin = await mkAdmin();
    const l = await makeLead();
    await updateLead(admin, l.id, { name: "Same" });
    expect(await prisma.leadStatusHistory.count({ where: { leadId: l.id } })).toBe(0);
    await updateLead(admin, l.id, { status: "In Progress", callStatus: "Ring" });
    await updateLead(admin, l.id, { status: "In Progress", callStatus: "Ring" });
    await updateLead(admin, l.id, { callStatus: "Converted", status: "Won Lead" });
    const h = await prisma.leadStatusHistory.findMany({ where: { leadId: l.id }, orderBy: { changedAt: "asc" } });
    expect(h).toHaveLength(2);
    expect(h[0]).toMatchObject({ fromStatus: "New Lead", toStatus: "In Progress", fromCallStatus: "Not Called", toCallStatus: "Ring", changedById: admin.id });
    expect(h[1]).toMatchObject({ toStatus: "Won Lead", toCallStatus: "Converted" });
    const detail = await getLeadDetail(admin, l.id);
    expect(detail.history).toHaveLength(2);
    expect(detail.history[0]?.changedByName).toBe(admin.name);
    expect(await prisma.activityLog.count({ where: { action: "lead.updated" } })).toBe(3);
    await expect(updateLead(admin, l.id, { status: "Bogus" as never })).rejects.toMatchObject({ status: 400 });
  });

  it("rotates follow-up dates: fills 3 slots then replaces the oldest; same date does not burn a slot", async () => {
    const admin = await mkAdmin();
    const l = await makeLead();
    const d = (n: number) => new Date(Date.UTC(2026, 5, n));
    const slots = async () => { const r = await prisma.lead.findUniqueOrThrow({ where: { id: l.id } }); return [r.followUpDateOne, r.followUpDateTwo, r.followUpDateThree, r.followUpDate]; };
    await updateLead(admin, l.id, { followUpDate: d(10) });
    await updateLead(admin, l.id, { followUpDate: d(10) }); // re-save
    expect(await slots()).toEqual([d(10), null, null, d(10)]);
    await updateLead(admin, l.id, { followUpDate: d(5) });
    await updateLead(admin, l.id, { followUpDate: d(20) });
    expect(await slots()).toEqual([d(10), d(5), d(20), d(20)]);
    await updateLead(admin, l.id, { followUpDate: d(25) }); // oldest is d(5) in slot two
    expect(await slots()).toEqual([d(10), d(25), d(20), d(25)]);
    await updateLead(admin, l.id, { followUpDate: d(30) }); // oldest is d(10) in slot one
    expect(await slots()).toEqual([d(30), d(25), d(20), d(30)]);
    expect(rotateFollowUp({ followUpDateOne: d(3), followUpDateTwo: d(1), followUpDateThree: d(2) }, d(9))).toMatchObject({ followUpDateTwo: d(9) });
  });

  it("edits the full field set, validates email, and keeps phone unique", async () => {
    const admin = await mkAdmin();
    const l = await makeLead(), other = await makeLead({ phone: "9444444444" });
    await updateLead(admin, l.id, {
      name: " N ", company: "Co", email: "A@B.COM", phone: "9777777777", contact: "9888888888", location: "L", state: "S", category: "C",
      dataType: "Offline", requirements: "req", remarks: "rem", address: "addr", quantity: 12.5, callingDate: new Date(Date.UTC(2026, 0, 2)),
      billingAddress: { street: "1 Rd", city: "X", state: "S", postalCode: "1", country: "IN" }, shippingAddress: { street: "2 Rd" },
    });
    const d = await getLeadDetail(admin, l.id);
    expect(d).toMatchObject({ name: "N", email: "a@b.com", phone: "9777777777", contact: "9888888888", quantity: 12.5, address: "addr", dataType: "Offline" });
    expect(d.callingDate).toBe("2026-01-02T00:00:00.000Z");
    expect(d.billingAddress).toMatchObject({ street: "1 Rd", country: "IN" });
    expect(d.shippingAddress).toMatchObject({ street: "2 Rd", city: "" });
    await updateLead(admin, l.id, { billingAddress: null });
    expect((await getLeadDetail(admin, l.id)).billingAddress).toBeNull();
    await expect(updateLead(admin, l.id, { email: "nope" })).rejects.toMatchObject({ status: 400 });
    await expect(updateLead(admin, l.id, { phone: "9444444444" })).rejects.toMatchObject({ status: 409 });
    await expect(updateLead(admin, other.id, { contact: "9777777777" })).rejects.toMatchObject({ status: 409 });
    await updateLead(admin, l.id, { remarks: null });
    expect((await getLeadDetail(admin, l.id)).remarks).toBeNull();
  });

  it("adds and deletes additional contacts", async () => {
    const admin = await mkAdmin();
    const l = await makeLead();
    await addAdditionalContact(admin, l.id, { name: "Boss", contact: "111", details: "d" });
    await addAdditionalContact(admin, l.id, { name: "PA", contact: "222" });
    expect((await getLeadDetail(admin, l.id)).additionalContacts.map((c) => c.contact)).toEqual(["111", "222"]);
    await deleteAdditionalContact(admin, l.id, 0);
    expect((await getLeadDetail(admin, l.id)).additionalContacts.map((c) => c.contact)).toEqual(["222"]);
    await expect(deleteAdditionalContact(admin, l.id, 5)).rejects.toMatchObject({ status: 404 });
    await expect(addAdditionalContact(admin, l.id, { name: "x", contact: "" })).rejects.toMatchObject({ status: 400 });
  });
});

describe("presets and IST boundaries", () => {
  beforeEach(resetDb);

  it("today/upcoming use Asia/Kolkata days at 18:29:59Z / 18:30:00Z", async () => {
    const admin = await mkAdmin();
    const u = await makeUser();
    const at = (iso: string) => new Date(iso);
    // IST day of 2026-03-10 = [2026-03-09T18:30Z, 2026-03-10T18:30Z)
    const lastOfYesterday = await makeLead({ followUpDate: at("2026-03-09T18:29:59.999Z") }, [{ userId: u.id }]);
    const firstOfToday = await makeLead({ followUpDate: at("2026-03-09T18:30:00.000Z") }, [{ userId: u.id }]);
    const lastOfToday = await makeLead({ followUpDate: at("2026-03-10T18:29:59.999Z") }, [{ userId: u.id }]);
    const firstOfTomorrow = await makeLead({ followUpDate: at("2026-03-10T18:30:00.000Z") }, [{ userId: u.id }]);
    const later = await makeLead({ followUpDate: at("2026-04-01T00:00:00.000Z") }, [{ userId: u.id }]);
    const notMine = await makeLead({ followUpDate: at("2026-03-10T05:00:00.000Z") });
    const actor = actorOf(u);
    // "now" just before and just after IST midnight on 2026-03-10
    const cases = [
      { now: at("2026-03-09T18:29:59Z"), today: [lastOfYesterday.id], upcoming: [firstOfToday.id, lastOfToday.id, firstOfTomorrow.id, later.id] }, // IST 2026-03-09 23:59:59
      { now: at("2026-03-09T18:30:00Z"), today: [firstOfToday.id, lastOfToday.id], upcoming: [firstOfTomorrow.id, later.id] }, // IST 2026-03-10 00:00:00
      { now: at("2026-03-10T18:30:00Z"), today: [firstOfTomorrow.id], upcoming: [later.id] },
    ];
    for (const c of cases) {
      expect(ids(await listLeads(actor, { preset: "today", now: c.now }))).toEqual([...c.today].sort());
      expect(ids(await listLeads(actor, { preset: "upcoming", now: c.now }))).toEqual([...c.upcoming].sort());
    }
    // admin sees only leads assigned to themselves in these views
    expect((await listLeads(admin, { preset: "today", now: cases[1]!.now })).total).toBe(0);
    expect(notMine.id).toBeTruthy();
    expect(istDayStart("2026-03-10").toISOString()).toBe("2026-03-09T18:30:00.000Z");
    // ordered by follow-up date ascending
    const up = await listLeads(actor, { preset: "upcoming", now: cases[0]!.now });
    expect(up.rows.map((r) => r.followUpDate)).toEqual([...up.rows.map((r) => r.followUpDate)].sort());
  });

  it("new = last 24h rolling; trending = In Progress; won = Won Lead; mine variants; assigned/unassigned", async () => {
    const admin = await mkAdmin();
    const u = await makeUser();
    const now = new Date("2026-06-15T12:00:00Z");
    const fresh = await makeLead({ createdAt: new Date(now.getTime() - 23 * 3600e3) });
    const edge = await makeLead({ createdAt: new Date(now.getTime() - 24 * 3600e3) });
    const old = await makeLead({ createdAt: new Date(now.getTime() - 25 * 3600e3) });
    const longAgo = new Date(now.getTime() - 90 * 24 * 3600e3);
    const ip = await makeLead({ status: "In Progress", createdAt: longAgo }, [{ userId: u.id }]);
    const won = await makeLead({ status: "Won Lead", createdAt: longAgo }, [{ userId: u.id }]);
    const otherWon = await makeLead({ status: "Won Lead", createdAt: longAgo });
    const L = (preset: Parameters<typeof listLeads>[1] extends infer T ? (T extends { preset?: infer P } ? P : never) : never, a = admin) => listLeads(a, { preset, now }).then(ids);
    expect(await L("new")).toEqual([fresh.id, edge.id].sort());
    expect(await L("trending")).toEqual([ip.id]);
    expect(await L("won")).toEqual([won.id, otherWon.id].sort());
    expect(await L("unassigned")).toEqual([fresh.id, edge.id, old.id, otherWon.id].sort());
    expect(await L("assigned")).toEqual([ip.id, won.id].sort());
    const ua = actorOf(u);
    expect(await L("mine", ua)).toEqual([ip.id, won.id].sort());
    expect(await L("myTrending", ua)).toEqual([ip.id]);
    expect(await L("conversions", ua)).toEqual([won.id]);
  });
});

describe("exports", () => {
  beforeEach(resetDb);

  it("contents match the filter, include source, neutralise formulas, and respect date ranges in IST", async () => {
    const admin = await mkAdmin();
    const u = await makeUser();
    const inRange = await makeLead({ name: "=HYPERLINK(\"x\")", category: "Books", status: "In Progress", followUpDate: new Date("2026-03-09T18:30:00Z"), source: "IMPORT" }, [{ userId: u.id }]);
    await makeLead({ name: "Before", category: "Books", followUpDate: new Date("2026-03-09T18:29:59Z") });
    await makeLead({ name: "After", category: "Books", followUpDate: new Date("2026-03-10T18:30:00Z") });
    await makeLead({ name: "OtherCat", category: "Toys", followUpDate: new Date("2026-03-10T00:00:00Z") });
    const res = await exportLeads(admin, { format: "csv", filter: { category: ["books"], dateType: "followUpDate", from: "2026-03-10", to: "2026-03-10" } });
    expect(res.rows).toBe(1);
    const text = res.body as string;
    expect(text.split("\r\n")[0]).toContain('"name","company","phone","contact","email","category","datatype"');
    expect(text.split("\r\n")[0]).toContain('"source"');
    expect(text).toContain("\"'=HYPERLINK(");
    expect(text).toContain('"IMPORT"');
    expect(text).toContain(u.name);
    expect(text).toContain("2026-03-10 00:00");
    expect(inRange.id).toBeTruthy();
    // user may export only theirs, even with filters that would match others
    const asUser = await exportLeads(actorOf(u), { format: "csv", filter: { category: ["books"] } });
    expect(asUser.rows).toBe(1);
    expect(asUser.body as string).not.toContain("Before");
    // inverted range is a 400
    await expect(exportLeads(admin, { format: "csv", filter: { from: "2026-03-11", to: "2026-03-10" } })).rejects.toMatchObject({ status: 400 });
    // createdAt default when dateType omitted
    expect((await exportLeads(admin, { format: "csv", filter: { from: "2000-01-01" } })).rows).toBe(4);
  });

  it("produces a valid XLSX with the same rows, and exports a preset view by filters", async () => {
    const admin = await mkAdmin();
    await makeLead({ name: "Won1", status: "Won Lead" });
    await makeLead({ name: "Open1" });
    const x = await exportLeads(admin, { format: "xlsx", preset: "won" });
    expect(x.rows).toBe(1);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(x.body as never);
    const ws = wb.worksheets[0]!;
    expect(ws.rowCount).toBe(2);
    expect(ws.getRow(2).getCell(1).value).toBe("Won1");
    await expect(exportLeads(admin, { format: "pdf" as never })).rejects.toMatchObject({ status: 400 });
  });
});
