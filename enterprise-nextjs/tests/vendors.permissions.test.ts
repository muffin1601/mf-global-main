import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { hasVendorPermission, type VendorPermission } from "@/lib/permissions";
import { setStorageDriverForTests } from "@/lib/storage";
import type { Actor } from "@/server/actor";
import * as vendors from "@/server/vendors/vendors";
import * as contacts from "@/server/vendors/contacts";
import * as activities from "@/server/vendors/activities";
import * as categories from "@/server/vendors/categories";
import * as performance from "@/server/vendors/performance";
import * as products from "@/server/vendors/products";
import * as documents from "@/server/vendors/documents";
import * as io from "@/server/vendors/import-export";
import { resetDb } from "./helpers/db";
import { createMemoryStorage } from "./helpers/storage";
import { PDF, fixtures, ids, importCsv, makeActors, validatedImport } from "./helpers/vendor-fixtures";

type Ctx = Awaited<ReturnType<typeof fixtures>> & { jobId: string };
type Op = { name: string; perm: VendorPermission; run: (a: Actor | null, c: Ctx) => Promise<unknown> };

const eval6 = { quality: 5, delivery: 4, leadTime: 3, pricing: 4, responsiveness: 5, compliance: 4 };
const uniq = () => Math.random().toString(36).slice(2, 8);

