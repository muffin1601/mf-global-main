import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma/client";
import { addDaysIst, isDateString, istMonthStart, istRange, istWeekStart } from "@/lib/time/ist";
import { isAdmin, type Actor } from "@/server/actor";
import { badRequest } from "@/server/errors";
import {
  ANY_IMPORTED, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, SOURCES, UNASSIGNED, UNKNOWN_STATUS,
  parseFilters, resolveRange, type ParsedFilters, type ReportFilters, type SourceKey,
} from "./lead-insertion-filters";

/*
 * Lead Insertion Report.
 *
 * Business date = Asia/Kolkata calendar date of `leads.created_at` (UTC storage).
 * It is NOT the import run time, assignment time, follow-up or conversion date.
 * `created_at` is `timestamp without time zone` holding UTC, hence the double
 * AT TIME ZONE below (first interpret as UTC, then render in IST).
 *
 * Access: ADMIN sees every lead. A USER gets the SCOPED view (never a 403): every
 * aggregate, drill-down and export is limited to leads assigned to them
 * (same predicate as `leadScope`), and the per-employee table shows only them.
 *
 * Counting rules: "Total" counts DISTINCT leads. A lead with several assignees
 * appears once in each assignee's row of the per-employee table, so the sum of
 * per-employee counts (+ unassigned) can exceed the distinct total; the report
 * returns both numbers explicitly. "Imported" = every non-MANUAL source
 * (file import, IndiaMART, TradeIndia, Coachingpromo, Printkee, Webhook, Legacy).
 */
const IST_TS = Prisma.sql`(l.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')`;

export type PeriodRow = {
  period: string; label: string; total: number; manual: number; imported: number;
  bySource: Record<SourceKey, number>; assigned: number; unassigned: number;
};
export type EmployeeRow = { userId: string | null; name: string; leads: number };
export type ReportResult = {
  range: { from: string; to: string };
  grouping: ParsedFilters["grouping"];
  summary: {
    total: number; manual: number; imported: number; bySource: Record<SourceKey, number>;
    assigned: number; unassigned: number;
    /** Sum of the per-employee rows (a lead with N assignees counts N times). */
    employeeAssignmentTotal: number;
  };
  periods: PeriodRow[];
  employees: EmployeeRow[];
  employeeNote: string;
};
export type LeadRow = {
  id: string; name: string | null; company: string | null; phone: string | null; source: SourceKey;
  insertedAtIst: string; statusAtInsertion: string; currentStatus: string; assignees: string[]; fileName: string | null;
};
export type LeadPage = { rows: LeadRow[]; total: number; page: number; pageSize: number; pageCount: number };

const EMPLOYEE_NOTE =
  "A lead assigned to several employees is counted once for each assignee here, while the summary total counts each lead once.";

type Bounds = { from: string; to: string };

function where(actor: Actor, f: ParsedFilters, bounds: Bounds): Prisma.Sql {
  const { gte, lt } = istRange(bounds.from, bounds.to);
  const c: Prisma.Sql[] = [Prisma.sql`l.created_at >= ${gte} AND l.created_at < ${lt}`];
  if (!isAdmin(actor)) {
    c.push(Prisma.sql`EXISTS (SELECT 1 FROM lead_assignments sa WHERE sa.lead_id = l.id AND sa.user_id = ${actor.id}::uuid AND sa.can_view)`);
  }
  if (f.employee === UNASSIGNED) c.push(Prisma.sql`NOT EXISTS (SELECT 1 FROM lead_assignments ea WHERE ea.lead_id = l.id)`);
  else if (f.employee) {
    if (!/^[0-9a-f-]{36}$/i.test(f.employee)) throw badRequest("Invalid employee filter.");
    c.push(Prisma.sql`EXISTS (SELECT 1 FROM lead_assignments ea WHERE ea.lead_id = l.id AND ea.user_id = ${f.employee}::uuid)`);
  }
  if (f.source === ANY_IMPORTED) c.push(Prisma.sql`l.source <> 'MANUAL'`);
  else if (f.source) c.push(Prisma.sql`l.source = ${f.source}::"LeadSource"`);
  if (f.status) c.push(Prisma.sql`l.status = ${f.status}`);
  if (f.initialStatus === UNKNOWN_STATUS) c.push(Prisma.sql`l.initial_status IS NULL`);
  else if (f.initialStatus) c.push(Prisma.sql`l.initial_status = ${f.initialStatus}`);
  if (f.assignment === "assigned") c.push(Prisma.sql`EXISTS (SELECT 1 FROM lead_assignments aa WHERE aa.lead_id = l.id)`);
  if (f.assignment === "unassigned") c.push(Prisma.sql`NOT EXISTS (SELECT 1 FROM lead_assignments aa WHERE aa.lead_id = l.id)`);
  if (f.fileName) c.push(Prisma.sql`l.file_name = ${f.fileName}`);
  if (f.importJobId) c.push(Prisma.sql`l.import_job_id = ${f.importJobId}::uuid`);
  if (f.dataType) c.push(Prisma.sql`l.data_type = ${f.dataType}`);
  return Prisma.join(c, " AND ");
}

