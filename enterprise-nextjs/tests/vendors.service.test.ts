import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { setStorageDriverForTests } from "@/lib/storage";
import type { Actor } from "@/server/actor";
import { DuplicateError, archiveVendor, bulkSetStatus, checkDuplicates, createVendor, deleteVendor, getVendor, listVendors, restoreVendor, setVendorStatus, updateVendor, vendorAudit, vendorSummary } from "@/server/vendors/vendors";
import { addContact, deleteContact, setPrimaryContact, listContacts } from "@/server/vendors/contacts";
import { createCategory, deleteCategory, listCategories, updateCategory } from "@/server/vendors/categories";
import { addEvaluation, deleteEvaluation, leaderboard } from "@/server/vendors/performance";
import { addVendorProduct, updateVendorProduct } from "@/server/vendors/products";
import { addActivity, deleteActivity, updateActivity } from "@/server/vendors/activities";
import { exportVendors } from "@/server/vendors/import-export";
import { prisma, resetDb } from "./helpers/db";
import { createMemoryStorage } from "./helpers/storage";
import { ids, makeActors, newVendor } from "./helpers/vendor-fixtures";

let admin: Actor, user: Actor;
beforeAll(() => setStorageDriverForTests(createMemoryStorage()));
afterAll(() => setStorageDriverForTests(null));
beforeEach(async () => {
  await resetDb();
  ({ admin, user } = await makeActors());
});

const e6 = (n: number) => ({ quality: n, delivery: n, leadTime: n, pricing: n, responsiveness: n, compliance: n });

describe("create, code generation, validation", () => {
  it("generates V + first letter + 3-digit sequence and audits", async () => {
    const a = await createVendor(admin, { name: "Acme Steel" });
    const b = await createVendor(admin, { name: "Apex Metals" });
    const z = await createVendor(admin, { name: "123 Numeric" });
    expect([a.vendorCode, b.vendorCode, z.vendorCode]).toEqual(["VA001", "VA002", "VX001"]);
    expect(a.status).toBe("PENDING");
    const log = await prisma.activityLog.findFirstOrThrow({ where: { action: "vendor.created" } });
    expect(log.details).toMatchObject({ module: "vendor", vendorId: a.id, vendorCode: "VA001" });
  });

  it("rejects invalid GSTIN, PAN/GSTIN mismatch and bad bank data", async () => {
    await expect(createVendor(admin, { name: "X", })).rejects.toMatchObject({ status: 400 });
    await expect(createVendor(admin, { name: "Good Name", gstin: "BAD" })).rejects.toMatchObject({ status: 400 });
    const { gstin } = ids(5);
    await expect(createVendor(admin, { name: "Good Name", gstin, pan: "ZZZZZ9999Z" })).rejects.toThrow(/does not match the PAN/);
    await expect(createVendor(admin, { name: "Good Name", bank: { accountNumber: "12345678901", ifsc: "" } })).rejects.toThrow(/IFSC/);
  });

  it("creates nested contacts and addresses with one primary", async () => {
    const v = await createVendor(admin, { name: "Nest Co", contacts: [{ name: "A", email: "a@x.test" }, { name: "B", phone: "9876543210" }], addresses: [{ line1: "L1", postalCode: "560001" }] });
    const full = await prisma.vendor.findUniqueOrThrow({ where: { id: v.id }, include: { contacts: true, addresses: true } });
    expect(full.contacts.filter((c) => c.isPrimary)).toHaveLength(1);
    expect(full.addresses).toHaveLength(1);
  });
});