const OPS: Op[] = [
  { name: "vendorMeta", perm: "vendor.view", run: (a) => vendors.vendorMeta(a) },
  { name: "listVendors", perm: "vendor.view", run: (a) => vendors.listVendors(a, {}) },
  { name: "vendorSummary", perm: "vendor.view", run: (a) => vendors.vendorSummary(a) },
  { name: "checkDuplicates", perm: "vendor.view", run: (a) => vendors.checkDuplicates(a, { name: "Nobody Here" }) },
  { name: "createVendor", perm: "vendor.create", run: (a) => vendors.createVendor(a, { name: `Created ${uniq()} Traders` }) },
  { name: "getVendor", perm: "vendor.view", run: (a, c) => vendors.getVendor(a, c.vendor.id) },
  { name: "updateVendor", perm: "vendor.edit", run: (a, c) => vendors.updateVendor(a, c.vendor.id, { industry: "Steel" }) },
  { name: "setVendorStatus", perm: "vendor.edit", run: (a, c) => vendors.setVendorStatus(a, c.vendor.id, "ACTIVE") },
  { name: "bulkSetStatus", perm: "vendor.edit", run: (a, c) => vendors.bulkSetStatus(a, [c.vendor.id], "ACTIVE") },
  { name: "archiveVendor", perm: "vendor.archive", run: (a, c) => vendors.archiveVendor(a, c.vendor.id) },
  { name: "restoreVendor", perm: "vendor.archive", run: (a, c) => vendors.restoreVendor(a, c.archived.id) },
  { name: "bulkArchive", perm: "vendor.archive", run: (a, c) => vendors.bulkArchive(a, [c.vendor.id]) },
  { name: "deleteVendor", perm: "vendor.delete", run: (a, c) => vendors.deleteVendor(a, c.archived.id, c.archived.vendorCode) },
  { name: "vendorAudit", perm: "vendor.view", run: (a, c) => vendors.vendorAudit(a, c.vendor.id) },

  { name: "listContacts", perm: "vendor.view", run: (a, c) => contacts.listContacts(a, c.vendor.id) },
  { name: "addContact", perm: "vendor.edit", run: (a, c) => contacts.addContact(a, c.vendor.id, { name: "New", phone: "9876543210" }) },
  { name: "updateContact", perm: "vendor.edit", run: (a, c) => contacts.updateContact(a, c.vendor.id, c.contact.id, { designation: "CEO" }) },
  { name: "setPrimaryContact", perm: "vendor.edit", run: (a, c) => contacts.setPrimaryContact(a, c.vendor.id, c.contact.id) },
  { name: "deleteContact", perm: "vendor.edit", run: (a, c) => contacts.deleteContact(a, c.vendor.id, c.contact.id) },
  { name: "listAddresses", perm: "vendor.view", run: (a, c) => contacts.listAddresses(a, c.vendor.id) },
  { name: "addAddress", perm: "vendor.edit", run: (a, c) => contacts.addAddress(a, c.vendor.id, { line1: "2 Side Street" }) },
  { name: "updateAddress", perm: "vendor.edit", run: (a, c) => contacts.updateAddress(a, c.vendor.id, c.address.id, { city: "Pune" }) },
  { name: "setPrimaryAddress", perm: "vendor.edit", run: (a, c) => contacts.setPrimaryAddress(a, c.vendor.id, c.address.id) },
  { name: "deleteAddress", perm: "vendor.edit", run: (a, c) => contacts.deleteAddress(a, c.vendor.id, c.address.id) },

  { name: "listActivities", perm: "vendor.view", run: (a, c) => activities.listActivities(a, c.vendor.id) },
  { name: "addActivity", perm: "vendor.edit", run: (a, c) => activities.addActivity(a, c.vendor.id, { description: "x" }) },
  { name: "updateActivity", perm: "vendor.edit", run: (a, c) => activities.updateActivity(a, c.vendor.id, c.activity.id, { description: "y" }) },
  { name: "deleteActivity", perm: "vendor.edit", run: (a, c) => activities.deleteActivity(a, c.vendor.id, c.activity.id) },

  { name: "listCategories", perm: "vendor.view", run: (a) => categories.listCategories(a) },
  { name: "createCategory", perm: "vendor.manage_categories", run: (a) => categories.createCategory(a, { name: `New ${uniq()}` }) },
  { name: "updateCategory", perm: "vendor.manage_categories", run: (a, c) => categories.updateCategory(a, c.category.id, { description: "d" }) },
  { name: "deleteCategory", perm: "vendor.manage_categories", run: (a, c) => categories.deleteCategory(a, c.category2.id) },

  { name: "listEvaluations", perm: "vendor.view", run: (a, c) => performance.listEvaluations(a, c.vendor.id) },
  { name: "addEvaluation", perm: "vendor.performance", run: (a, c) => performance.addEvaluation(a, c.vendor.id, eval6) },
  { name: "deleteEvaluation", perm: "vendor.performance", run: (a, c) => performance.deleteEvaluation(a, c.vendor.id, String(c.evaluation.id)) },
  { name: "leaderboard", perm: "vendor.performance", run: (a) => performance.leaderboard(a) },

  { name: "listVendorProducts", perm: "vendor.view", run: (a, c) => products.listVendorProducts(a, c.vendor.id) },
  { name: "vendorsByProduct", perm: "vendor.view", run: (a, c) => products.vendorsByProduct(a, c.product.id) },
  { name: "searchProducts", perm: "vendor.view", run: (a) => products.searchProducts(a, "Widget") },
  { name: "addVendorProduct", perm: "vendor.edit", run: (a, c) => products.addVendorProduct(a, c.vendor.id, { productId: c.product.id, purchasePrice: 12, effectiveFrom: "2026-09-01" }) },
  { name: "updateVendorProduct", perm: "vendor.edit", run: (a, c) => products.updateVendorProduct(a, c.vendor.id, c.item.id, { purchasePrice: 11 }) },
  { name: "deleteVendorProduct", perm: "vendor.edit", run: (a, c) => products.deleteVendorProduct(a, c.vendor.id, c.item.id) },

  { name: "listDocuments", perm: "vendor.view", run: (a, c) => documents.listDocuments(a, c.vendor.id) },
  { name: "uploadDocument", perm: "vendor.documents", run: (a, c) => documents.uploadDocument(a, c.vendor.id, { name: "PAN card" }, { buffer: PDF, name: "pan.pdf" }) },
  { name: "replaceDocumentFile", perm: "vendor.documents", run: (a, c) => documents.replaceDocumentFile(a, c.vendor.id, c.doc.id, { buffer: PDF, name: "new.pdf" }) },
  { name: "updateDocument", perm: "vendor.documents", run: (a, c) => documents.updateDocument(a, c.vendor.id, c.doc.id, { name: "Renamed" }) },
  { name: "deleteDocument", perm: "vendor.documents", run: (a, c) => documents.deleteDocument(a, c.vendor.id, c.doc.id) },
  { name: "documentSignedUrl", perm: "vendor.view", run: (a, c) => documents.documentSignedUrl(a, c.vendor.id, c.doc.id) },
  { name: "readDocument", perm: "vendor.view", run: (a, c) => documents.readDocument(a, c.vendor.id, c.doc.id) },

  { name: "uploadImport", perm: "vendor.import", run: (a) => io.uploadImport(a, { fileName: "v.csv", buffer: importCsv([[`Imp ${uniq()} Co`, "", "", "", "", "", "", "", ""]]) }) },
  { name: "validateImport", perm: "vendor.import", run: (a, c) => io.validateImport(a, c.jobId) },
  { name: "commitImport", perm: "vendor.import", run: (a, c) => io.commitImport(a, c.jobId) },
  { name: "importReportCsv", perm: "vendor.import", run: (a, c) => io.importReportCsv(a, c.jobId) },
  { name: "importTemplateCsv", perm: "vendor.import", run: async (a) => io.importTemplateCsv(a) },
  { name: "exportVendors", perm: "vendor.export", run: (a) => io.exportVendors(a, {}) },
];