const num = (v: unknown) => Number(v ?? 0);
const emptySources = () => Object.fromEntries(SOURCES.map((s) => [s, 0])) as Record<SourceKey, number>;

// SOURCES is a compile-time constant (never user input).
const sourceColumns = Prisma.raw(
  SOURCES.map((s) => `count(*) FILTER (WHERE l.source = '${s}')::int AS "s_${s}"`).join(", "),
);

function periodLabel(period: string, grouping: ParsedFilters["grouping"]) {
  if (grouping === "day") return period;
  if (grouping === "week") return `Week of ${period}`;
  return period.slice(0, 7);
}

/** Inclusive IST date bounds of a period key. */
export function periodBounds(period: string, grouping: ParsedFilters["grouping"]): Bounds {
  if (!isDateString(period)) throw badRequest("Invalid period.");
  if (grouping === "day") return { from: period, to: period };
  if (grouping === "week") {
    const from = istWeekStart(period);
    return { from, to: addDaysIst(from, 6) };
  }
  const from = istMonthStart(period);
  const y = Number(from.slice(0, 4)), m = Number(from.slice(5, 7));
  return { from, to: new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10) };
}

const norm = (f: ReportFilters | ParsedFilters) => parseFilters(f as Record<string, string | undefined>);

export async function getLeadInsertionReport(actor: Actor, input: ReportFilters, now: Date = new Date()): Promise<ReportResult> {
  const f = norm(input);
  const range = resolveRange(f, now);
  const w = where(actor, f, range);
  const trunc = Prisma.raw(`'${f.grouping}'`); // grouping is zod-validated: day | week | month

  const periodRows = await prisma.$queryRaw<Record<string, unknown>[]>`
    SELECT to_char(date_trunc(${trunc}, ${IST_TS}), 'YYYY-MM-DD') AS period,
           count(*)::int AS total,
           ${sourceColumns},
           count(*) FILTER (WHERE EXISTS (SELECT 1 FROM lead_assignments x WHERE x.lead_id = l.id))::int AS assigned
    FROM leads l WHERE ${w}
    GROUP BY 1 ORDER BY 1`;

  const admin = isAdmin(actor);
  const employeeRows = await prisma.$queryRaw<{ user_id: string | null; name: string; leads: number }[]>`
    SELECT a.user_id::text AS user_id, u.name AS name, count(*)::int AS leads
    FROM leads l JOIN lead_assignments a ON a.lead_id = l.id JOIN users u ON u.id = a.user_id
    WHERE ${w} ${admin ? Prisma.empty : Prisma.sql`AND a.user_id = ${actor.id}::uuid`}
    GROUP BY a.user_id, u.name
    UNION ALL
    SELECT NULL::text, 'Unassigned', count(*)::int FROM leads l
    WHERE ${w} AND ${admin ? Prisma.sql`NOT EXISTS (SELECT 1 FROM lead_assignments x WHERE x.lead_id = l.id)` : Prisma.sql`false`}
    HAVING count(*) > 0
    ORDER BY leads DESC, name ASC`;

  const periods: PeriodRow[] = periodRows.map((r) => {
    const bySource = emptySources();
    for (const s of SOURCES) bySource[s] = num(r[`s_${s}`]);
    const total = num(r.total);
    const manual = bySource.MANUAL;
    const assigned = num(r.assigned);
    const period = String(r.period);
    return { period, label: periodLabel(period, f.grouping), total, manual, imported: total - manual, bySource, assigned, unassigned: total - assigned };
  });

  const summary: ReportResult["summary"] = {
    total: 0, manual: 0, imported: 0, bySource: emptySources(), assigned: 0, unassigned: 0, employeeAssignmentTotal: 0,
  };
  for (const p of periods) {
    summary.total += p.total; summary.manual += p.manual; summary.imported += p.imported;
    summary.assigned += p.assigned; summary.unassigned += p.unassigned;
    for (const s of SOURCES) summary.bySource[s] += p.bySource[s];
  }
  const employees = employeeRows.map((e) => ({ userId: e.user_id, name: e.name, leads: num(e.leads) }));
  summary.employeeAssignmentTotal = employees.reduce((n, e) => n + e.leads, 0);

  return { range, grouping: f.grouping, summary, periods, employees, employeeNote: EMPLOYEE_NOTE };
}

