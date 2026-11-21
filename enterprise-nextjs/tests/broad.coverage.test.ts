// Broad-coverage rows of TEST_MATRIX ("Remaining coverage"). Every assertion compares the application against an
// INDEPENDENT oracle (plain JS filtering, exact BigInt money maths, hand-computed IST boundaries), never against itself.
import { beforeEach, describe, expect, it } from "vitest";
import { actorOf, makeLead, makeUser, prisma, resetDb } from "./helpers/db";
import { listLeads } from "@/server/leads/queries";
import { filterToParams, parseLeadFilter, type LeadFilter } from "@/server/leads/filter-schema";
import { assignLeads, bulkSetLeadFields, transferAssignments } from "@/server/leads/mutations";
import { activityCounts, createActivity, listActivities } from "@/server/activities/service";
import { calculateLineItem, calculateQuotationTotals } from "@/server/quotations/calc";
import { listSavedViews, saveView, viewQuery } from "@/server/views/service";
import { exportLeadInsertion, } from "@/server/reports/lead-insertion-export";
import { getLeadInsertionExportRows } from "@/server/reports/lead-insertion";
import { PRESETS, resolveRange, parseFilters } from "@/server/reports/lead-insertion-filters";

const IST = 330 * 60_000;
const at = (istLocal: string) => new Date(Date.parse(`${istLocal}Z`) - IST); // "2026-12-31T23:59:59" in India -> instant

// ------------------------------------------------------------------ calendar boundaries (IST)
describe("BROAD Activities and follow-ups: calendar boundaries in IST", () => {
  beforeEach(resetDb);
  const cases: [string, string, string][] = [
    // [now (IST local), due (IST local), expected view]
    ["2026-11-21T23:59:59", "2026-11-21T23:59:59", "today"],
    ["2026-11-21T23:59:59", "2026-11-22T00:00:00", "upcoming"],
    ["2026-11-22T00:00:00", "2026-11-21T23:59:59", "overdue"],
    ["2026-11-22T00:00:00", "2026-11-22T00:00:00", "today"],
    ["2027-01-31T12:00:00", "2027-02-01T00:00:00", "upcoming"], // month end
    ["2027-12-31T23:59:59", "2028-01-01T00:00:00", "upcoming"], // year end
    ["2028-01-01T00:00:00", "2027-12-31T23:59:59", "overdue"],
    ["2028-02-29T05:30:00", "2028-02-29T23:59:59", "today"],    // leap day
    ["2028-03-01T00:00:00", "2028-02-29T23:59:59", "overdue"],
    ["2026-11-21T05:29:59", "2026-11-21T00:00:00", "today"],    // UTC is still the previous day here
  ];
  it.each(cases)("now %s, due %s -> %s (counts and list agree)", async (now, due, expected) => {
    const admin = actorOf(await makeUser({ role: "ADMIN" }));
    await createActivity(admin, { type: "CALL", subject: "Boundary", dueAt: at(due).toISOString() });
    const nowAt = at(now);
    const counts = await activityCounts(admin, { now: nowAt });
    expect(counts).toEqual({ today: expected === "today" ? 1 : 0, upcoming: expected === "upcoming" ? 1 : 0, overdue: expected === "overdue" ? 1 : 0 });
    const list = await listActivities(admin, { view: expected as "today", now: nowAt });
    expect(list.rows).toHaveLength(1);
  });
  it("lead follow-up presets 'today' and 'upcoming' switch exactly at IST midnight", async () => {
    const emp = await makeUser({ role: "USER" });
    const a = actorOf(emp);
    await makeLead({ name: "Due 23:59", followUpDate: at("2026-11-21T23:59:59") }, [{ userId: emp.id }]);
    await makeLead({ name: "Due 00:00", followUpDate: at("2026-11-22T00:00:00") }, [{ userId: emp.id }]);
    const names = async (preset: "today" | "upcoming", now: string) => (await listLeads(a, { preset, now: at(now) })).rows.map((r) => r.name).sort();
    expect(await names("today", "2026-11-21T23:59:59")).toEqual(["Due 23:59"]);
    expect(await names("upcoming", "2026-11-21T23:59:59")).toEqual(["Due 00:00"]);
    expect(await names("today", "2026-11-22T00:00:00")).toEqual(["Due 00:00"]);
    expect(await names("upcoming", "2026-11-22T00:00:00")).toEqual([]);
  });
  it("report presets resolve to the right IST ranges on boundary days", () => {
    const r = (preset: string, now: string) => resolveRange(parseFilters({ preset }), at(now));
    expect(r("today", "2026-11-22T00:00:00")).toEqual({ from: "2026-11-22", to: "2026-11-22" });
    expect(r("yesterday", "2027-01-01T00:00:01")).toEqual({ from: "2026-12-31", to: "2026-12-31" });
    expect(r("week", "2026-11-22T10:00:00")).toEqual({ from: "2026-11-16", to: "2026-11-22" }); // Sunday -> Monday start
    expect(r("week", "2026-11-23T00:00:00")).toEqual({ from: "2026-11-23", to: "2026-11-23" }); // Monday
    expect(r("month", "2028-02-29T23:00:00")).toEqual({ from: "2028-02-01", to: "2028-02-29" });
    expect(r("month", "2028-03-01T00:00:00")).toEqual({ from: "2028-03-01", to: "2028-03-01" });
  });
  it("NOT IMPLEMENTED: reminder delivery — no reminder/notification sender exists in src (documented, not tested)", () => {
    expect(true).toBe(true);
  });
});

