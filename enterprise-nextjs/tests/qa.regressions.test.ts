// Regression tests for defects found in the 2026-11-20 QA audit (docs/qa/BUG_REGISTER.md). Each test was
// written to FAIL on the pre-fix code and pass after the fix. IDs refer to the bug register.
import { beforeEach, describe, expect, it } from "vitest";
import { actorOf, makeLead, makeUser, prisma, resetDb } from "./helpers/db";
import { isDateString } from "@/lib/time/ist";
import { parseLeadFilter } from "@/server/leads/filter-schema";
import { buildLeadWhere } from "@/server/leads/where";
import { deleteAllFiltered } from "@/server/leads/mutations";
import { calculateLineItem, calculateQuotationTotals, round2 } from "@/server/quotations/calc";
import { computeNetAmount } from "@/server/catalog/price";
import { guardFormula, toXlsx } from "@/lib/export/tabular";
import { cleanInput } from "@/lib/imports/lead-csv";
import { isPhone } from "@/server/vendors/fields";
import * as vendors from "@/server/vendors/vendors";
import { createQuotation } from "@/server/quotations/service";
import { setStorageDriverForTests } from "@/lib/storage";
import { createMemoryStorage } from "./helpers/storage";
import { ids } from "./helpers/vendor-fixtures";
import ExcelJS from "exceljs";

describe("LEAD-5: malformed URL parameters never reach the database", () => {
  it("isDateString rejects impossible calendar days that Date.parse rolls over", () => {
    expect(isDateString("2024-02-29")).toBe(true);
    expect(isDateString("2024-02-31")).toBe(false);
    expect(isDateString("2023-02-29")).toBe(false);
    expect(isDateString("2024-13-01")).toBe(false);
    expect(isDateString("2024-00-10")).toBe(false);
  });
  it("parseLeadFilter drops invalid dates and non-uuid assignees", () => {
    const f = parseLeadFilter({ from: "2024-13-01", to: "2024-02-31", dateType: "createdAt", assignedTo: ["abc", "00000000-0000-4000-8000-000000000001"] });
    expect(f.from).toBeUndefined();
    expect(f.to).toBeUndefined();
    expect(f.assignedTo).toEqual(["00000000-0000-4000-8000-000000000001"]);
  });
  it("building the where clause from hostile params does not throw", async () => {
    await resetDb();
    const admin = actorOf(await makeUser({ role: "ADMIN" }));
    const where = buildLeadWhere(admin, parseLeadFilter({ from: "2024-13-01", assignedTo: "abc" }), "all");
    await expect(prisma.lead.count({ where })).resolves.toBe(0);
  });
});

describe("QP-3: half-up rounding to paise is correct above 2", () => {
  it.each([
    [26.25, 18, 4.73],
    [36.75, 18, 6.62],
    [85.75, 18, 15.44],
    [12.25, 18, 2.21],
    [40.1, 5, 2.01],
  ])("tax on %s @ %s%% = %s", (price, tax, expected) => {
    expect(calculateLineItem({ qty: 1, price, tax }).taxAmount).toBe(expected);
  });
  it("round2 handles negatives, zero, binary noise and non-numbers", () => {
    expect(round2(1.005)).toBe(1.01);
    expect(round2(-1.005)).toBe(-1.01);
    expect(round2(0)).toBe(0);
    expect(round2("abc")).toBe(0);
    expect(round2(4.7249999999999996)).toBe(4.73);
    expect(round2(123456789.125)).toBe(123456789.13);
  });
  it("product net amount uses the same rounding (1.5 + 5% = 1.575 -> 1.58)", () => {
    expect(computeNetAmount(1.5, 5)).toBe(1.58);
  });
  it("an independently derived quotation total matches", () => {
    // 3 x 499.99 less 10% @5% ; 2 x 1250 @12% ; 7 x 85.50 less 5% @18% ; 10% summary discount ; 150 charges
    // taxable: 1349.973 -> 1349.97 | 2500.00 | 568.575 -> 568.58   => subtotal 4418.55
    // tax:     67.49865 -> 67.50   | 300.00  | 102.3435 -> 102.34  => tax 469.84
    // discount 10% of 4418.55 = 441.855 -> 441.86 ; total = 4418.55 + 469.84 + 150 - 441.86 = 4596.53
    const t = calculateQuotationTotals(
      [{ qty: 3, price: 499.99, discount: 10, tax: 5 }, { qty: 2, price: 1250, tax: 12 }, { qty: 7, price: 85.5, discount: 5, tax: 18 }],
      { discount: 10, discountType: "%", additionalCharges: 150 },
    );
    expect(t).toMatchObject({ subtotal: 4418.55, totalTax: 469.84, totalDiscount: 441.86, grandTotal: 4596.53 });
  });
});

