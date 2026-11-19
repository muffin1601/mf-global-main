// Shown by Next.js while a CRM page's server data loads. Mirrors the standard page layout.
export default function CrmLoading() {
  return (
    <main className="page" aria-busy="true" aria-label="Loading page">
      <div className="page-head">
        <div style={{ display: "grid", gap: 8 }}>
          <span className="skeleton" style={{ width: 120, height: 12 }} />
          <span className="skeleton" style={{ width: 240, height: 22 }} />
          <span className="skeleton" style={{ width: 320, height: 12 }} />
        </div>
      </div>
      <div className="kpis">
        {[0, 1, 2, 3].map((i) => <div key={i} className="kpi"><span className="skeleton" style={{ width: "50%", height: 12 }} /><span className="skeleton" style={{ width: "35%", height: 24 }} /></div>)}
      </div>
      <section className="table-card">
        <div style={{ padding: 14, borderBottom: "1px solid var(--border)" }}><span className="skeleton" style={{ width: 280, height: 30 }} /></div>
        <div style={{ display: "grid", gap: 14, padding: 16 }}>
          {Array.from({ length: 8 }, (_, i) => <span key={i} className="skeleton" style={{ height: 18, width: `${92 - (i % 3) * 9}%` }} />)}
        </div>
      </section>
    </main>
  );
}
