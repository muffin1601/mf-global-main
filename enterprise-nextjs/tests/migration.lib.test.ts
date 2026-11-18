import { createRequire } from "node:module";
import { ObjectId } from "mongodb";
import { describe, expect, it } from "vitest";
import { assertSafeWriteTarget, createdAtOf, inferLeadSource, legacyQuotationTotals, resolveCategoryRef } from "../scripts/migrate-mongodb/lib";

// The ORIGINAL MERN calculator, read-only: the migration must agree with it to the paisa.
const merncalc = createRequire(import.meta.url)("../../backend/utils/quotationCalc.js") as {
  calculateQuotationTotals: (items: unknown[], summary: unknown) => { subtotal: number; totalTax: number; totalDiscount: number; roundOff: number; grandTotal: number };
};

describe("migration: insertion timestamps", () => {
  it("keeps the historical createdAt", () => {
    const d = new Date("2026-06-23T05:11:00Z");
    expect(createdAtOf({ _id: new ObjectId(), createdAt: d })).toEqual(d);
  });
  it("falls back to the ObjectId time, never the epoch and never 'now'", () => {
    const id = ObjectId.createFromTime(Math.floor(Date.parse("2026-06-22T10:00:00Z") / 1000));
    expect(createdAtOf({ _id: id }).toISOString()).toBe("2026-06-22T10:00:00.000Z");
    expect(createdAtOf({ _id: id, createdAt: "not a date" }).toISOString()).toBe("2026-06-22T10:00:00.000Z");
  });
});

describe("migration: lead source attribution (always flagged as inferred)", () => {
  it("uses hard evidence only", () => {
    expect(inferLeadSource({ fileName: "leads.csv", datatype: "LinkedIn" })).toEqual({ source: "IMPORT", sourceInferred: true });
    expect(inferLeadSource({ datatype: "IndiaMart" }).source).toBe("INDIAMART");
    expect(inferLeadSource({ datatype: "TradeIndia" }).source).toBe("TRADEINDIA");
    expect(inferLeadSource({ datatype: "WebPortals" }).source).toBe("WEBHOOK");
    expect(inferLeadSource({ createdBy: new ObjectId(), datatype: "Offline" }).source).toBe("MANUAL");
  });
  it("does not guess MANUAL without evidence", () => {
    expect(inferLeadSource({ datatype: "Offline", fileName: null })).toEqual({ source: "LEGACY", sourceInferred: true });
    expect(inferLeadSource({ datatype: "LinkedIn", fileName: "" }).source).toBe("LEGACY");
    expect(inferLeadSource({}).source).toBe("LEGACY");
  });
});

describe("migration: product category join (DB-04)", () => {
  const known = { objectIds: new Set(["6901af27f0729d2a996fcd8e"]), codes: new Set(["CA001"]) };
  it("resolves the ObjectId stored in product.cat_id", () => {
    expect(resolveCategoryRef("6901af27f0729d2a996fcd8e", known).kind).toBe("objectId");
  });
  it("still accepts a category code and flags unknown values", () => {
    expect(resolveCategoryRef("CA001", known).kind).toBe("code");
    expect(resolveCategoryRef("6aaa56ca814b9fb8cb4590ed", known).kind).toBe("unresolved");
    expect(resolveCategoryRef(undefined, known).kind).toBe("none");
  });
});

describe("migration: quotation totals match the MERN calculator exactly", () => {
  const rnd = (a: number, b: number) => a + Math.random() * (b - a);
  it("agrees with backend/utils/quotationCalc.js on 500 random quotations", () => {
    for (let i = 0; i < 500; i++) {
      const items = Array.from({ length: 1 + Math.floor(rnd(0, 6)) }, () => ({
        qty: Math.round(rnd(1, 500)), price: Math.round(rnd(1, 99999)) / 100 * (Math.random() < 0.3 ? 1.337 : 1),
        discount: Math.random() < 0.5 ? Math.round(rnd(0, 40) * 10) / 10 : 0, tax: [0, 5, 12, 18, 28][Math.floor(rnd(0, 5))],
      }));
      const summary = {
        discountType: Math.random() < 0.5 ? "%" : "amount", discount: Math.round(rnd(0, 30)),
        additionalCharges: Math.random() < 0.4 ? Math.round(rnd(0, 800)) : 0,
        autoRoundOff: Math.random() < 0.6, roundOffSign: Math.random() < 0.5 ? "+" : "-", roundOffAmount: Math.round(rnd(0, 99)) / 100,
      };
      const mine = legacyQuotationTotals(items, summary);
      const orig = merncalc.calculateQuotationTotals(items, summary);
      expect({ subtotal: mine.subtotal, tax: mine.totalTax, discount: mine.discount, roundOff: mine.roundOff, grand: mine.grandTotal })
        .toEqual({ subtotal: orig.subtotal, tax: orig.totalTax, discount: orig.totalDiscount, roundOff: orig.roundOff, grand: orig.grandTotal });
    }
  });
  it("rounds each line before summing (the paise-drift case)", () => {
    const items = Array.from({ length: 3 }, () => ({ qty: 1, price: 0.335, discount: 0, tax: 0 }));
    expect(legacyQuotationTotals(items, {}).subtotal).toBe(1.02); // 3 x round(0.335)=0.34, not round(1.005)=1.01
  });
});

describe("migration: production write guard", () => {
  it("refuses Supabase hosts without the explicit written-approval flag", () => {
    expect(() => assertSafeWriteTarget("postgresql://u:p@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres", {})).toThrow(/Refusing/);
    expect(() => assertSafeWriteTarget("postgresql://u:p@db.abcd.supabase.co:5432/postgres", {})).toThrow(/Refusing/);
    expect(() => assertSafeWriteTarget("postgresql://u:p@db.abcd.supabase.co:5432/postgres", { ALLOW_PRODUCTION_WRITE: "yes" })).toThrow(/Refusing/);
  });
  it("allows isolated databases and an explicitly approved target", () => {
    expect(assertSafeWriteTarget("postgresql://postgres:test@127.0.0.1:54330/crm_test", {}).isSupabase).toBe(false);
    expect(assertSafeWriteTarget("postgresql://u:p@db.abcd.supabase.co:5432/postgres", { ALLOW_PRODUCTION_WRITE: "I_HAVE_WRITTEN_APPROVAL" }).isSupabase).toBe(true);
  });
  it("never echoes credentials in its error", () => {
    try { assertSafeWriteTarget("postgresql://user:SuperSecret@db.abcd.supabase.co:5432/postgres", {}); } catch (e) { expect(String(e)).not.toContain("SuperSecret"); }
  });
});