describe("duplicates", () => {
  it("blocks on GSTIN or PAN, warns (and allows confirm) on name/email/phone", async () => {
    const { gstin, pan } = ids(11);
    await createVendor(admin, { name: "Original Industries Pvt Ltd", gstin, pan, email: "Sales@Orig.test", phone: "+91 98765 43210" });

    await expect(createVendor(admin, { name: "Totally Different", gstin })).rejects.toMatchObject({ status: 409, blocking: true });
    await expect(createVendor(admin, { name: "Other", pan })).rejects.toMatchObject({ code: "DUPLICATE_BLOCKING" });

    for (const candidate of [{ name: "original industries ltd." }, { name: "Another One", email: "sales@orig.test" }, { name: "Third One", phone: "09876543210" }]) {
      const err = await createVendor(admin, candidate).catch((e) => e);
      expect(err).toBeInstanceOf(DuplicateError);
      expect(err.blocking).toBe(false);
      expect(err.duplicates[0].vendorCode).toBe("VO001");
    }
    const ok = await createVendor(admin, { name: "original industries ltd.", confirmDuplicate: true });
    expect(ok.vendorCode).toBe("VO002");
  });

  it("checkDuplicates reports matches and update excludes itself", async () => {
    const { gstin, pan } = ids(12);
    const v = await createVendor(admin, { name: "Self Match Co", gstin, pan });
    const res = await checkDuplicates(user, { name: "Self Match Co", gstin });
    expect(res.blocking[0]?.matchedOn).toEqual(expect.arrayContaining(["gstin", "name"]));
    expect((await checkDuplicates(user, { name: "Self Match Co", excludeId: v.id })).warnings).toHaveLength(0);
    await expect(updateVendor(admin, v.id, { gstin, name: "Self Match Co" })).resolves.toBeDefined();
  });
});

describe("update, audit diff, concurrency", () => {
  it("writes a diff into ActivityLog and rejects stale updatedAt", async () => {
    const v = await newVendor(admin, { industry: "Steel" });
    const first = await updateVendor(admin, v.id, { industry: "Chemicals", priority: "High" });
    expect(first.changed).toEqual(expect.arrayContaining(["industry", "priority"]));
    const log = await prisma.activityLog.findFirstOrThrow({ where: { action: "vendor.updated" } });
    expect(log.details).toMatchObject({ module: "vendor", changes: { industry: { from: "Steel", to: "Chemicals" } } });
    await expect(updateVendor(admin, v.id, { industry: "X", updatedAt: new Date(0).toISOString() })).rejects.toMatchObject({ status: 409 });
    const audit = await vendorAudit(user, v.id);
    expect(audit.entries.map((e) => e.action)).toEqual(expect.arrayContaining(["vendor.created", "vendor.updated"]));
  });

  it("changing the name does not regenerate the code", async () => {
    const v = await newVendor(admin);
    const u = await updateVendor(admin, v.id, { name: "Renamed Entirely" });
    expect(u.vendorCode).toBe(v.vendorCode);
  });
});

describe("bank data", () => {
  const bank = { bankName: "HDFC", accountNumber: "123456789012", ifsc: "HDFC0001234", upi: "vendor@hdfc", currency: "USD", paymentTerms: "Net 30" };

  it("is writable only with vendor.edit_bank and masked unless vendor.view_bank", async () => {
    const withBank = await createVendor(admin, { name: "Banked Co", bank });
    const fromUser = await createVendor(user, { name: "Sneaky Co", bank });
    expect((await prisma.vendor.findUniqueOrThrow({ where: { id: fromUser.id } })).bankDetails).toBeNull(); // dropped for USER

    const adminView = await getVendor(admin, withBank.id);
    expect(adminView.bank).toMatchObject({ restricted: false, accountNumberMasked: "********9012", ifsc: "HDFC0001234", currency: "USD" });
    expect(JSON.stringify(adminView)).not.toContain("123456789012");

    const userView = await getVendor(user, withBank.id);
    expect(userView.bank).toMatchObject({ restricted: true, currency: "USD", paymentTerms: "Net 30" });
    const text = JSON.stringify(userView);
    for (const secret of ["123456789012", "HDFC0001234", "vendor@hdfc", "HDFC"]) expect(text).not.toContain(secret);

    // USER cannot overwrite bank data through update; admin can; masked echo keeps the stored number
    await updateVendor(user, withBank.id, { bank: { ...bank, accountNumber: "999999999999" } });
    expect((await prisma.vendor.findUniqueOrThrow({ where: { id: withBank.id } })).bankDetails).toMatchObject({ accountNumber: "123456789012" });
    await updateVendor(admin, withBank.id, { bank: { bankName: "ICICI", accountNumber: "********9012", ifsc: "ICIC0000001" } });
    expect((await prisma.vendor.findUniqueOrThrow({ where: { id: withBank.id } })).bankDetails).toMatchObject({ bankName: "ICICI", accountNumber: "123456789012", ifsc: "ICIC0000001" });

    // audit rows never contain bank values
    const logs = JSON.stringify(await prisma.activityLog.findMany({ where: { action: { startsWith: "vendor." } } }));
    expect(logs).not.toContain("123456789012");
    expect(logs).not.toContain("HDFC0001234");
  });

  it("restricts bank-looking keys in legacy data for users and masks them for admins", async () => {
    const v = await newVendor(admin);
    await prisma.vendor.update({ where: { id: v.id }, data: { legacyData: { remark: "old", bank: { accountNumber: "555566667777" } } } });
    const u = JSON.stringify(await getVendor(user, v.id));
    expect(u).not.toContain("555566667777");
    expect(u).toContain("old");
    const a = JSON.stringify(await getVendor(admin, v.id));
    expect(a).not.toContain("555566667777");
  });
});

