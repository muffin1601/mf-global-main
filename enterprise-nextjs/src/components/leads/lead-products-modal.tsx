"use client";

import { useState } from "react";
import styles from "./leads.module.css";
import { Modal } from "./modal";

type Product = {
  id: string; code: string | null; name: string; type: string | null; color: string | null; dimension: string | null;
  gstRate: number | string | null; category: string | null; price?: { purchasePrice?: number | string; basicAmount?: number | string; netAmount?: number | string } | null;
};

/** Product lookup for quoting from the lead page (GET /api/products/search?query=). */
export function ProductsModal({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [products, setProducts] = useState<Product[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const search = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setBusy(true); setError(null);
    try {
      const res = await fetch(`/api/products/search?query=${encodeURIComponent(query.trim())}`, { cache: "no-store" });
      if (!res.ok) throw new Error(res.status === 404 ? "Product search is not available yet." : "Product search failed.");
      const body = (await res.json()) as { products?: Product[] };
      setProducts(body.products ?? []);
    } catch (err) {
      setProducts(null);
      setError(err instanceof Error ? err.message : "Product search failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Search products" onClose={onClose} wide footer={<button type="button" className="button secondary" onClick={onClose}>Close</button>}>
      <form onSubmit={search} className={styles.search} style={{ marginBottom: "1rem" }}>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Product name, code, colour…" aria-label="Product search" autoFocus />
        <button className="button" type="submit" disabled={busy || !query.trim()}>{busy ? "Searching…" : "Search"}</button>
      </form>
      {error ? <p className="error">{error}</p> : null}
      {products && products.length === 0 ? <p className={styles.muted}>No products found.</p> : null}
      {products && products.length > 0 ? (
        <div className={styles.tableScroll}>
          <table className={styles.miniTable}>
            <thead><tr><th>Code</th><th>Name</th><th>Type</th><th>Colour</th><th>Dimension</th><th>GST %</th><th>Category</th><th>Net price</th></tr></thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id}>
                  <td>{p.code ?? "—"}</td><td>{p.name}</td><td>{p.type ?? "—"}</td><td>{p.color ?? "—"}</td><td>{p.dimension ?? "—"}</td>
                  <td>{p.gstRate ?? "—"}</td><td>{p.category ?? "—"}</td><td>{p.price?.netAmount ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </Modal>
  );
}