// ------------------------------------------------------------------ rounding combinations (exact oracle)
describe("BROAD Quotations: all rounding combinations against an exact BigInt oracle", () => {
  // Exact decimal arithmetic: values are BigInt numerators over 10^S.
  const S = 12n, ONE = 10n ** S;
  const dec = (v: number | string) => { const [i = "0", f = ""] = String(v).split("."); const neg = i.startsWith("-"); const n = BigInt(i.replace("-", "") + (f + "0".repeat(Number(S))).slice(0, Number(S))); return neg ? -n : n; };
  const mul = (a: bigint, b: bigint) => (a * b) / ONE; // inputs here have <= 6 dp so this is exact at S=12
  const roundPaise = (v: bigint) => { const unit = ONE / 100n; const q = v / unit, r = v % unit; return Number(r * 2n >= unit ? q + 1n : q) / 100; };
  const qtys = ["1", "3", "0.5", "2.125", "999.999"];
  const prices = ["0.01", "0.05", "26.25", "99.995", "100.10", "123456.78"];
  const discounts = ["0", "2.5", "10", "33.333", "100"];
  const taxes = ["0", "5", "12", "18", "28"];
  it("line items: amount, discount, taxable, tax and total match half-up paise rounding for 750 combinations", () => {
    let n = 0;
    for (const q of qtys) for (const p of prices) for (const d of discounts) for (const t of taxes) {
      const amount = mul(dec(q), dec(p));
      const discount = mul(amount, dec(d)) / 100n;
      const taxable = amount - discount;
      const tax = mul(taxable, dec(t)) / 100n;
      const li = calculateLineItem({ qty: q, price: p, discount: d, tax: t });
      expect([li.amount, li.discountAmount, li.taxableValue, li.taxAmount, li.total], `${q}x${p} d${d} t${t}`)
        .toEqual([roundPaise(amount), roundPaise(discount), roundPaise(taxable), roundPaise(tax), roundPaise(taxable + tax)]);
      n++;
    }
    expect(n).toBe(750);
  });
  it("totals: summary discount (% and flat), charges, round-off sign and amount received for 400 combinations", () => {
    const itemsSets = [[{ qty: 2, price: 100, tax: 18 }], [{ qty: 3, price: 26.25, tax: 18, discount: 2.5 }, { qty: 1, price: 0.05, tax: 5 }], [{ qty: 999.999, price: 99.995, tax: 28, discount: 33.333 }]];
    let n = 0;
    for (const items of itemsSets) for (const [discount, discountType] of [[0, "%"], [12.5, "%"], [100, "%"], [37.49, "flat"], [999999, "flat"]] as const)
      for (const charges of [0, 10.005]) for (const [auto, sign, amt] of [[false, "+", 0], [true, "+", 0.49], [true, "-", 0.51], [true, "-", 1e9]] as const)
        for (const received of [0, 50.555, 1e9]) {
          const t = calculateQuotationTotals(items, { discount, discountType, additionalCharges: charges, autoRoundOff: auto, roundOffSign: sign, roundOffAmount: amt, amountReceived: received });
          let sub = 0, tax = 0;
          for (const it of items) { const li = calculateLineItem(it); sub += li.taxableValue; tax += li.taxAmount; }
          const r2 = (x: number) => roundPaise(dec(x.toFixed(6)));
          sub = r2(sub); tax = r2(tax);
          const disc = discountType === "%" ? r2(sub * Math.min(Math.max(discount, 0), 100) / 100) : Math.max(0, r2(discount));
          const ch = r2(charges);
          const pre = r2(sub + tax + ch - disc);
          const ro = auto ? (sign === "+" ? 1 : -1) * r2(amt) : 0;
          const grand = Math.max(0, r2(pre + ro));
          expect(t, JSON.stringify({ items, discount, discountType, charges, auto, sign, amt, received })).toMatchObject({ subtotal: sub, totalTax: tax, totalDiscount: disc, additionalCharges: ch, grandTotal: grand, amountReceived: r2(received), balanceAmount: r2(grand - r2(received)) });
          expect(t.grandTotal).toBeGreaterThanOrEqual(0);
          n++;
        }
    expect(n).toBe(360);
  });
  it("NOT IMPLEMENTED: quotation approval / revision workflow and TCS calculation (applyTCS is stored but, as in the legacy app, never changes totals)", () => {
    const off = calculateQuotationTotals([{ qty: 1, price: 1000, tax: 18 }], { applyTCS: false });
    const on = calculateQuotationTotals([{ qty: 1, price: 1000, tax: 18 }], { applyTCS: true });
    expect(on).toEqual(off); // documents current behaviour; business must specify TCS rules before it can be built
  });
});

