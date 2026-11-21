// Pure CSV lead-import logic shared by the browser (parse + preview) and the
// server (authoritative re-validation of every batch). No server-only imports.
// Ported from the MERN `backend/utils/leadCsv.js`.

export const HEADER_ALIASES = {
  company: ["company name", "company", "companyname", "firm", "organisation", "organization"],
  name: ["contact person", "contact person name", "contact name", "name", "contactperson", "person"],
  phone: ["mobile number", "mobile no", "mobile no.", "mobile", "phone", "phone number", "phone no", "contact number"],
  email: ["email", "email address", "e-mail", "mail"],
  location: ["city", "location", "town"],
  state: ["state", "region"],
  category: ["category", "industry", "segment"],
  requirements: ["requirements", "requirement", "needs"],
  remarks: ["remarks", "remark", "notes", "note"],
  contact: ["alternate contact", "alt contact", "secondary contact"],
  datatype: ["datatype", "data type", "source", "lead source"],
  quantity: ["quantity", "qty"],
  address: ["address", "full address"],
} as const;

export type CanonicalField = keyof typeof HEADER_ALIASES;
export type CanonicalRow = Partial<Record<CanonicalField, string>>;

export const REQUIRED_FIELDS: CanonicalField[] = ["company", "name", "phone"];
const FRIENDLY: Partial<Record<CanonicalField, string>> = { company: "Company Name", name: "Contact Person", phone: "Mobile Number" };

export const DATATYPE_ALIASES: Record<string, string> = {
  indiamart: "IndiaMart", offline: "Offline", tradeindia: "TradeIndia", justdial: "JustDial", webportals: "WebPortals",
  linkedin: "LinkedIn", linkend: "LinkedIn", calling: "Offline", exhibition: "Offline", other: "Other",
};

export const MAX_LEN = { company: 150, name: 100, location: 100, state: 100, category: 100 };
export const PHONE_REGEX = /^[6-9][0-9]{9}$/;
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const PREVIEW_CAP = 100;
export const BATCH_SIZE = 500;
export const MAX_IMPORT_ROWS = 50_000;
export const MAX_FILE_BYTES = 50 * 1024 * 1024;

export const SAMPLE_CSV = [
  "Company Name,Contact Person,Mobile Number,Email,City,State,Category,Requirements,Remarks",
  "Acme Industries,Rahul Sharma,9876543210,rahul@acme.com,Delhi,Delhi,Manufacturing,Need 500 units of valves,Follow up next week",
  "Bright Electronics,Priya Verma,9812345678,priya@bright.in,Mumbai,Maharashtra,Electronics,Bulk LED order,Interested in catalogue",
  "Sunrise Traders,Amit Patel,9123456780,,Ahmedabad,Gujarat,Trading,Requirement for packaging material,Call after 5pm",
].join("\r\n");

// Strip control characters and U+FFFD, and trim. Unicode text is KEPT: the MERN rule (drop everything outside
// printable ASCII) turned "José Müller" into "Jos Mller" and emptied Devanagari names, which then failed the
// "Contact Person required" check.
export const cleanInput = (input: unknown): string =>
  (input == null ? "" : String(input)).normalize("NFC").replace(/[\u0000-\u001F\u007F-\u009F�]/g, "").trim();

export function normalizePhone(raw: string | undefined): string {
  let digits = (raw ?? "").replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  return digits;
}

/** RFC 4180 parser (quotes, escaped quotes, CRLF/LF, BOM). Returns raw string cells. */
export function parseCsvText(input: string): string[][] {
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  let i = 0;
  const endRow = () => { row.push(cell); cell = ""; rows.push(row); row = []; };
  while (i < text.length) {
    const ch = text[i]!;
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i += 2; continue; }
        quoted = false; i++; continue;
      }
      cell += ch; i++; continue;
    }
    if (ch === '"' && cell === "") { quoted = true; i++; continue; }
    if (ch === ",") { row.push(cell); cell = ""; i++; continue; }
    if (ch === "\r") { endRow(); i += text[i + 1] === "\n" ? 2 : 1; continue; }
    if (ch === "\n") { endRow(); i++; continue; }
    cell += ch; i++;
  }
  if (cell !== "" || row.length) endRow();
  return rows;
}

export type HeaderMap = { indexToField: Map<number, CanonicalField>; missingRequired: string[] };

export function buildHeaderMap(rawHeaders: string[]): HeaderMap {
  const lower = rawHeaders.map((h) => cleanInput(h).toLowerCase());
  const indexToField = new Map<number, CanonicalField>();
  for (const [field, aliases] of Object.entries(HEADER_ALIASES) as [CanonicalField, readonly string[]][]) {
    const idx = lower.findIndex((h) => aliases.includes(h));
    if (idx !== -1) indexToField.set(idx, field);
  }
  const present = new Set(indexToField.values());
  return { indexToField, missingRequired: REQUIRED_FIELDS.filter((f) => !present.has(f)).map((f) => FRIENDLY[f]!) };
}

export const isBlankRow = (row: CanonicalRow) => Object.values(row).every((v) => !v || !v.trim());

export type ParsedCsv =
  | { ok: false; error: string }
  | { ok: true; rows: { rowNumber: number; data: CanonicalRow }[] };