// Exported functions that are pure helpers or internals, not service operations.
const NOT_OPS = new Set([
  "buildVendorWhere", "findDuplicates", "nextVendorSeq", "codeLetter", "formatCode", "validateUpload", "suggestMapping", "recomputeVendorPerformance", "DuplicateError",
]);

describe("vendor permission matrix (server-side, every service operation)", () => {
  let admin: Actor, user: Actor;
  beforeAll(() => setStorageDriverForTests(createMemoryStorage()));
  afterAll(() => setStorageDriverForTests(null));
  beforeEach(async () => {
    await resetDb();
    ({ admin, user } = await makeActors());
  });

  it("covers every exported service function", () => {
    const exported = new Set<string>();
    for (const mod of [vendors, contacts, activities, categories, performance, products, documents, io]) {
      for (const [k, v] of Object.entries(mod)) if (typeof v === "function" && !NOT_OPS.has(k)) exported.add(k);
    }
    const covered = new Set(OPS.map((o) => o.name));
    expect([...exported].filter((k) => !covered.has(k))).toEqual([]);
    expect([...covered].filter((k) => !exported.has(k))).toEqual([]);
  });

  it("matches the declared permission table", () => {
    expect(hasVendorPermission("USER", "vendor.archive")).toBe(false);
    expect(hasVendorPermission("USER", "vendor.documents")).toBe(true);
    expect(hasVendorPermission("ADMIN", "vendor.view_bank")).toBe(true);
  });

  async function prepare(owner: Actor): Promise<Ctx> {
    const c = await fixtures(owner);
    const { jobId } = await validatedImport(admin, [[`Matrix ${uniq()} Supplies`, "", ids().gstin, ids().pan, "", "", "", "", ""]]);
    return { ...c, jobId };
  }

  it.each(OPS.map((o) => [o.name, o] as const))("%s: unauthenticated -> 401, USER per matrix, ADMIN allowed", async (_name, op) => {
    // unauthenticated
    const c0 = await prepare(admin);
    await expect(op.run(null, c0)).rejects.toMatchObject({ status: 401 });

    // user: allowed only with the capability (fixtures owned by the user so ownership rules do not interfere)
    const cu = await prepare(user);
    if (hasVendorPermission("USER", op.perm)) await expect(op.run(user, cu)).resolves.toBeDefined();
    else await expect(op.run(user, cu)).rejects.toMatchObject({ status: 403 });

    // admin
    const ca = await prepare(admin);
    await expect(op.run(admin, ca)).resolves.toBeDefined();
  });
});
