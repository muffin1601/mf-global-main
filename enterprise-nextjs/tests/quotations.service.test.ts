import { beforeEach, describe, expect, it } from "vitest";
import { actorOf, makeLead, makeUser, prisma, resetDb } from "./helpers/db";
import { createQuotation, deleteQuotation, getQuotation, listQuotations, updateQuotation } from "@/server/quotations/service";
import { searchQuotationClients } from "@/server/quotations/clients";
import { quotationPdf } from "@/server/quotations/pdf";
import { createMemoryStorage } from "./helpers/storage";
import { setStorageDriverForTests } from "@/lib/storage";

const payload = (overrides: Record<string, unknown> = {}) => ({
  party: { name: "Buyer One", company: "Buyer Co" },
  items: [
    { name: "Service A", qty: 2, price: 100.1, discount: 10, tax: 18 },
    { name: "Service B", qty: 1, price: 50, discount: 0, tax: 5 },
  ],
  invoiceDetails: { prefix: "MF/Q/", number: "FORGED", date: "2026-10-16" },
  summary: { discount: 5, discountType: "%", additionalCharges: 10, autoRoundOff: true, roundOffSign: "+", roundOffAmount: 0.25, amountReceived: 100 },
  terms: "Test terms",
  ...overrides,
});

let admin: ReturnType<typeof actorOf>, owner: ReturnType<typeof actorOf>, outsider: ReturnType<typeof actorOf>;
beforeEach(async () => {
  await resetDb();
  setStorageDriverForTests(createMemoryStorage());
  admin = actorOf(await makeUser({ role: "ADMIN" }));
  owner = actorOf(await makeUser());
  outsider = actorOf(await makeUser());
});

describe("create", () => {
  it("assigns the owner, ignores forged number and computes authoritative totals", async () => {
    const q = await createQuotation(owner, payload());
    expect(q.userId).toBe(owner.id);
    expect(q.invoiceDetails.number).not.toBe("FORGED");
    expect(q.totals).toEqual({ subtotal: 230.18, totalTax: 34.93, totalDiscount: 11.51, additionalCharges: 10, roundOff: 0.25, grandTotal: 263.85, amountReceived: 100, balanceAmount: 163.85 });
    expect(q.items).toHaveLength(2);
    const row = await prisma.quotation.findUniqueOrThrow({ where: { id: q.id } });
    expect(row.grandTotal.toString()).toBe("263.85");
    expect(await prisma.activityLog.count({ where: { action: "quotation.created" } })).toBe(1);
  });
  it("rejects invalid payloads", async () => {
    await expect(createQuotation(owner, payload({ items: [] }))).rejects.toMatchObject({ status: 400 });
    await expect(createQuotation(owner, payload({ items: [{ name: "Bad", qty: -1, price: 2 }] }))).rejects.toMatchObject({ status: 400 });
    await expect(createQuotation(owner, payload({ party: {} }))).rejects.toMatchObject({ status: 400 });
    await expect(createQuotation(owner, payload({ items: [{ name: "x", qty: 1e9, price: 1 }] }))).rejects.toMatchObject({ status: 400 });
  });
});