describe("LEAD-8 / VEN-19: exports keep phone numbers intact but still block formulas", () => {
  it("CSV guard", () => {
    expect(guardFormula("+91 98765 43210")).toBe("+91 98765 43210");
    expect(guardFormula("-250.50")).toBe("-250.50");
    expect(guardFormula("=HYPERLINK(\"http://x\")")).toBe("'=HYPERLINK(\"http://x\")");
    expect(guardFormula("+SUM(A1)")).toBe("'+SUM(A1)");
    expect(guardFormula("-2+3*cmd|' /C calc'!A0")).toBe("'-2+3*cmd|' /C calc'!A0");
    expect(guardFormula("@SUM(1)")).toBe("'@SUM(1)");
  });
  it("XLSX stores the raw phone text (no apostrophe) as a plain string, never a formula", async () => {
    const buf = await toXlsx("T", [{ key: "p", header: "Phone", value: (r: { p: string }) => r.p }, { key: "f", header: "F", value: () => "=1+1" }], [{ p: "+91 98765 43210" }]);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as unknown as ArrayBuffer);
    const row = wb.worksheets[0]!.getRow(2);
    expect(row.getCell(1).value).toBe("+91 98765 43210");
    expect(row.getCell(2).value).toBe("=1+1");
    expect(row.getCell(2).type).toBe(ExcelJS.ValueType.String);
  });
});

describe("LEAD-7: CSV import keeps Unicode names", () => {
  it("keeps accents and Devanagari, strips control characters", () => {
    expect(cleanInput("José Müller")).toBe("José Müller");
    expect(cleanInput("राहुल शर्मा")).toBe("राहुल शर्मा");
    expect(cleanInput("Café\u0000\u0007 Ltd� ")).toBe("Café Ltd");
    expect(cleanInput(null)).toBe("");
  });
});

describe("LEAD-10: delete-all-matching cannot be unlocked by dateType alone", () => {
  beforeEach(resetDb);
  it("refuses dateType without dates, still allows a real filter", async () => {
    const admin = actorOf(await makeUser({ role: "ADMIN" }));
    await makeLead({ category: "Keep" });
    await makeLead({ category: "Drop" });
    await expect(deleteAllFiltered(admin, { filter: { dateType: "createdAt" } })).rejects.toMatchObject({ status: 400 });
    expect(await prisma.lead.count()).toBe(2);
    await expect(deleteAllFiltered(admin, { filter: { category: ["Drop"] } })).resolves.toEqual({ deleted: 1 });
  });
});

describe("VEN-7: Indian landlines are valid vendor phone numbers", () => {
  it.each(["022 2345 6789", "+91 22 2345 6789", "02223456789", "9876543210", "+91 98765 43210"])("%s is valid", (v) => expect(isPhone(v)).toBe(true));
  it.each(["0123456789", "12345", "1123456789"])("%s is invalid", (v) => expect(isPhone(v)).toBe(false));
});

