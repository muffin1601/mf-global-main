import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { setStorageDriverForTests } from "@/lib/storage";
import type { Actor } from "@/server/actor";
import { createVendor } from "@/server/vendors/vendors";
import { INSERT_BATCH, commitImport, importReportCsv, importTemplateCsv, suggestMapping, uploadImport, validateImport } from "@/server/vendors/import-export";
import { prisma, resetDb } from "./helpers/db";
import { createMemoryStorage } from "./helpers/storage";
import { ids, importCsv, makeActors, validatedImport } from "./helpers/vendor-fixtures";

const mem = createMemoryStorage();
let admin: Actor, user: Actor;
beforeAll(() => setStorageDriverForTests(mem));
afterAll(() => setStorageDriverForTests(null));
beforeEach(async () => {
  await resetDb();
  mem.files.clear();
  ({ admin, user } = await makeActors());
});

const row = (name: string, extra: Partial<Record<"email" | "gstin" | "pan" | "category" | "status" | "contact" | "phone" | "city", string>> = {}) =>
  [name, extra.email ?? "", extra.gstin ?? "", extra.pan ?? "", extra.category ?? "", extra.status ?? "", extra.contact ?? "", extra.phone ?? "", extra.city ?? ""];

describe("import: upload and header detection", () => {
  it("suggests a mapping from header aliases and stores the file privately", async () => {
    const up = await uploadImport(admin, { fileName: "v.csv", buffer: importCsv([row("Acme Co")], ["Supplier Name", "E-mail", "GST No", "Pincode", "Mystery"]) });
    expect(up.mapping).toEqual({ "Supplier Name": "name", "E-mail": "email", "GST No": "gstin", Pincode: "postalCode", Mystery: "" });
    expect(up).toMatchObject({ totalRows: 1, status: "uploaded" });
    expect([...mem.files.keys()].every((k) => k.startsWith("vendor-documents/imports/"))).toBe(true);
    expect(suggestMapping(["Vendor Name"])).toEqual({ "Vendor Name": "name" });
  });

  it("rejects non-CSV, binary, empty and header-only files; the template is the header row", async () => {
    await expect(uploadImport(admin, { fileName: "v.xlsx", buffer: importCsv([row("A")]) })).rejects.toMatchObject({ status: 400 });
    await expect(uploadImport(admin, { fileName: "v.csv", buffer: Buffer.from("%PDF-1.4 stuff") })).rejects.toMatchObject({ status: 415 });
    await expect(uploadImport(admin, { fileName: "v.csv", buffer: Buffer.alloc(0) })).rejects.toMatchObject({ status: 400 });
    await expect(uploadImport(admin, { fileName: "v.csv", buffer: Buffer.from("Vendor Name,Email\r\n") })).rejects.toThrow(/no data rows/);
    await expect(uploadImport(admin, { fileName: "v.csv", buffer: Buffer.alloc(5 * 1024 * 1024, "a") })).rejects.toMatchObject({ status: 413 });
    expect(importTemplateCsv(admin).csv.split("\r\n")[0]).toContain("Vendor Name,Legal Name");
    expect(mem.files.size).toBe(0);
  });

  it("requires a Vendor Name mapping", async () => {
    const up = await uploadImport(admin, { fileName: "v.csv", buffer: importCsv([row("A")]) });
    await expect(validateImport(admin, up.jobId, { "Vendor Name": "" })).rejects.toThrow(/Vendor Name/);
  });

  it("is idempotent for a retried upload with the same key", async () => {
    const a = await uploadImport(admin, { fileName: "v.csv", buffer: importCsv([row("A Co")]), idempotencyKey: "k1" });
    const b = await uploadImport(admin, { fileName: "v.csv", buffer: importCsv([row("A Co")]), idempotencyKey: "k1" });
    expect(b.jobId).toBe(a.jobId);
    expect(await prisma.vendorImportJob.count()).toBe(1);
    expect(mem.files.size).toBe(1);
  });
});

describe("import: validation report", () => {
  it("classifies Ready / Error / Duplicate (existing and in-file) per row", async () => {
    const { gstin, pan } = ids(31);
    await createVendor(admin, { name: "Existing Traders", gstin, pan });
    const { val } = await validatedImport(admin, [
      row("Fresh One", { email: "fresh@x.test" }),          // 2 ready
      row("Bad Email Co", { email: "not-an-email" }),       // 3 error
      row("Dup By Gstin", { gstin }),                       // 4 duplicate (existing)
      row("Fresh Two"),                                      // 5 ready
      row("fresh two"),                                      // 6 duplicate (in-file name)
      row("", { email: "noname@x.test" }),                                        // 7 error (name missing)
      row("Wrong Status Co", { status: "Maybe" }),          // 8 error
      row("Bad Gstin Co", { gstin: "123" }),                // 9 error
    ]);
    expect(val.summary).toEqual({ totalRows: 8, readyToImport: 2, duplicates: 2, errors: 4 });
    const byRow = Object.fromEntries(val.preview.map((r) => [r.rowNumber, r.status]));
    expect(byRow).toEqual({ 2: "Ready", 3: "Error", 4: "Duplicate", 5: "Ready", 6: "Duplicate", 7: "Error", 8: "Error", 9: "Error" });
    expect(val.preview.find((r) => r.rowNumber === 3)?.reason).toMatch(/valid email/);
    expect(val.preview.find((r) => r.rowNumber === 4)?.reason).toMatch(/GSTIN already exists/);
    expect(await prisma.vendor.count()).toBe(1); // validation never writes vendors
  });

  it("re-validating with another mapping replaces the report", async () => {
    const { jobId } = await validatedImport(admin, [row("One Co"), row("Two Co")]);
    const again = await validateImport(admin, jobId, { "Vendor Name": "name", Email: "" });
    expect(again.summary.readyToImport).toBe(2);
    expect(await prisma.vendorImportRow.count({ where: { jobId } })).toBe(2);
  });
});