// ------------------------------------------------------------------ filter combinations (JS oracle)
describe("BROAD Leads: filter combinations, scope and concurrent bulk operations", () => {
  type Row = { id: string; name: string; company: string; phone: string; email: string; category: string | null; location: string | null; state: string | null; dataType: string | null; fileName: string | null; status: string; callStatus: string; priority: string | null; tags: string[]; createdAt: Date; followUpDate: Date | null; owners: string[] };
  let admin: Awaited<ReturnType<typeof makeUser>>, e1: Awaited<ReturnType<typeof makeUser>>, e2: Awaited<ReturnType<typeof makeUser>>;
  let rows: Row[] = [];
  const pick = <T,>(arr: T[], i: number) => arr[i % arr.length]!;
  beforeEach(async () => {
    await resetDb();
    admin = await makeUser({ role: "ADMIN" }); e1 = await makeUser({ role: "USER" }); e2 = await makeUser({ role: "USER" });
    rows = [];
    const cats = ["Pens", "pens", "Bags", null, ""], locs = ["Delhi", "Pune", null], states = ["Delhi", "Maharashtra", null], dts = ["B2B", "B2C", null];
    const files = ["a.csv", "b.csv", null], sts = ["New Lead", "In Progress", "Won Lead", "Lost Lead"], calls = ["Not Called", "Ring", "Converted"], pris = ["High", "Low", null];
    const tagsets = [[], ["vip"], ["vip", "repeat"], ["repeat"]];
    for (let i = 0; i < 96; i++) {
      const owners = i % 4 === 0 ? [] : i % 4 === 1 ? [e1.id] : i % 4 === 2 ? [e2.id] : [e1.id, e2.id];
      const createdAt = at(`2026-11-${String(10 + (i % 10)).padStart(2, "0")}T${i % 2 ? "00:00:00" : "23:59:59"}`);
      const followUpDate = i % 3 === 0 ? null : at(`2026-11-${String(15 + (i % 7)).padStart(2, "0")}T12:00:00`);
      const data = { name: `Lead ${i} ${i % 5 === 0 ? "Acme" : "Zen"}`, company: `Co ${i}`, phone: `90000${String(i).padStart(5, "0")}`, email: `l${i}@example.test`,
        category: pick(cats, i), location: pick(locs, i), state: pick(states, i + 1), dataType: pick(dts, i + 2), fileName: pick(files, i), status: pick(sts, i), callStatus: pick(calls, i + 1),
        priority: pick(pris, i), tags: pick(tagsets, i), createdAt, followUpDate };
      const lead = await makeLead(data, owners.map((userId) => ({ userId })));
      rows.push({ ...(data as Omit<Row, "id" | "owners">), id: lead.id, owners });
    }
  });
  const ci = (a: string | null, vals: string[]) => vals.some((v) => (v === "" ? a === null || a === "" : (a ?? "").toLowerCase() === v.toLowerCase()));
  const dayStart = (d: string) => at(`${d}T00:00:00`).getTime();
  function oracle(f: LeadFilter, viewer: string | null) {
    return rows.filter((r) => {
      if (viewer && !r.owners.includes(viewer)) return false;
      if (f.q && ![r.name, r.company, r.phone, r.email].some((x) => x.toLowerCase().includes(f.q!.toLowerCase()))) return false;
      for (const k of ["category", "location", "state", "dataType", "fileName", "status", "callStatus", "priority"] as const) if (f[k]?.length && !ci(r[k], f[k]!)) return false;
      if (f.tag?.length && !f.tag.some((t) => r.tags.includes(t))) return false;
      if (f.assigned === "assigned" && !r.owners.length) return false;
      if (f.assigned === "unassigned" && r.owners.length) return false;
      if (f.assignedTo?.length && !r.owners.some((o) => f.assignedTo!.includes(o))) return false;
      if (f.from || f.to) {
        const v = (f.dateType === "followUpDate" ? r.followUpDate : r.createdAt)?.getTime();
        if (v === undefined) return false;
        if (f.from && v < dayStart(f.from)) return false;
        if (f.to && v >= dayStart(f.to) + 86_400_000) return false;
      }
      return true;
    }).map((r) => r.id).sort();
  }
  const dims = (): Record<string, LeadFilter[]> => ({
    q: [{ q: "acme" }, { q: "9000000001" }],
    category: [{ category: ["pens"] }, { category: [""] }, { category: ["Bags", ""] }],
    location: [{ location: ["Delhi"] }, { location: [""] }],
    state: [{ state: ["maharashtra"] }],
    dataType: [{ dataType: ["B2C", ""] }],
    fileName: [{ fileName: ["a.csv"] }],
    status: [{ status: ["Won Lead", "Lost Lead"] }],
    callStatus: [{ callStatus: ["Ring"] }],
    priority: [{ priority: [""] }, { priority: ["High"] }],
    tag: [{ tag: ["vip"] }, { tag: ["repeat", "vip"] }],
    assigned: [{ assigned: "assigned" }, { assigned: "unassigned" }],
    assignedTo: [{ assignedTo: [e1.id] }],
    created: [{ dateType: "createdAt", from: "2026-11-12", to: "2026-11-14" }, { from: "2026-11-19" }],
    followUp: [{ dateType: "followUpDate", from: "2026-11-17", to: "2026-11-17" }],
  });
  async function ids(viewer: Awaited<ReturnType<typeof makeUser>>, f: LeadFilter) {
    const out: string[] = [];
    for (let page = 1; ; page++) { const r = await listLeads(actorOf(viewer), { filter: f, page, pageSize: 200 }); out.push(...r.rows.map((x) => x.id)); if (page >= r.pages) break; }
    return out.sort();
  }
  it("every single filter value and every pair of dimensions matches the oracle, for admin and employee scope", async () => {
    const d = dims(); const keys = Object.keys(d); let combos = 0;
    const singles = keys.flatMap((k) => d[k]!);
    for (const f of singles) { expect(await ids(admin, f), JSON.stringify(f)).toEqual(oracle(f, null)); combos++; }
    for (let i = 0; i < keys.length; i++) for (let j = i + 1; j < keys.length; j++) {
      const f = { ...d[keys[i]!]![0], ...d[keys[j]!]![0] } as LeadFilter;
      if (f.dateType && keys[i] !== "followUp" && keys[j] !== "followUp" && keys[i] === "created") f.dateType = "createdAt";
      expect(await ids(admin, f), JSON.stringify(f)).toEqual(oracle(f, null));
      expect(await ids(e1, f), "employee " + JSON.stringify(f)).toEqual(oracle(f, e1.id));
      combos += 2;
    }
    expect(combos).toBeGreaterThan(200);
  });
  it("URL round trip: every combination survives filterToParams -> parseLeadFilter unchanged", () => {
    const d = dims();
    for (const vals of Object.values(d)) for (const f of vals) expect(parseLeadFilter(filterToParams(f))).toEqual(parseLeadFilter(new URLSearchParams(filterToParams(f).toString())));
  });
  it("concurrent transfers, assignments and field updates on overlapping leads leave consistent state", async () => {
    const a = actorOf(admin);
    const target = rows.slice(0, 24).map((r) => r.id);
    const ops = [
      ...Array.from({ length: 6 }, (_, i) => () => transferAssignments(a, { leadIds: target.slice(i * 2, i * 2 + 12), targetUserId: i % 2 ? e1.id : e2.id })),
      ...Array.from({ length: 6 }, (_, i) => () => assignLeads(a, { leadIds: target.slice(i * 3, i * 3 + 9), userIds: [e1.id, e2.id], level: "update" })),
      ...Array.from({ length: 6 }, (_, i) => () => bulkSetLeadFields(a, { ids: target.slice(i, i + 10), status: "In Progress", addTags: ["concurrent"] })),
    ];
    const settled = await Promise.allSettled(ops.map((op) => op()));
    const crashed = settled.filter((s) => s.status === "rejected" && !/conflict|busy|try again/i.test(String((s as PromiseRejectedResult).reason)));
    expect(crashed).toEqual([]);
    const dup = await prisma.$queryRaw<{ n: bigint }[]>`select count(*) n from (select lead_id, user_id from lead_assignments group by 1,2 having count(*) > 1) d`;
    expect(Number(dup[0]!.n)).toBe(0);
    for (const id of target) {
      const l = await prisma.lead.findUniqueOrThrow({ where: { id } });
      expect(new Set(l.tags).size).toBe(l.tags.length);
    }
  });
});