describe("status, archive and permanent delete", () => {
  it("changes status, bulk status; blacklisting needs vendor.archive", async () => {
    const v = await newVendor(admin);
    await setVendorStatus(user, v.id, "ACTIVE");
    expect((await prisma.vendor.findUniqueOrThrow({ where: { id: v.id } })).status).toBe("ACTIVE");
    await expect(setVendorStatus(user, v.id, "BLOCKED")).rejects.toMatchObject({ status: 403 });
    await expect(bulkSetStatus(user, [v.id], "Blacklisted")).rejects.toMatchObject({ status: 403 });
    await expect(setVendorStatus(admin, v.id, "nonsense")).rejects.toMatchObject({ status: 400 });
    const w = await newVendor(admin);
    expect(await bulkSetStatus(user, [v.id, w.id], "INACTIVE")).toEqual({ updated: 2 });
    expect(await setVendorStatus(admin, v.id, "BLOCKED")).toMatchObject({ unchanged: false });
  });

  it("must archive first, type the vendor code, then cascades", async () => {
    const v = await newVendor(admin);
    await addContact(admin, v.id, { name: "C", email: "c@x.test" });
    await addActivity(admin, v.id, { description: "n" });
    await addEvaluation(admin, v.id, e6(4));
    await expect(deleteVendor(admin, v.id, v.vendorCode)).rejects.toThrow(/Archive the vendor/);
    await archiveVendor(admin, v.id);
    await expect(deleteVendor(admin, v.id, "WRONG")).rejects.toThrow(/Type the vendor code/);
    await expect(deleteVendor(admin, v.id, undefined)).rejects.toMatchObject({ status: 400 });
    expect(await deleteVendor(admin, v.id, v.vendorCode.toLowerCase())).toMatchObject({ deleted: true });
    expect(await prisma.vendor.count({ where: { id: v.id } })).toBe(0);
    expect(await prisma.vendorContact.count()).toBe(0);
    expect(await prisma.vendorActivity.count()).toBe(0);
    expect(await prisma.vendorEvaluation.count()).toBe(0);
    // audit trail survives
    expect(await prisma.activityLog.count({ where: { action: "vendor.deleted" } })).toBe(1);
  });

  it("archive hides from the default list and restore brings it back", async () => {
    const v = await newVendor(admin);
    await archiveVendor(admin, v.id);
    expect((await listVendors(user, {})).total).toBe(0);
    expect((await listVendors(user, { archived: "true" })).total).toBe(1);
    await restoreVendor(admin, v.id);
    expect((await listVendors(user, {})).total).toBe(1);
  });
});