describe("invoice numbering", () => {
  it("issues unique numbers under 10 concurrent creates", async () => {
    const res = await Promise.all(Array.from({ length: 10 }, () => createQuotation(owner, payload())));
    const numbers = res.map((r) => r.invoiceDetails.number as string);
    expect(new Set(numbers).size).toBe(10);
    expect([...numbers].map(Number).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(await prisma.quotation.count()).toBe(10);
  });
  it("continues after the highest migrated number for the prefix", async () => {
    for (const n of ["1570", "1571", "12"]) {
      await prisma.quotation.create({ data: { userId: owner.id, party: { name: "Old" }, invoiceDetails: { prefix: "MF/Q/", number: n }, grandTotal: 1 } });
    }
    await prisma.quotation.create({ data: { userId: owner.id, party: { name: "Other" }, invoiceDetails: { prefix: "OTHER/", number: "9000" } } });
    const q = await createQuotation(admin, payload());
    expect(q.invoiceDetails.number).toBe("1572");
    const other = await createQuotation(admin, payload({ invoiceDetails: { prefix: "OTHER/" } }));
    expect(other.invoiceDetails.number).toBe("9001");
  });
  it("honours CompanySettings.invoiceStart for a fresh prefix", async () => {
    await prisma.companySettings.create({ data: { key: "default", companyName: "Co", address: "A", gst: "G", pan: "P", bankDetails: {}, invoicePrefix: "I/", invoiceStart: 500, quotationPrefix: "MF/Q/" } });
    expect((await createQuotation(owner, payload())).invoiceDetails.number).toBe("500");
    expect((await createQuotation(owner, payload())).invoiceDetails.number).toBe("501");
  });
});

describe("update", () => {
  it("updates in place, keeps number/prefix/owner and recomputes totals", async () => {
    const created = await createQuotation(owner, payload());
    const updated = await updateQuotation(owner, created.id, payload({
      items: [{ name: "Revised", qty: 3, price: 20, discount: 0, tax: 0 }],
      invoiceDetails: { prefix: "HACK/", number: "999" },
      summary: { discount: 0, discountType: "%", additionalCharges: 0 },
    }));
    expect(await prisma.quotation.count()).toBe(1);
    expect(await prisma.quotationItem.count()).toBe(1);
    expect(updated.invoiceDetails.number).toBe(created.invoiceDetails.number);
    expect(updated.invoiceDetails.prefix).toBe(created.invoiceDetails.prefix);
    expect(updated.userId).toBe(owner.id);
    expect(updated.totals.grandTotal).toBe(60);
  });
  it("blocks other users, allows admin", async () => {
    const created = await createQuotation(owner, payload());
    await expect(updateQuotation(outsider, created.id, payload())).rejects.toMatchObject({ status: 403 });
    await expect(updateQuotation(admin, created.id, payload())).resolves.toBeTruthy();
    await expect(updateQuotation(owner, "00000000-0000-4000-8000-000000000000", payload())).rejects.toMatchObject({ status: 404 });
    await expect(updateQuotation(owner, "not-an-id", payload())).rejects.toMatchObject({ status: 400 });
  });
});

describe("fetch, list, delete authorization", () => {
  it("enforces ownership on fetch and scopes list; admin sees all and pages", async () => {
    const a = await createQuotation(owner, payload());
    await createQuotation(outsider, payload());
    await expect(getQuotation(outsider, a.id)).rejects.toMatchObject({ status: 403 });
    await expect(getQuotation(owner, "not-an-id")).rejects.toMatchObject({ status: 400 });
    await expect(getQuotation(admin, a.id)).resolves.toBeTruthy();
    expect((await listQuotations(owner)).total).toBe(1);
    const all = await listQuotations(admin, { page: 1, pageSize: 1 });
    expect(all.total).toBe(2);
    expect(all.data).toHaveLength(1);
    expect(all.pages).toBe(2);
    expect(all.data[0]).toMatchObject({ customer: "Buyer One", company: "Buyer Co" });
  });
  it("delete is admin only", async () => {
    const a = await createQuotation(owner, payload());
    await expect(deleteQuotation(owner, a.id)).rejects.toMatchObject({ status: 403 });
    await deleteQuotation(admin, a.id);
    expect(await prisma.quotation.count()).toBe(0);
    await expect(deleteQuotation(admin, a.id)).rejects.toMatchObject({ status: 404 });
  });
});

describe("migrated quotations", () => {
  it("are read with stored totals, never recomputed, and legacyData survives an edit", async () => {
    const m = await prisma.quotation.create({
      data: {
        userId: owner.id, party: { name: "Legacy", company: "Legacy Co" }, invoiceDetails: { prefix: "MF/Q/", number: "100" },
        subtotal: 1000, discount: 0, tax: 0, roundOff: 0, grandTotal: 777.77, legacyData: { keep: "me" },
        items: { create: [{ name: "Old item", quantity: 1, price: 1, discount: 0, tax: 0 }] },
      },
    });
    const dto = await getQuotation(owner, m.id);
    expect(dto.totals.grandTotal).toBe(777.77);
    expect(dto.totals.subtotal).toBe(1000);
    expect((await listQuotations(owner)).data[0]?.grandTotal).toBe(777.77);
    await updateQuotation(owner, m.id, payload());
    const after = await prisma.quotation.findUniqueOrThrow({ where: { id: m.id } });
    expect(after.legacyData).toEqual({ keep: "me" });
    expect(after.grandTotal.toString()).toBe("263.85");
  });
});

describe("client picker", () => {
  it("admin sees all leads, a user only assigned ones; search is server side", async () => {
    await makeLead({ name: "Alpha Buyer", company: "Acme", billingAddress: { street: "1 Main", city: "Delhi", state: "Delhi", postalCode: "110001", country: "India" } }, [{ userId: owner.id }]);
    await makeLead({ name: "Beta", company: "Other" }, [{ userId: outsider.id }]);
    await makeLead({ name: "Unassigned", company: "Nobody" });
    expect((await searchQuotationClients(admin)).total).toBe(3);
    const mine = await searchQuotationClients(owner);
    expect(mine.total).toBe(1);
    expect(mine.data[0]?.party).toMatchObject({ name: "Alpha Buyer", company: "Acme", state: "Delhi", billToAddress: "1 Main, Delhi, Delhi, 110001, India" });
    expect((await searchQuotationClients(owner, { q: "beta" })).total).toBe(0);
    expect((await searchQuotationClients(admin, { q: "BETA" })).total).toBe(1);
  });
});

describe("pdf", () => {
  it("renders a valid PDF with the invoice number for the owner and admin; 403 for others", async () => {
    const q = await createQuotation(owner, payload({ items: [{ name: "Widget", qty: 1, price: 10, image: "missing.png" }] }));
    const { name, body } = await quotationPdf(owner, q.id);
    expect(body.subarray(0, 5).toString()).toBe("%PDF-");
    expect(body.subarray(-8).toString()).toContain("%%EOF");
    const number = `${q.invoiceDetails.prefix}${q.invoiceDetails.number}`;
    expect(name).toContain("Quotation_");
    const text = body.toString("latin1");
    const hex = Buffer.from(number, "latin1").toString("hex");
    expect(text.includes(`Quotation ${number}`)).toBe(true);
    expect(text.includes(hex) || text.includes(number)).toBe(true);
    await expect(quotationPdf(admin, q.id)).resolves.toBeTruthy();
    await expect(quotationPdf(outsider, q.id)).rejects.toMatchObject({ status: 403 });
  });
});