const LEAD_SELECT = Prisma.sql`
  l.id::text AS id, l.name, l.company, l.phone, l.source::text AS source,
  to_char(${IST_TS}, 'YYYY-MM-DD HH24:MI:SS') AS inserted_at_ist,
  coalesce(l.initial_status, ${UNKNOWN_STATUS}) AS status_at_insertion,
  l.status AS current_status, l.file_name,
  coalesce((SELECT array_agg(u.name ORDER BY u.name) FROM lead_assignments a JOIN users u ON u.id = a.user_id WHERE a.lead_id = l.id), '{}') AS assignees`;

type RawLead = {
  id: string; name: string | null; company: string | null; phone: string | null; source: SourceKey;
  inserted_at_ist: string; status_at_insertion: string; current_status: string; file_name: string | null; assignees: string[];
};
const toLeadRow = (r: RawLead): LeadRow => ({
  id: r.id, name: r.name, company: r.company, phone: r.phone, source: r.source, insertedAtIst: r.inserted_at_ist,
  statusAtInsertion: r.status_at_insertion, currentStatus: r.current_status, assignees: r.assignees, fileName: r.file_name,
});

/** Drill-down: the leads behind a period (or the whole filtered range when `period` is omitted). */
export async function getLeadInsertionLeads(
  actor: Actor,
  input: ReportFilters,
  opts: { period?: string; page?: number; pageSize?: number } = {},
  now: Date = new Date(),
): Promise<LeadPage> {
  const f = norm(input);
  let bounds = resolveRange(f, now);
  if (opts.period) {
    const p = periodBounds(opts.period, f.grouping);
    bounds = { from: p.from > bounds.from ? p.from : bounds.from, to: p.to < bounds.to ? p.to : bounds.to };
  }
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(opts.pageSize ?? DEFAULT_PAGE_SIZE)));
  const page = Math.max(1, Math.floor(opts.page ?? 1));
  if (bounds.from > bounds.to) return { rows: [], total: 0, page, pageSize, pageCount: 0 };
  const w = where(actor, f, bounds);
  const countRows = await prisma.$queryRaw<{ n: number }[]>`SELECT count(*)::int AS n FROM leads l WHERE ${w}`;
  const n = countRows[0]?.n ?? 0;
  const rows = await prisma.$queryRaw<RawLead[]>`
    SELECT ${LEAD_SELECT} FROM leads l WHERE ${w}
    ORDER BY l.created_at DESC, l.id DESC LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`;
  return { rows: rows.map(toLeadRow), total: num(n), page, pageSize, pageCount: Math.ceil(num(n) / pageSize) };
}

