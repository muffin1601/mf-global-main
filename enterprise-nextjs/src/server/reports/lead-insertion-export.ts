import PDFDocument from "pdfkit";
import { toCsv, toXlsx, type Column } from "@/lib/export/tabular";
import type { Actor } from "@/server/actor";
import { badRequest } from "@/server/errors";
import { recordAudit } from "@/server/audit/log";
import { getLeadInsertionExportRows, getLeadInsertionReport, type LeadRow, type ReportResult } from "./lead-insertion";
import { SOURCES, SOURCE_LABELS, SOURCE_SHORT_LABELS, parseFilters, type ReportFilters } from "./lead-insertion-filters";

export const EXPORT_FORMATS = ["csv", "xlsx", "pdf"] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

export const LEAD_COLUMNS: Column<LeadRow>[] = [
  { key: "lead", header: "Lead", value: (r) => [r.name, r.company].filter(Boolean).join(" - "), width: 30 },
  { key: "phone", header: "Phone", value: (r) => r.phone ?? "" },
  { key: "source", header: "Source", value: (r) => SOURCE_LABELS[r.source] ?? r.source },
  { key: "insertedAt", header: "Inserted at (IST)", value: (r) => r.insertedAtIst, width: 22 },
  { key: "statusAtInsertion", header: "Status at insertion", value: (r) => r.statusAtInsertion, width: 20 },
  { key: "currentStatus", header: "Current status", value: (r) => r.currentStatus, width: 18 },
  { key: "assignees", header: "Assignee(s)", value: (r) => r.assignees.join("; "), width: 26 },
  { key: "fileName", header: "File name", value: (r) => r.fileName ?? "", width: 26 },
];

/** Human readable list of the filters actually applied (printed on the PDF). */
export function describeFilters(input: ReportFilters, report: ReportResult): string[] {
  const f = parseFilters(input as Record<string, string | undefined>);
  const lines = [`Date range (IST, inclusive): ${report.range.from} to ${report.range.to} (${f.preset})`, `Grouping: ${f.grouping}`];
  const add = (label: string, v?: string) => { if (v) lines.push(`${label}: ${v}`); };
  add("Employee", f.employee); add("Source", f.source); add("Current status", f.status);
  add("Status at insertion", f.initialStatus); add("Assignment", f.assignment); add("File name", f.fileName);
  add("Import batch", f.importJobId); add("Data type", f.dataType);
  return lines;
}

export function buildPdf(report: ReportResult, filters: string[], generatedAt: Date, viewer: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: 36 });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(16).text("Lead Insertion Report");
    doc.fontSize(9).fillColor("#555").text(`Generated at: ${generatedAt.toISOString()} (UTC) | by ${viewer}`).fillColor("#000").moveDown(0.5);
    doc.fontSize(11).text("Filters used");
    doc.fontSize(9);
    for (const line of filters) doc.text(line);
    doc.moveDown(0.5);
    const s = report.summary;
    doc.fontSize(11).text("Summary");
    doc.fontSize(9).text(`Total leads (distinct): ${s.total}   Manual: ${s.manual}   Imported: ${s.imported}   Assigned: ${s.assigned}   Unassigned: ${s.unassigned}`);
    doc.text(SOURCES.map((k) => `${SOURCE_LABELS[k]}: ${s.bySource[k]}`).join("   "));
    doc.moveDown(0.5).fontSize(11).text("Per-period insertion");

    const cols = ["Period", "Total", "Manual", "Imported", ...SOURCES.map((k) => SOURCE_SHORT_LABELS[k]), "Assigned", "Unassigned"];
    // Source columns share whatever width the fixed columns leave, so the table always fits the page.
    const usable = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const fixed = [90, 45, 50, 55, 55, 60];
    const srcWidth = Math.max(34, Math.floor((usable - fixed.reduce((a, b) => a + b, 0)) / SOURCES.length));
    const widths = [90, 45, 50, 55, ...SOURCES.map(() => srcWidth), 55, 60];
    const row = (cells: (string | number)[], bold = false, height = 13) => {
      if (doc.y > doc.page.height - 60) doc.addPage();
      let x = doc.page.margins.left;
      const y = doc.y;
      doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(8);
      cells.forEach((c, i) => {
        const w = (widths[i] ?? 50) - 4;
        doc.text(String(c), x, y, height > 13 ? { width: w, height, lineBreak: true, ellipsis: true } : { width: w, lineBreak: false, ellipsis: true });
        x += widths[i] ?? 50;
      });
      doc.y = y + height;
    };
    doc.moveDown(0.3);
    row(cols, true, 30);
    if (report.periods.length === 0) doc.font("Helvetica").text("No leads were inserted in this selection.");
    for (const p of report.periods) {
      row([p.label, p.total, p.manual, p.imported, ...SOURCES.map((k) => p.bySource[k]), p.assigned, p.unassigned]);
    }
    row(["TOTAL", s.total, s.manual, s.imported, ...SOURCES.map((k) => s.bySource[k]), s.assigned, s.unassigned], true);
    doc.end();
  });
}

export type ExportResult = { filename: string; contentType: string; body: string | Buffer; rowCount: number };

export async function exportLeadInsertion(actor: Actor, input: ReportFilters, format: string, now: Date = new Date()): Promise<ExportResult> {
  if (!(EXPORT_FORMATS as readonly string[]).includes(format)) throw badRequest("format must be csv, xlsx or pdf.");
  const stamp = now.toISOString().slice(0, 10);
  let result: ExportResult;
  if (format === "pdf") {
    const report = await getLeadInsertionReport(actor, input, now);
    const body = await buildPdf(report, describeFilters(input, report), now, actor.name);
    result = { filename: `lead-insertion-${stamp}.pdf`, contentType: "application/pdf", body, rowCount: report.summary.total };
  } else {
    const rows = await getLeadInsertionExportRows(actor, input, now);
    result = format === "csv"
      ? { filename: `lead-insertion-${stamp}.csv`, contentType: "text/csv; charset=utf-8", body: toCsv(LEAD_COLUMNS, rows), rowCount: rows.length }
      : { filename: `lead-insertion-${stamp}.xlsx`, contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", body: await toXlsx("Leads", LEAD_COLUMNS, rows), rowCount: rows.length };
  }
  // Data exports are audited (Enterprise CRM 2.0 §19): who, format, filters, row count. Never the rows.
  await recordAudit(actor, "report.lead_insertion.exported", { format, rows: result.rowCount, filters: input });
  return result;
}