describe("import: commit", () => {
  it("creates vendors with codes, category, contact and address; report CSV lists every row", async () => {
    const cat = await prisma.vendorCategory.create({ data: { name: "Fasteners" } });
    const { jobId } = await validatedImport(admin, [
      row("Apple Bolts", { category: "fasteners", status: "Active", contact: "Ravi", phone: "9876543210", city: "Pune" }),
      row("Apple Nuts"),
      row("Broken", { email: "bad" }),
    ]);
    const r = await commitImport(admin, jobId);
    expect(r).toMatchObject({ done: true, summary: { totalRows: 3, imported: 2, duplicates: 0, errors: 1 } });
    const vendors = await prisma.vendor.findMany({ orderBy: { vendorCode: "asc" }, include: { contacts: true } });
    expect(vendors.map((v) => v.vendorCode)).toEqual(["VA001", "VA002"]);
    expect(vendors[0]).toMatchObject({ categoryId: cat.id, status: "ACTIVE", createdById: admin.id });
    expect(vendors[0]?.contacts[0]).toMatchObject({ name: "Ravi", isPrimary: true });
    expect(vendors[1]?.status).toBe("PENDING");
    expect(await prisma.vendorImportJob.findUniqueOrThrow({ where: { id: jobId } })).toMatchObject({ status: "completed", storagePath: "" });
    expect(mem.files.size).toBe(0); // CSV removed once the job is complete
    const report = (await importReportCsv(admin, jobId)).csv;
    expect(report).toContain("Imported");
    expect(report).toContain("Error");
    expect(await prisma.activityLog.count({ where: { action: "vendor.imported" } })).toBe(1);
  });

  it("is idempotent: committing twice (or retrying after completion) imports nothing extra", async () => {
    const { jobId } = await validatedImport(admin, [row("Idem One"), row("Idem Two")]);
    const first = await commitImport(admin, jobId);
    const second = await commitImport(admin, jobId);
    expect(first.summary.imported).toBe(2);
    expect(second).toMatchObject({ done: true, summary: { imported: 2 } });
    expect(await prisma.vendor.count()).toBe(2);
    expect(await prisma.activityLog.count({ where: { action: "vendor.imported" } })).toBe(1);
    await expect(validateImport(admin, jobId)).rejects.toMatchObject({ status: 409 });
  });

  it("requires validation first and enforces ownership", async () => {
    const up = await uploadImport(admin, { fileName: "v.csv", buffer: importCsv([row("Not Yet")]) });
    await expect(commitImport(admin, up.jobId)).rejects.toMatchObject({ status: 400 });
    await expect(commitImport(user, up.jobId)).rejects.toMatchObject({ status: 403 });
    await expect(commitImport(admin, "nope")).rejects.toMatchObject({ status: 400 });
  });

  it("commits in batches of 500 across resumable calls without duplicates or lost rows", async () => {
    expect(INSERT_BATCH).toBe(500);
    const n = 1100;
    const rows = Array.from({ length: n }, (_, i) => row(`Bulk Vendor ${String(i).padStart(4, "0")}`));
    const { jobId, val } = await validatedImport(admin, rows);
    expect(val.summary.readyToImport).toBe(n);

    const first = await commitImport(admin, jobId, { maxBatches: 1 });
    expect(first).toMatchObject({ done: false, remaining: 600, summary: { imported: 500 } });
    expect(await prisma.vendor.count()).toBe(500);
    // A retried / duplicated call must continue where it stopped, never re-insert.
    const [a, b] = await Promise.all([commitImport(admin, jobId, { maxBatches: 1 }), commitImport(admin, jobId, { maxBatches: 1 })]);
    expect(await prisma.vendor.count()).toBeLessThanOrEqual(1000);
    const last = await commitImport(admin, jobId, { maxBatches: 5 });
    void a; void b;
    expect(last).toMatchObject({ done: true, summary: { imported: n } });
    expect(await prisma.vendor.count()).toBe(n);
    const codes = (await prisma.vendor.findMany({ select: { vendorCode: true } })).map((v) => v.vendorCode);
    expect(new Set(codes).size).toBe(n);
    expect(codes).toContain("VB1100");
  }, 120_000);
});
