import { beforeEach, describe, expect, it } from "vitest";
import { SAMPLE_CSV, analyzeRows, normalizePhone, parseCsvText, parseLeadCsv, validateRow } from "@/lib/imports/lead-csv";
import { previewCsv } from "@/server/imports/service";
import { actorOf, makeLead, makeUser, resetDb } from "./helpers/db";

const HEADER = "Company Name,Contact Person,Mobile Number,Email,City,State,Category,Requirements,Remarks";

describe("lead CSV parsing and validation (MERN leadCsv.js rules)", () => {
  it("parses quotes, escaped quotes, CRLF and BOM", () => {
    const rows = parseCsvText('﻿a,b\r\n"x, y","he said ""hi"""\n');
    expect(rows).toEqual([["a", "b"], ["x, y", 'he said "hi"']]);
  });

  it("accepts the sample CSV and maps aliases case-insensitively", () => {
    const parsed = parseLeadCsv(SAMPLE_CSV);
    expect(parsed.ok && parsed.rows.length).toBe(3);
    const aliased = parseLeadCsv("firm,PERSON,Mobile,E-Mail\nAcme,Raj,9876543210,r@a.com");
    expect(aliased.ok && aliased.rows[0]?.data.company).toBe("Acme");
  });

  it("reports missing required columns", () => {
    const parsed = parseLeadCsv("Company Name,Email\nA,b@c.com");
    expect(parsed).toEqual({ ok: false, error: expect.stringContaining("Contact Person, Mobile Number") });
  });

  it("rejects an empty file and drops blank rows (rowNumber = position + 2)", () => {
    expect(parseLeadCsv(`${HEADER}\n,,,,,,,,\n`).ok).toBe(false);
    const parsed = parseLeadCsv(`${HEADER}\nA,B,9876543210,,,,,,\n,,,,,,,,\nC,D,9876543211,,,,,,`);
    expect(parsed.ok && parsed.rows.map((r) => r.rowNumber)).toEqual([2, 3]);
  });

  it("normalises phones (+91, 91, leading 0)", () => {
    expect(normalizePhone("+91 98765-43210")).toBe("9876543210");
    expect(normalizePhone("09876543210")).toBe("9876543210");
  });

  it.each([
    [{ name: "B", phone: "9876543210" }, "Missing Company Name"],
    [{ company: "A", phone: "9876543210" }, "Missing Contact Person"],
    [{ company: "A", name: "B" }, "Missing Mobile Number"],
    [{ company: "A", name: "B", phone: "1234567890" }, "Invalid Mobile Number"],
    [{ company: "A", name: "B", phone: "9876543210", email: "nope" }, "Invalid Email Format"],
    [{ company: "A".repeat(151), name: "B", phone: "9876543210" }, "Company Name exceeds 150 characters"],
  ])("validation %#", (row, reason) => {
    expect(validateRow(row)).toEqual({ ok: false, reason });
  });

  it("maps a valid row like MERN (capitalised category, datatype alias, Other default)", () => {
    const v = validateRow({ company: "A", name: "B", phone: "+919876543210", category: "eLECtronics", datatype: "justdial" });
    expect(v.ok && v.lead).toMatchObject({ phone: "9876543210", category: "Electronics", dataType: "JustDial" });
    const w = validateRow({ company: "A", name: "B", phone: "9876543210" });
    expect(w.ok && w.lead.dataType).toBe("Other");
  });

  it("flags in-file duplicates by phone then email", () => {
    const a = analyzeRows([
      { rowNumber: 2, data: { company: "A", name: "B", phone: "9876543210", email: "x@y.com" } },
      { rowNumber: 3, data: { company: "A2", name: "B", phone: "9876543210" } },
      { rowNumber: 4, data: { company: "A3", name: "B", phone: "9876543211", email: "X@y.com" } },
      { rowNumber: 5, data: { company: "", name: "B", phone: "9876543212" } },
    ]);
    expect(a.summary).toEqual({ total: 4, valid: 1, invalid: 1, duplicate: 2 });
    expect(a.rows.map((r) => r.reason)).toEqual(["", "Duplicate Mobile Number (in file)", "Duplicate Email (in file)", "Missing Company Name"]);
  });
});

describe("previewCsv (server: DB dedupe, capped previews)", () => {
  beforeEach(resetDb);

  it("dedupes against the database by phone (either column) and email", async () => {
    const admin = await makeUser({ role: "ADMIN" });
    await makeLead({ phone: "9876543210" });
    await makeLead({ phone: "9000000000", contact: "9876543211" });
    await makeLead({ phone: "9000000001", email: "dup@x.com" });
    const csv = [HEADER, "A,B,9876543210,,,,,,", "C,D,9876543211,,,,,,", "E,F,9876543212,DUP@x.com,,,,,", "G,H,9876543213,,,,,,", "I,J,12,,,,,,"].join("\n");
    const p = await previewCsv(actorOf(admin), { fileName: "f.csv", csv });
    expect(p.summary).toEqual({ total: 5, valid: 1, invalid: 1, duplicate: 3 });
    expect(p.skippedPreview.map((r) => r.reason)).toEqual(["Duplicate Mobile Number", "Duplicate Mobile Number", "Duplicate Email", "Invalid Mobile Number"]);
    expect(p.validPreview).toEqual([{ rowNumber: 5, company: "G" }]);
  });

  it("caps previews at 100 rows", async () => {
    const admin = await makeUser({ role: "ADMIN" });
    const lines = [HEADER];
    for (let i = 0; i < 130; i++) lines.push(`C${i},P${i},${9000000000 + i},,,,,,`);
    const p = await previewCsv(actorOf(admin), { fileName: "f.csv", csv: lines.join("\n") });
    expect(p.summary.valid).toBe(130);
    expect(p.validPreview).toHaveLength(100);
  });

  it("rejects a bad header with 400", async () => {
    const admin = await makeUser({ role: "ADMIN" });
    await expect(previewCsv(actorOf(admin), { fileName: "f.csv", csv: "a,b\n1,2" })).rejects.toMatchObject({ status: 400 });
  });
});
