/**
 * Loading placeholders. They are decorative (aria-hidden), and the wrapper announces "Loading…" once
 * to assistive tech. They use the global `.skeleton` shimmer, which honours prefers-reduced-motion.
 */
export function Skeleton({ width = "100%", height = 12, radius, style }: { width?: number | string; height?: number | string; radius?: number; style?: React.CSSProperties }) {
  return <span className="skeleton" aria-hidden="true" style={{ width, height, ...(radius !== undefined ? { borderRadius: radius } : null), ...style }} />;
}

/** A table-shaped placeholder: header row + `rows` body rows of `columns` cells. */
export function TableSkeleton({ rows = 8, columns = 5, label = "Loading records" }: { rows?: number; columns?: number; label?: string }) {
  return (
    <section className="table-card" role="status" aria-label={label}>
      <span className="sr-only">{label}…</span>
      <div className="table-scroll">
        <table aria-hidden="true">
          <thead><tr>{Array.from({ length: columns }, (_, c) => <th key={c}><Skeleton width={c === 0 ? 120 : 80} height={10} /></th>)}</tr></thead>
          <tbody>
            {Array.from({ length: rows }, (_, r) => (
              <tr key={r}>{Array.from({ length: columns }, (_, c) => <td key={c}><Skeleton width={c === 0 ? "70%" : `${45 + ((r * 7 + c * 13) % 40)}%`} /></td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** KPI-row placeholder matching `.kpis` / MetricCard. */
export function MetricsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="kpis" role="status" aria-label="Loading metrics">
      <span className="sr-only">Loading metrics…</span>
      {Array.from({ length: count }, (_, i) => (
        <div className="kpi" key={i} aria-hidden="true"><Skeleton width="55%" height={10} /><Skeleton width="40%" height={22} style={{ marginTop: 10 }} /></div>
      ))}
    </div>
  );
}

/** Generic page placeholder: header, KPI row and a table. Used by route-level loading.tsx files. */
export function PageSkeleton({ metrics = 0, rows = 8, columns = 5 }: { metrics?: number; rows?: number; columns?: number }) {
  return (
    <main className="page" aria-busy="true">
      <div className="page-head" aria-hidden="true">
        <div><Skeleton width={90} height={10} /><Skeleton width={220} height={20} style={{ marginTop: 8 }} /></div>
      </div>
      {metrics > 0 ? <MetricsSkeleton count={metrics} /> : null}
      <TableSkeleton rows={rows} columns={columns} />
    </main>
  );
}
