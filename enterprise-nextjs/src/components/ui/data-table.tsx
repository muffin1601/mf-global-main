import Link from "next/link";
import type { Route } from "next";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Columns3, Rows3, Rows4 } from "lucide-react";
import { EmptyRow } from "./empty-state";
import { COLS_SENTINEL, nextSortDir, tableHref, type SearchParamsRecord, type SortDir, type TableState } from "@/lib/table-params";

/**
 * EnterpriseDataTable: a server-rendered table whose state lives in the URL (see lib/table-params.ts).
 * Sorting and paging are always done by the server query, so the browser only ever holds one page.
 * The column picker is a plain GET form, which keeps the table working without client JavaScript.
 *
 * Use from Server Components (column `cell` renderers are functions). For row selection or bulk
 * actions, keep the existing client list views (e.g. components/leads) until a client variant is added.
 */
export type DataColumn<T> = {
  id: string;
  header: string;
  cell: (row: T) => ReactNode;
  /** Server sort key. When set the header becomes a sort link. */
  sortKey?: string;
  /** Direction used the first time this column is sorted (e.g. "desc" for dates and amounts). */
  firstDir?: SortDir;
  align?: "left" | "right";
  /** Required columns cannot be hidden. */
  required?: boolean;
  /** Hidden unless the user turns it on. */
  defaultHidden?: boolean;
  width?: number | string;
};

export type DataTableProps<T> = {
  label: string;
  columns: DataColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  basePath: string;
  /** The page's current search params (all of them, so filters survive sort/paging links). */
  searchParams: SearchParamsRecord;
  state: TableState;
  total: number;
  pages: number;
  pageSizes?: readonly number[];
  empty?: { title: string; description?: ReactNode; icon?: LucideIcon };
  minWidth?: number;
  rowStyle?: React.CSSProperties;
  toolbarStart?: ReactNode;
};

const fmt = (n: number) => n.toLocaleString("en-IN");

export function visibleColumns<T>(columns: DataColumn<T>[], cols: string[] | null) {
  return columns.filter((c) => c.required || (cols ? cols.includes(c.id) : !c.defaultHidden));
}

export function DataTable<T>({
  label, columns, rows, rowKey, basePath, searchParams, state, total, pages, pageSizes = [25, 50, 100], empty, minWidth, rowStyle, toolbarStart,
}: DataTableProps<T>) {
  const shown = visibleColumns(columns, state.cols);
  const hideable = columns.filter((c) => !c.required);
  const href = (o: Record<string, string | string[] | number | undefined>) => tableHref(basePath, searchParams, o) as Route;
  const from = total === 0 ? 0 : (state.page - 1) * state.pageSize + 1;
  const to = Math.min(total, state.page * state.pageSize);
  // Params the column form must carry through (everything except what it sets itself).
  const carried = Object.entries(searchParams).flatMap(([k, v]) =>
    k === "cols" || k === "page" || v === undefined ? [] : (Array.isArray(v) ? v : [v]).map((x, i) => <input key={`${k}-${i}`} type="hidden" name={k} value={x} />));

  return (
    <section className="table-card" data-density={state.density} aria-label={label}>
      <div className="dt-toolbar">
        <div className="dt-toolbar-info">{toolbarStart ?? <span>{total ? `${fmt(from)}–${fmt(to)} of ${fmt(total)}` : "No records"}</span>}</div>
        <div className="dt-toolbar-actions">
          <Link
            className="icon-btn bordered" href={href({ density: state.density === "compact" ? undefined : "compact" })}
            aria-label={state.density === "compact" ? "Comfortable row density" : "Compact row density"} title={state.density === "compact" ? "Comfortable rows" : "Compact rows"}
          >
            {state.density === "compact" ? <Rows3 size={15} /> : <Rows4 size={15} />}
          </Link>
          {hideable.length ? (
            <details className="dt-columns">
              <summary className="button secondary small"><Columns3 size={14} aria-hidden="true" />Columns</summary>
              <form method="get" action={basePath} className="dt-columns-menu">
                {carried}
                <input type="hidden" name="cols" value={COLS_SENTINEL} />
                <span className="menu-label" style={{ padding: "2px 6px" }}>Visible columns</span>
                {hideable.map((c) => (
                  <label key={c.id} className="check-row">
                    <input type="checkbox" name="cols" value={c.id} defaultChecked={shown.includes(c)} />{c.header}
                  </label>
                ))}
                <button type="submit" className="button small">Apply</button>
              </form>
            </details>
          ) : null}
        </div>
      </div>
      <div className="table-scroll">
        <table style={minWidth ? { minWidth } : undefined}>
          <thead>
            <tr>
              {shown.map((c) => {
                const active = c.sortKey && state.sort === c.sortKey;
                const ariaSort = active ? (state.dir === "asc" ? "ascending" : "descending") : undefined;
                const Icon = active ? (state.dir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
                return (
                  <th key={c.id} scope="col" aria-sort={ariaSort} className={c.align === "right" ? "num" : undefined} style={c.width ? { width: c.width } : undefined}>
                    {c.sortKey ? (
                      <Link className="dt-sort" href={href({ sort: c.sortKey, dir: nextSortDir(state, c.sortKey, c.firstDir), page: undefined })}>
                        {c.header}<Icon size={12} aria-hidden="true" />
                        <span className="sr-only">{active ? `, sorted ${ariaSort}. Activate to reverse.` : ", activate to sort."}</span>
                      </Link>
                    ) : c.header}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={rowKey(row)} style={rowStyle}>
                {shown.map((c) => <td key={c.id} className={c.align === "right" ? "num" : undefined}>{c.cell(row)}</td>)}
              </tr>
            ))}
            {rows.length === 0 ? <EmptyRow colSpan={Math.max(shown.length, 1)} title={empty?.title ?? "No records"} description={empty?.description} icon={empty?.icon} /> : null}
          </tbody>
        </table>
      </div>
      <div className="table-foot">
        <span>Page {fmt(state.page)} of {fmt(pages)}</span>
        <div className="pager">
          <span className="segmented" role="group" aria-label="Rows per page">
            {pageSizes.map((n) => (
              <Link key={n} href={href({ size: n, page: undefined })} aria-current={n === state.pageSize ? "page" : undefined} aria-label={`${n} rows per page`}>{n}</Link>
            ))}
          </span>
          {state.page > 1
            ? <Link className="icon-btn bordered" href={href({ page: state.page - 1 })} aria-label="Previous page"><ChevronLeft size={15} /></Link>
            : <span className="icon-btn bordered" aria-hidden="true" style={{ opacity: 0.4 }}><ChevronLeft size={15} /></span>}
          {state.page < pages
            ? <Link className="icon-btn bordered" href={href({ page: state.page + 1 })} aria-label="Next page"><ChevronRight size={15} /></Link>
            : <span className="icon-btn bordered" aria-hidden="true" style={{ opacity: 0.4 }}><ChevronRight size={15} /></span>}
        </div>
      </div>
    </section>
  );
}
