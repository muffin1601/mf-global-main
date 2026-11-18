import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { getCatalogStats } from "@/server/catalog/stats";
import styles from "../product-management/catalog.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Product dashboard" };

function Bars({ rows }: { rows: { label: string; count: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  if (rows.length === 0) return <p className={styles.muted}>No data yet.</p>;
  return (
    <div>
      {rows.map((r) => (
        <div key={r.label} className={styles.barRow}>
          <span>{r.label}</span>
          <div className={styles.bar} role="img" aria-label={`${r.label}: ${r.count}`}><span style={{ width: `${(r.count / max) * 100}%` }} /></div>
          <strong>{r.count}</strong>
        </div>
      ))}
    </div>
  );
}

export default async function ProductDashboardPage() {
  const user = await requireUser();
  const stats = await getCatalogStats({ id: user.id, role: user.role, name: user.name, userId: user.userId, email: user.email });
  const status = stats.productsByStatus;
  return (
    <main className="page">
      <div className="page-head">
        <div>
          <div className="eyebrow">Catalogue</div>
          <h1>Product dashboard</h1>
        </div>
      </div>
      <section className="kpis">
        <div className="kpi"><span>Total products</span><strong>{stats.totalProducts}</strong></div>
        <div className="kpi"><span>Total vendors</span><strong>{stats.totalVendors}</strong></div>
        <div className="kpi"><span>Active products</span><strong>{status.ACTIVE}</strong></div>
        <div className="kpi"><span>Archived products</span><strong>{status.ARCHIVED}</strong></div>
      </section>
      <div className={styles.dashGrid}>
        <section className="card">
          <h3>Products by category</h3>
          <Bars rows={stats.productsByCategory.map((r) => ({ label: r.category, count: r.count }))} />
        </section>
        <section className="card">
          <h3>Products by status</h3>
          <Bars rows={[{ label: "Active", count: status.ACTIVE }, { label: "Inactive", count: status.INACTIVE }, { label: "Archived", count: status.ARCHIVED }]} />
        </section>
      </div>
    </main>
  );
}