describe("list, filters, summary, export", () => {
  it("searches name/code/GSTIN/PAN/email/phone, filters, sorts and pages", async () => {
    const cat = await prisma.vendorCategory.create({ data: { name: "Electricals" } });
    const { gstin, pan } = ids(21);
    const a = await createVendor(admin, { name: "Alpha Wires", gstin, pan, email: "hello@alpha.test", phone: "+91 91234 56780", categoryId: cat.id, priority: "High", vendorType: "Manufacturer", tags: ["wire", "copper"], ownerId: user.id });
    await createVendor(admin, { name: "Beta Bolts", priority: "Low", status: "ACTIVE" });
    await createVendor(admin, { name: "Gamma Gears" });

    const q = async (query: Record<string, string>) => (await listVendors(user, query)).vendors.map((v) => v.name);
    expect(await q({ search: "alpha" })).toEqual(["Alpha Wires"]);
    expect(await q({ search: a.vendorCode })).toEqual(["Alpha Wires"]);
    expect(await q({ search: gstin.slice(0, 8) })).toEqual(["Alpha Wires"]);
    expect(await q({ search: pan })).toEqual(["Alpha Wires"]);
    expect(await q({ search: "hello@alpha" })).toEqual(["Alpha Wires"]);
    expect(await q({ search: "91234 56780" })).toEqual(["Alpha Wires"]);
    expect(await q({ search: "9123456780" })).toEqual(["Alpha Wires"]);
    expect(await q({ category: cat.id })).toEqual(["Alpha Wires"]);
    expect(await q({ owner: user.id })).toEqual(["Alpha Wires"]);
    expect((await q({ owner: "unassigned" })).sort()).toEqual(["Beta Bolts", "Gamma Gears"]);
    expect(await q({ priority: "Low" })).toEqual(["Beta Bolts"]);
    expect(await q({ type: "Manufacturer" })).toEqual(["Alpha Wires"]);
    expect(await q({ tag: "copper" })).toEqual(["Alpha Wires"]);
    expect(await q({ status: "active" })).toEqual(["Beta Bolts"]);
    expect(await q({ createdFrom: "2999-01-01" })).toEqual([]);
    expect((await q({ createdFrom: "2000-01-01", createdTo: "2999-01-01" })).length).toBe(3);
    expect(await q({ sortBy: "name", sortDir: "asc" })).toEqual(["Alpha Wires", "Beta Bolts", "Gamma Gears"]);
    const paged = await listVendors(user, { sortBy: "name", sortDir: "asc", limit: 2, page: 2 });
    expect(paged).toMatchObject({ total: 3, pages: 2, page: 2 });
    expect(paged.vendors.map((v) => v.name)).toEqual(["Gamma Gears"]);
    expect((await listVendors(user, { search: "alpha" })).vendors[0]).not.toHaveProperty("bankDetails");
  });

  it("summary cards derive from real data", async () => {
    const v = await newVendor(admin, { status: "ACTIVE" });
    await newVendor(admin); // pending
    const old = await newVendor(admin, { status: "INACTIVE" });
    await prisma.vendor.update({ where: { id: old.id }, data: { createdAt: new Date(Date.now() - 90 * 86_400_000) } });
    await prisma.vendorDocument.create({ data: { vendorId: v.id, name: "d", storagePath: "p", originalName: "d.pdf", expiryDate: new Date(Date.now() + 5 * 86_400_000) } });
    const product = await prisma.product.create({ data: { code: "LT1", name: "Lead" } });
    await addVendorProduct(admin, v.id, { productId: product.id, purchasePrice: 5, leadTimeDays: 12 });
    await addEvaluation(admin, v.id, e6(4));
    const s = await vendorSummary(user);
    expect(s).toMatchObject({ total: 3, active: 1, pending: 1, inactive: 1, addedLast30Days: 2, vendorsWithExpiringDocuments: 1, requiringReview: 1, averageRating: 4, averageLeadTimeDays: 12 });
  });

  it("export honours the current filter, is formula-safe, excludes bank data and is audited", async () => {
    await createVendor(admin, { name: "=cmd Evil Co", status: "ACTIVE", bank: { accountNumber: "123456789012", ifsc: "HDFC0001234" } });
    await createVendor(admin, { name: "Quiet Co" });
    const all = await exportVendors(user, {});
    expect(all.count).toBe(2);
    const some = await exportVendors(user, { status: "ACTIVE" });
    expect(some.count).toBe(1);
    expect(some.csv).toContain("'=cmd Evil Co");
    expect(some.csv).not.toContain("Quiet Co");
    expect(some.csv).not.toContain("123456789012");
    await expect(exportVendors(user, { status: "BLOCKED" })).rejects.toMatchObject({ status: 404 });
    expect(await prisma.activityLog.count({ where: { action: "vendor.exported" } })).toBe(2);
  });
});

