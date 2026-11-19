import type { Metadata } from "next";
import Link from "next/link";
import { Archive, CircleCheck, CirclePause, Package, Truck } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getCatalogStats } from "@/server/catalog/stats";
import { MetricCard } from "@/components/ui/metric-card";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import styles from "../product-management/catalog.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Product dashboard" };

/** Labelled horizontal bars: exact counts are always printed, bar length is relative to the largest row. */
function Bars({ rows, color = "var(--chart-1)" }: { rows: { label: string; count: number }[]; color?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  if (rows.length === 0) return <EmptyState title="No data yet" description="Counts appear once products exist." icon={Package} />;
  return (
    <div role="list">
      {rows.map((r) => (
        <div key={r.label} className={styles.barRow} role="listitem">
          <span>{r.label}</span>
          <div className={styles.bar} aria-hidden="true"><span style={{ width: `${(r.count / max) * 100}%`, background: color }} /></div>
          <strong>{r.count.toLocaleString("en-IN")}</strong>
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
      <PageHeader
        title="Product dashboard"
        description="Catalogue composition across categories and lifecycle status."
        actions={<Link className="button secondary" href="/crm/product-management">Open products</Link>}
      />
      <section className="kpis" aria-label="Catalogue totals">
        <MetricCard label="Total products" value={stats.totalProducts.toLocaleString("en-IN")} icon={Package} href="/crm/product-management?status=all" />
        <MetricCard label="Active" value={status.ACTIVE.toLocaleString("en-IN")} icon={CircleCheck} tone="success" href="/crm/product-management" />
        <MetricCard label="Inactive" value={status.INACTIVE.toLocaleString("en-IN")} icon={CirclePause} tone="warning" href="/crm/product-management?status=inactive" />
        <MetricCard label="Archived" value={status.ARCHIVED.toLocaleString("en-IN")} icon={Archive} tone="neutral" href="/crm/product-management?status=archived" />
        <MetricCard label="Vendors" value={stats.totalVendors.toLocaleString("en-IN")} icon={Truck} tone="violet" href="/crm/vendors" hint="Excludes archived vendors" />
      </section>
      <div className={styles.dashGrid}>
        <section className="card">
          <h3 className="card-title">Products by category</h3>
          <p className="card-desc">Active and inactive products (archived excluded).</p>
          <Bars rows={stats.productsByCategory.map((r) => ({ label: r.category, count: r.count }))} />
        </section>
        <section className="card">
          <h3 className="card-title">Products by status</h3>
          <p className="card-desc">Every product, including archived.</p>
          <Bars color="var(--chart-2)" rows={[{ label: "Active", count: status.ACTIVE }, { label: "Inactive", count: status.INACTIVE }, { label: "Archived", count: status.ARCHIVED }]} />
        </section>
      </div>
    </main>
  );
}