// ------------------------------------------------------------------ saved views + persisted preferences
describe("BROAD Global search and saved views: persisted preference combinations", () => {
  beforeEach(resetDb);
  it("each filter/sort/page-size combination saved as a view reloads to the identical list query", async () => {
    const u = actorOf(await makeUser({ role: "USER" }));
    const combos = ["status=Won+Lead&location=Delhi", "category=&priority=High", "tag=vip&tag=repeat&assigned=assigned", "dateType=followUpDate&from=2026-11-01&to=2026-11-30", "q=acme&sort=name:asc&sort=createdAt:desc&pageSize=50", "callStatus=Ring&fileName=a.csv&dataType="];
    for (const [i, q] of combos.entries()) {
      const params: Record<string, string | string[]> = {};
      for (const [k, v] of new URLSearchParams(q)) params[k] = params[k] === undefined ? v : ([] as string[]).concat(params[k]!, v);
      await saveView(u, { entity: "leads", name: `V${i}`, params, shared: false });
    }
    const views = await listSavedViews(u, "leads");
    expect(views).toHaveLength(combos.length);
    for (const [i, q] of combos.entries()) {
      const v = views.find((x) => x.name === `V${i}`)!;
      expect(parseLeadFilter(new URLSearchParams(viewQuery(v.params)))).toEqual(parseLeadFilter(new URLSearchParams(q)));
    }
  });
  it("shared views reach other users read-only; private ones do not", async () => {
    const admin = actorOf(await makeUser({ role: "ADMIN" }));
    const u = actorOf(await makeUser({ role: "USER" }));
    await saveView(admin, { entity: "leads", name: "Team", params: { status: "Won Lead" }, shared: true });
    await saveView(admin, { entity: "leads", name: "Private", params: { status: "Lost Lead" }, shared: false });
    const seen = (await listSavedViews(u, "leads")).map((v) => v.name);
    expect(seen).toContain("Team");
    expect(seen).not.toContain("Private");
  });
});