describe("contacts, activities, categories", () => {
  it("keeps exactly one primary contact and promotes another on delete", async () => {
    const v = await newVendor(admin);
    const c1 = await addContact(user, v.id, { name: "One", email: "1@x.test" });
    const c2 = await addContact(user, v.id, { name: "Two", email: "2@x.test" });
    expect(c1.isPrimary).toBe(true);
    expect(c2.isPrimary).toBe(false);
    await setPrimaryContact(user, v.id, c2.id);
    expect((await listContacts(user, v.id)).filter((c) => c.isPrimary).map((c) => c.name)).toEqual(["Two"]);
    await deleteContact(user, v.id, c2.id);
    expect((await listContacts(user, v.id)).map((c) => [c.name, c.isPrimary])).toEqual([["One", true]]);
    await expect(addContact(user, v.id, { name: "NoWay" })).rejects.toThrow(/email or a phone/);
  });

  it("scopes a contact to its vendor", async () => {
    const v = await newVendor(admin);
    const w = await newVendor(admin);
    const c = await addContact(admin, v.id, { name: "One", email: "1@x.test" });
    await expect(deleteContact(admin, w.id, c.id)).rejects.toMatchObject({ status: 404 });
    await expect(deleteContact(admin, "not-a-uuid", c.id)).rejects.toMatchObject({ status: 400 });
  });

  it("only the author (or an admin) edits an activity; timeline updates lastActivityAt", async () => {
    const v = await newVendor(admin);
    const act = await addActivity(admin, v.id, { description: "admin note", type: "Meeting", occurredAt: "2026-03-01T10:00:00Z" });
    await expect(updateActivity(user, v.id, act.id, { description: "hack" })).rejects.toMatchObject({ status: 403 });
    await expect(deleteActivity(user, v.id, act.id)).rejects.toMatchObject({ status: 403 });
    const mine = await addActivity(user, v.id, { description: "user note" });
    await expect(updateActivity(user, v.id, mine.id, { description: "edited" })).resolves.toMatchObject({ description: "edited" });
    await expect(updateActivity(admin, v.id, mine.id, { description: "admin edit" })).resolves.toBeDefined();
    await deleteActivity(user, v.id, mine.id);
    expect((await prisma.vendor.findUniqueOrThrow({ where: { id: v.id } })).lastActivityAt?.toISOString()).toBe("2026-03-01T10:00:00.000Z");
  });

  it("category CRUD: unique names, deletion requires reassignment when in use", async () => {
    const c1 = await createCategory(admin, { name: "Packaging" });
    await expect(createCategory(admin, { name: "packaging" })).rejects.toMatchObject({ status: 409 });
    const c2 = await createCategory(admin, { name: "Logistics" });
    await expect(updateCategory(admin, c2.id, { name: "PACKAGING" })).rejects.toMatchObject({ status: 409 });
    const v = await newVendor(admin, { categoryId: c1.id });
    await expect(deleteCategory(admin, c1.id)).rejects.toMatchObject({ status: 409 });
    await expect(deleteCategory(admin, c1.id, c1.id)).rejects.toMatchObject({ status: 400 });
    expect(await deleteCategory(admin, c1.id, c2.id)).toEqual({ deleted: true, vendorsReassigned: 1 });
    expect((await prisma.vendor.findUniqueOrThrow({ where: { id: v.id } })).categoryId).toBe(c2.id);
    const list = await listCategories(user);
    expect(list).toEqual([expect.objectContaining({ name: "Logistics", vendorCount: 1 })]);
    await expect(createVendor(admin, { name: "Bad Cat Co", categoryId: c1.id })).rejects.toMatchObject({ status: 400 });
  });
});

describe("vendor products and price tiers", () => {
  it("rejects overlapping effective windows for the same product, allows adjacent ones", async () => {
    const v = await newVendor(admin);
    const w = await newVendor(admin);
    const p = await prisma.product.create({ data: { code: "PX", name: "Pipe" } });
    const first = await addVendorProduct(user, v.id, { productId: p.id, purchasePrice: "100.5", effectiveFrom: "2026-01-01", effectiveTo: "2026-06-30" });
    expect(first.purchasePrice).toBe(100.5);
    await expect(addVendorProduct(user, v.id, { productId: p.id, purchasePrice: 90, effectiveFrom: "2026-03-01", effectiveTo: "2026-04-01" })).rejects.toMatchObject({ status: 409 });
    await expect(addVendorProduct(user, v.id, { productId: p.id, purchasePrice: 90, effectiveFrom: "2025-12-01" })).rejects.toMatchObject({ status: 409 }); // open-ended spill into first
    const next = await addVendorProduct(user, v.id, { productId: p.id, purchasePrice: 95, effectiveFrom: "2026-06-30" });
    await addVendorProduct(user, w.id, { productId: p.id, purchasePrice: 99, effectiveFrom: "2026-02-01" }); // other vendor unaffected
    await expect(updateVendorProduct(user, v.id, next.id, { effectiveFrom: "2026-05-01" })).rejects.toMatchObject({ status: 409 });
    await expect(updateVendorProduct(user, v.id, first.id, { effectiveTo: "2026-07-15" })).rejects.toMatchObject({ status: 409 }); // would collide with the later record
    await expect(updateVendorProduct(user, v.id, next.id, { purchasePrice: 96 })).resolves.toMatchObject({ purchasePrice: 96 });
  });

  it("validates and stores price tiers (no overlap, stored as exact decimals)", async () => {
    const v = await newVendor(admin);
    const p = await prisma.product.create({ data: { code: "PT", name: "Tiered" } });
    await expect(addVendorProduct(user, v.id, { productId: p.id, purchasePrice: 10, priceTiers: [{ minQty: 1, maxQty: 10, unitPrice: 9 }, { minQty: 5, maxQty: 20, unitPrice: 8 }] })).rejects.toThrow(/overlap/);
    await expect(addVendorProduct(user, v.id, { productId: p.id, purchasePrice: -1 })).rejects.toThrow(/negative/);
    const ok = await addVendorProduct(user, v.id, { productId: p.id, purchasePrice: 10.1, priceTiers: [{ minQty: 1, maxQty: 10, unitPrice: 9.99 }, { minQty: 10, unitPrice: 8.5 }] });
    expect(ok.priceTiers.map((t) => [t.minQty, t.maxQty, t.unitPrice])).toEqual([[1, 10, 9.99], [10, null, 8.5]]);
    const replaced = await updateVendorProduct(user, v.id, ok.id, { priceTiers: [{ minQty: 1, unitPrice: 7 }] });
    expect(replaced.priceTiers).toHaveLength(1);
  });
});