const NO_ROWS = "The file has no data rows. Add at least one lead and try again.";

/** Parse + canonicalise. Blank rows are dropped; rowNumber = position among non-blank rows + 2 (MERN). */
export function parseLeadCsv(text: string): ParsedCsv {
  const table = parseCsvText(text);
  const header = table[0];
  if (!header) return { ok: false, error: NO_ROWS };
  const map = buildHeaderMap(header);
  if (map.missingRequired.length) {
    return { ok: false, error: `Missing required column(s): ${map.missingRequired.join(", ")}. Download the sample CSV for the correct format.` };
  }
  const rows: { rowNumber: number; data: CanonicalRow }[] = [];
  for (const cells of table.slice(1)) {
    const data: CanonicalRow = {};
    for (const [idx, field] of map.indexToField) data[field] = cleanInput(cells[idx]);
    if (!isBlankRow(data)) rows.push({ rowNumber: rows.length + 2, data });
  }
  if (!rows.length) return { ok: false, error: NO_ROWS };
  return { ok: true, rows };
}

export type ValidLead = {
  name: string; company: string; email: string | null; phone: string; contact: string | null; location: string | null;
  state: string | null; category: string | null; quantity: number; requirements: string; remarks: string;
  dataType: string; address: string | null;
};

export function validateRow(canonical: CanonicalRow): { ok: true; lead: ValidLead } | { ok: false; reason: string } {
  const company = canonical.company ?? "";
  const name = canonical.name ?? "";
  const phone = normalizePhone(canonical.phone);
  const email = (canonical.email ?? "").trim();
  if (!company) return { ok: false, reason: "Missing Company Name" };
  if (!name) return { ok: false, reason: "Missing Contact Person" };
  if (!canonical.phone || !phone) return { ok: false, reason: "Missing Mobile Number" };
  if (!PHONE_REGEX.test(phone)) return { ok: false, reason: "Invalid Mobile Number" };
  if (email && !EMAIL_REGEX.test(email)) return { ok: false, reason: "Invalid Email Format" };
  const checks: [string | undefined, number, string][] = [
    [company, MAX_LEN.company, "Company Name"], [name, MAX_LEN.name, "Contact Person"], [canonical.location, MAX_LEN.location, "City"],
    [canonical.state, MAX_LEN.state, "State"], [canonical.category, MAX_LEN.category, "Category"],
  ];
  for (const [v, max, label] of checks) if (v && v.length > max) return { ok: false, reason: `${label} exceeds ${max} characters` };
  let category = canonical.category || null;
  if (category) category = category.charAt(0).toUpperCase() + category.slice(1).toLowerCase();
  return {
    ok: true,
    lead: {
      name, company, email: email || null, phone, contact: (canonical.contact ?? "").replace(/\s+/g, "") || null,
      location: canonical.location || null, state: canonical.state || null, category, quantity: Number(canonical.quantity) || 0,
      requirements: canonical.requirements ?? "", remarks: canonical.remarks ?? "",
      dataType: DATATYPE_ALIASES[(canonical.datatype ?? "").toLowerCase()] ?? "Other", address: canonical.address || null,
    },
  };
}

export type ReportStatus = "Imported" | "Skipped" | "Duplicate";
export type AnalyzedRow =
  | { rowNumber: number; company: string; status: "Valid"; reason: ""; data: CanonicalRow }
  | { rowNumber: number; company: string; status: "Skipped" | "Duplicate"; reason: string };

export type Analysis = {
  rows: AnalyzedRow[];
  summary: { total: number; valid: number; invalid: number; duplicate: number };
};

/** Validate every row and flag in-file duplicates (phone, then email) in file order, as MERN. */
export function analyzeRows(
  rows: { rowNumber: number; data: CanonicalRow }[],
  existing: { phones?: ReadonlySet<string>; emails?: ReadonlySet<string> } = {},
): Analysis {
  const seenPhones = new Set<string>();
  const seenEmails = new Set<string>();
  const out: AnalyzedRow[] = [];
  let valid = 0, invalid = 0, duplicate = 0;
  for (const { rowNumber, data } of rows) {
    const company = data.company ?? "";
    const v = validateRow(data);
    if (!v.ok) { invalid++; out.push({ rowNumber, company, status: "Skipped", reason: v.reason }); continue; }
    const { phone, email } = v.lead;
    const emailKey = email?.toLowerCase() ?? null;
    let reason: string | null = null;
    if (seenPhones.has(phone)) reason = "Duplicate Mobile Number (in file)";
    else if (emailKey && seenEmails.has(emailKey)) reason = "Duplicate Email (in file)";
    else if (existing.phones?.has(phone)) reason = "Duplicate Mobile Number";
    else if (emailKey && existing.emails?.has(emailKey)) reason = "Duplicate Email";
    if (reason) { duplicate++; out.push({ rowNumber, company, status: "Duplicate", reason }); continue; }
    seenPhones.add(phone);
    if (emailKey) seenEmails.add(emailKey);
    valid++;
    out.push({ rowNumber, company, status: "Valid", reason: "", data });
  }
  return { rows: out, summary: { total: rows.length, valid, invalid, duplicate } };
}