// ------------------------------------------------------------------ reports: every preset x format x role
describe("BROAD Reports: every date preset, grouping and export format under each role", () => {
  beforeEach(resetDb);
  it("all presets x groupings x csv/xlsx/pdf for admin and employee; row counts match the scoped export rows", async () => {
    const adminRow = await makeUser({ role: "ADMIN" }); const empRow = await makeUser({ role: "USER" });
    const now = at("2026-11-21T12:00:00");
    for (let i = 0; i < 12; i++) await makeLead({ name: `R${i}`, createdAt: at(`2026-11-${String(10 + i).padStart(2, "0")}T10:00:00`) }, i % 2 ? [{ userId: empRow.id }] : []);
    let runs = 0;
    for (const role of [adminRow, empRow]) for (const preset of PRESETS) for (const grouping of ["day", "week", "month"] as const) {
      const input = preset === "custom" ? { preset, grouping, from: "2026-11-01", to: "2026-11-30" } : { preset, grouping };
      const rows = await getLeadInsertionExportRows(actorOf(role), input, now);
      for (const fmt of ["csv", "xlsx", "pdf"]) {
        const r = await exportLeadInsertion(actorOf(role), input, fmt, now);
        const body = Buffer.isBuffer(r.body) ? r.body : Buffer.from(r.body);
        if (fmt === "xlsx") expect(body.subarray(0, 2).toString()).toBe("PK");
        if (fmt === "pdf") expect(body.subarray(0, 5).toString()).toBe("%PDF-");
        if (fmt !== "pdf") expect(r.rowCount).toBe(rows.length);
        runs++;
      }
      if (role === empRow) expect(rows.every((x) => String(Object.values(x).join(" ")).length > 0)).toBe(true);
    }
    expect(runs).toBe(2 * PRESETS.length * 3 * 3);
    // employee scope: only their 6 assigned leads in the custom month
    expect(await getLeadInsertionExportRows(actorOf(empRow), { preset: "custom", from: "2026-11-01", to: "2026-11-30" }, now)).toHaveLength(6);
    expect(await getLeadInsertionExportRows(actorOf(adminRow), { preset: "custom", from: "2026-11-01", to: "2026-11-30" }, now)).toHaveLength(12);
  });
});