export const EXPORT_ROW_LIMIT = 100_000;

/** Every lead matching the filters (the exact set behind the summary total), newest first. */
export async function getLeadInsertionExportRows(actor: Actor, input: ReportFilters, now: Date = new Date()): Promise<LeadRow[]> {
  const f = norm(input);
  const w = where(actor, f, resolveRange(f, now));
  const rows = await prisma.$queryRaw<RawLead[]>`
    SELECT ${LEAD_SELECT} FROM leads l WHERE ${w}
    ORDER BY l.created_at DESC, l.id DESC LIMIT ${EXPORT_ROW_LIMIT + 1}`;
  if (rows.length > EXPORT_ROW_LIMIT) throw badRequest(`Too many leads to export (limit ${EXPORT_ROW_LIMIT}). Narrow the date range.`);
  return rows.map(toLeadRow);
}

export type FilterOptions = {
  employees: { id: string; name: string }[];
  statuses: string[]; initialStatuses: string[]; dataTypes: string[];
  files: string[]; importJobs: { id: string; fileName: string | null }[];
};

/** Dropdown values, limited to what the actor may see. */
export async function getLeadInsertionFilterOptions(actor: Actor): Promise<FilterOptions> {
  const scope = isAdmin(actor)
    ? Prisma.sql`true`
    : Prisma.sql`EXISTS (SELECT 1 FROM lead_assignments sa WHERE sa.lead_id = l.id AND sa.user_id = ${actor.id}::uuid AND sa.can_view)`;
  const [employees, statuses, initial, dataTypes, files, jobs] = await Promise.all([
    isAdmin(actor)
      ? prisma.user.findMany({ where: { enabled: true }, select: { id: true, name: true }, orderBy: { name: "asc" } })
      : Promise.resolve([{ id: actor.id, name: actor.name }]),
    prisma.$queryRaw<{ v: string }[]>`SELECT DISTINCT l.status AS v FROM leads l WHERE ${scope} ORDER BY 1 LIMIT 200`,
    prisma.$queryRaw<{ v: string }[]>`SELECT DISTINCT l.initial_status AS v FROM leads l WHERE ${scope} AND l.initial_status IS NOT NULL ORDER BY 1 LIMIT 200`,
    prisma.$queryRaw<{ v: string }[]>`SELECT DISTINCT l.data_type AS v FROM leads l WHERE ${scope} AND l.data_type IS NOT NULL ORDER BY 1 LIMIT 200`,
    prisma.$queryRaw<{ v: string }[]>`SELECT DISTINCT l.file_name AS v FROM leads l WHERE ${scope} AND l.file_name IS NOT NULL ORDER BY 1 LIMIT 500`,
    prisma.$queryRaw<{ id: string; file_name: string | null }[]>`
      SELECT DISTINCT l.import_job_id::text AS id, j.file_name FROM leads l JOIN lead_import_jobs j ON j.id = l.import_job_id
      WHERE ${scope} ORDER BY 2 LIMIT 500`,
  ]);
  return {
    employees, statuses: statuses.map((r) => r.v), initialStatuses: initial.map((r) => r.v), dataTypes: dataTypes.map((r) => r.v),
    files: files.map((r) => r.v), importJobs: jobs.map((j) => ({ id: j.id, fileName: j.file_name })),
  };
}

/** EXPLAIN of the aggregate query (used by the performance test to prove index use). */
export async function explainLeadInsertionAggregate(actor: Actor, input: ReportFilters, now: Date = new Date()): Promise<string> {
  const f = norm(input);
  const w = where(actor, f, resolveRange(f, now));
  const rows = await prisma.$queryRaw<{ "QUERY PLAN": string }[]>`
    EXPLAIN SELECT date_trunc('day', ${IST_TS}), count(*) FROM leads l WHERE ${w} GROUP BY 1`;
  return rows.map((r) => r["QUERY PLAN"]).join("\n");
}
