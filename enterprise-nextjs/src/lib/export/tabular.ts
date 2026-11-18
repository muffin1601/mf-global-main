import ExcelJS from "exceljs";

export type Column<T> = { key: string; header: string; value: (row: T) => unknown; width?: number };

// Neutralise spreadsheet formula injection (=, +, -, @, tab, CR) in text cells.
export const guardFormula = (value: string) => (/^[=+\-@\t\r]/.test(value) ? `'${value}` : value);

function cellText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

const quote = (text: string) => `"${text.replace(/"/g, '""')}"`;

/** RFC 4180 CSV with UTF-8 BOM (for Excel) and formula-injection guard. */
export function toCsv<T>(columns: Column<T>[], rows: Iterable<T>): string {
  const lines = [columns.map((c) => quote(c.header)).join(",")];
  for (const row of rows) {
    lines.push(
      columns
        .map((c) => {
          const v = c.value(row);
          return typeof v === "number" ? String(v) : quote(guardFormula(cellText(v)));
        })
        .join(","),
    );
  }
  return `﻿${lines.join("\r\n")}\r\n`;
}

export async function toXlsx<T>(sheetName: string, columns: Column<T>[], rows: Iterable<T>): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(sheetName.slice(0, 31));
  ws.columns = columns.map((c) => ({ header: c.header, key: c.key, width: c.width ?? Math.max(12, c.header.length + 2) }));
  ws.getRow(1).font = { bold: true };
  ws.views = [{ state: "frozen", ySplit: 1 }];
  for (const row of rows) {
    ws.addRow(
      Object.fromEntries(
        columns.map((c) => {
          const v = c.value(row);
          return [c.key, typeof v === "number" || v instanceof Date ? v : guardFormula(cellText(v))];
        }),
      ),
    );
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}

const noStore = "no-store";
export const csvResponse = (name: string, body: string) =>
  new Response(body, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": noStore } });
export const xlsxResponse = (name: string, body: Buffer) =>
  new Response(new Uint8Array(body), { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": noStore } });
export const pdfResponse = (name: string, body: Buffer) =>
  new Response(new Uint8Array(body), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": noStore } });
