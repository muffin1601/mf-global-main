/**
 * URL state for server-driven tables (<DataTable>). Everything a user can change about a table
 * (sort, page, page size, visible columns, density) lives in the query string. Tables therefore
 * work without client JavaScript, survive reloads, and can be bookmarked or shared.
 *
 *   sort=<key>&dir=asc|desc&page=<n>&size=<n>&cols=<id>&cols=<id>…&density=compact
 *
 * `cols` lists the visible *hideable* columns. "_" is a sentinel the column picker always submits,
 * so "every optional column unchecked" can be told apart from "no preference" (absent).
 */
export type SearchParamsRecord = Record<string, string | string[] | undefined>;
export type SortDir = "asc" | "desc";
export type Density = "comfortable" | "compact";
export type TableState = { sort: string; dir: SortDir; page: number; pageSize: number; cols: string[] | null; density: Density };

export const COLS_SENTINEL = "_";

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const all = (v: string | string[] | undefined) => (Array.isArray(v) ? v : v === undefined ? [] : [v]);

export function parseTableState(sp: SearchParamsRecord, options: {
  sortKeys: readonly string[]; defaultSort: string; defaultDir?: SortDir; pageSizes?: readonly number[]; defaultPageSize?: number;
}): TableState {
  const pageSizes = options.pageSizes ?? [25, 50, 100];
  const sortRaw = first(sp.sort);
  const sort = options.sortKeys.includes(sortRaw) ? sortRaw : options.defaultSort;
  const dirRaw = first(sp.dir);
  const dir: SortDir = dirRaw === "asc" || dirRaw === "desc" ? dirRaw : (options.defaultDir ?? "desc");
  const sizeRaw = Number.parseInt(first(sp.size), 10);
  const pageSize = pageSizes.includes(sizeRaw) ? sizeRaw : (options.defaultPageSize ?? pageSizes[0] ?? 25);
  const pageRaw = Number.parseInt(first(sp.page), 10);
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.min(pageRaw, 100_000) : 1;
  const colValues = all(sp.cols).flatMap((v) => v.split(",")).map((v) => v.trim()).filter(Boolean);
  const cols = colValues.length ? colValues.filter((c) => c !== COLS_SENTINEL) : null;
  const density: Density = first(sp.density) === "compact" ? "compact" : "comfortable";
  return { sort, dir, page, pageSize, cols, density };
}

/** Build a URL for `basePath` from the current params plus overrides (undefined/"" removes a key). */
export function tableHref(basePath: string, current: SearchParamsRecord, overrides: Record<string, string | string[] | number | undefined>): string {
  const params = new URLSearchParams();
  const merged: Record<string, string | string[] | number | undefined> = { ...current, ...overrides };
  for (const [key, value] of Object.entries(merged)) {
    if (value === undefined || value === "") continue;
    for (const v of Array.isArray(value) ? value : [value]) params.append(key, String(v));
  }
  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

/** Next direction when a sortable header is clicked: same column flips, a new column starts at its default. */
export const nextSortDir = (state: Pick<TableState, "sort" | "dir">, key: string, firstDir: SortDir = "asc"): SortDir =>
  state.sort === key ? (state.dir === "asc" ? "desc" : "asc") : firstDir;