describe("VEN-2 / VEN-3: vendor duplicate detection and blacklist", () => {
  beforeEach(async () => { await resetDb(); setStorageDriverForTests(createMemoryStorage()); });

  it("finds the GSTIN duplicate even when 30+ vendors share the name prefix", async () => {
    const admin = actorOf(await makeUser({ role: "ADMIN" }));
    const target = ids(9001);
    await vendors.createVendor(admin, { name: "SK Zeta Traders", gstin: target.gstin, pan: target.pan });
    for (let i = 0; i < 35; i++) {
      const other = ids(9100 + i);
      await prisma.vendor.create({ data: { vendorCode: `SKX${i}`, name: `SK Traders ${i}`, gstin: other.gstin, pan: other.pan } });
    }
    const { blocking } = await vendors.findDuplicates({ name: "SK", gstin: target.gstin } as never);
    expect(blocking.map((b) => b.name)).toContain("SK Zeta Traders");
  });

  it("a USER cannot take a vendor off the blacklist, singly or in bulk", async () => {
    const admin = actorOf(await makeUser({ role: "ADMIN" }));
    const user = actorOf(await makeUser({ role: "USER" }));
    const v = await vendors.createVendor(admin, { name: "Blocked Supplies", ...ids(9500) });
    const other = await vendors.createVendor(admin, { name: "Pending Supplies", ...ids(9501) });
    await vendors.setVendorStatus(admin, v.id, "BLOCKED");
    await expect(vendors.setVendorStatus(user, v.id, "ACTIVE")).rejects.toMatchObject({ status: 403 });
    const res = await vendors.bulkSetStatus(user, [v.id, other.id], "ACTIVE");
    expect(res.updated).toBe(1);
    expect((await prisma.vendor.findUniqueOrThrow({ where: { id: v.id } })).status).toBe("BLOCKED");
    await expect(vendors.setVendorStatus(admin, v.id, "ACTIVE")).resolves.toMatchObject({ status: "ACTIVE" });
  });
});

describe("SEC-13: only administrators may start a quotation numbering series", () => {
  beforeEach(async () => { await resetDb(); setStorageDriverForTests(createMemoryStorage()); });
  it("a USER's prefix is replaced by the company prefix; an admin's is kept", async () => {
    const admin = actorOf(await makeUser({ role: "ADMIN" }));
    const user = actorOf(await makeUser({ role: "USER" }));
    await prisma.companySettings.create({ data: { key: "default", companyName: "Co", address: "A", gst: "G", pan: "P", bankDetails: {}, invoicePrefix: "INV", invoiceStart: 1, quotationPrefix: "MF/Q/" } });
    const body = (prefix: string) => ({ party: { name: "Buyer" }, items: [{ name: "X", qty: 1, price: 10, tax: 18 }], invoiceDetails: { prefix } });
    const u = await createQuotation(user, body("FAKE/"));
    const a = await createQuotation(admin, body("BR2/"));
    expect(u.invoiceDetails.prefix).toBe("MF/Q/");
    expect(a.invoiceDetails.prefix).toBe("BR2/");
  });
});

describe("VEND-AUDIT: vendor audit trail of a non-existent vendor", () => {
  it("returns 404 instead of an empty 200 page", async () => {
    await resetDb();
    const admin = actorOf(await makeUser({ role: "ADMIN" }));
    await expect(vendors.vendorAudit(admin, "00000000-0000-4000-8000-000000000999")).rejects.toMatchObject({ status: 404 });
    const v = await vendors.createVendor(admin, { name: "Audit Target", ...ids(9700) });
    await expect(vendors.vendorAudit(admin, v.id)).resolves.toMatchObject({ page: 1 });
  });
});

describe("VIEW-BLANK: saved views keep the 'blank' value of multi-value filters", () => {
  it("category= (blank) survives save and reload; empty free-text params are still dropped", async () => {
    const { sanitizeParams } = await import("@/server/views/service");
    expect(sanitizeParams({ category: "", priority: "High", q: "", page: "3" })).toEqual({ category: "", priority: "High" });
  });
});