describe("evaluations and leaderboard", () => {
  it("recomputes the vendor performance columns on add and delete", async () => {
    const v = await newVendor(admin);
    await expect(addEvaluation(admin, v.id, { ...e6(4), quality: 6 })).rejects.toThrow(/between 1 and 5/);
    await expect(addEvaluation(admin, v.id, { ...e6(4), pricing: undefined })).rejects.toThrow(/required/);
    const rounding = await newVendor(admin);
    expect((await addEvaluation(admin, rounding.id, { quality: 5, delivery: 4, leadTime: 3, pricing: 4, responsiveness: 5, compliance: 4 })).evaluation.overallScore).toBe(4.17);
    const r1 = await addEvaluation(admin, v.id, { quality: 5, delivery: 4, leadTime: 3, pricing: 4, responsiveness: 5, compliance: 3 });
    expect(r1.evaluation.overallScore).toBe(4);
    expect(r1.performance).toMatchObject({ evaluationCount: 1, overallScore: 4 });
    const r2 = await addEvaluation(admin, v.id, e6(2));
    expect(r2.performance).toMatchObject({ evaluationCount: 2, overallScore: 3 }); // mean of 4.00 and 2.00
    let row = await prisma.vendor.findUniqueOrThrow({ where: { id: v.id } });
    expect([row.evaluationCount, Number(row.performanceScore)]).toEqual([2, 3]);
    expect(row.lastEvaluatedAt).not.toBeNull();
    await deleteEvaluation(admin, v.id, r2.evaluation.id);
    row = await prisma.vendor.findUniqueOrThrow({ where: { id: v.id } });
    expect([row.evaluationCount, Number(row.performanceScore)]).toEqual([1, 4]);
    await deleteEvaluation(admin, v.id, r1.evaluation.id);
    row = await prisma.vendor.findUniqueOrThrow({ where: { id: v.id } });
    expect([row.evaluationCount, row.performanceScore, row.lastEvaluatedAt]).toEqual([0, null, null]);
  });

  it("leaderboard is admin-only, sorted and excludes archived vendors", async () => {
    const a = await newVendor(admin, { name: "Good Supplier" });
    const b = await newVendor(admin, { name: "Poor Supplier" });
    const c = await newVendor(admin, { name: "Archived Supplier" });
    await newVendor(admin, { name: "Unrated Supplier" });
    await addEvaluation(admin, a.id, e6(5));
    await addEvaluation(admin, b.id, e6(2));
    await addEvaluation(admin, c.id, e6(5));
    await archiveVendor(admin, c.id);
    await expect(leaderboard(user)).rejects.toMatchObject({ status: 403 });
    await expect(leaderboard(null)).rejects.toMatchObject({ status: 401 });
    const lb = await leaderboard(admin);
    expect(lb.vendors.map((v) => [v.name, v.performanceScore, v.performanceBand])).toEqual([["Good Supplier", 5, "Excellent"], ["Poor Supplier", 2, "Average"]]);
    expect(lb.unevaluated).toBe(1);
    await expect(addEvaluation(user, a.id, e6(3))).rejects.toMatchObject({ status: 403 });
  });
});
