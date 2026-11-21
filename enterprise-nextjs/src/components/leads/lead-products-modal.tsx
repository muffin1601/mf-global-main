"use client";

import { useState } from "react";
import { ArrowLeft, ImageOff, Search } from "lucide-react";
import styles from "./leads.module.css";
import { Modal } from "./modal";

type Money = number | string | null | undefined;
type Product = {
  id: string; code: string | null; secondaryCode?: string | null; name: string; type: string | null; color: string | null; dimension: string | null;
  description?: string | null; hsnCode?: string | null; imagePath?: string | null;
  gstRate: number | string | null; category: { id: string; code: string; name: string } | null;
  price?: { basicAmount?: Money; netAmount?: Money; sales5To50?: Money; sales50To100?: Money; sales100Above?: Money } | null;
};

const dash = (v: Money) => (v === null || v === undefined || v === "" ? "—" : String(v));

/* eslint-disable @next/next/no-img-element -- catalogue images are stored as public storage URLs */
function Thumb({ p }: { p: Product }) {
  return p.imagePath
    ? <img className={styles.productThumb} src={p.imagePath} alt="" loading="lazy" />
    : <span className={styles.productThumbEmpty} aria-hidden="true"><ImageOff size={15} /></span>;
}

function ProductDetail({ p, onBack }: { p: Product; onBack: () => void }) {
  const rows: [string, Money][] = [
    ["Code", p.code], ["Secondary code", p.secondaryCode], ["Category", p.category?.name], ["Type", p.type],
    ["Colour", p.color], ["Dimension", p.dimension], ["HSN code", p.hsnCode], ["GST %", p.gstRate],
    ["Basic price", p.price?.basicAmount], ["Net price", p.price?.netAmount],
    ["Price (5–50 pcs)", p.price?.sales5To50], ["Price (50–100 pcs)", p.price?.sales50To100], ["Price (100+ pcs)", p.price?.sales100Above],
  ];
  return (
    <div>
      <button type="button" className="button secondary" onClick={onBack} style={{ marginBottom: 14 }}><ArrowLeft size={15} aria-hidden="true" /> Back to results</button>
      <div className={styles.productDetail}>
        {p.imagePath
          ? <a href={p.imagePath} target="_blank" rel="noreferrer" title="Open full-size image"><img className={styles.productImage} src={p.imagePath} alt={p.name} /></a>
          : <div className={styles.productImageEmpty}><ImageOff size={28} aria-hidden="true" /><span>No image</span></div>}
        <div>
          <h3 style={{ margin: "0 0 6px" }}>{p.name}</h3>
          {p.description ? <p className={styles.muted} style={{ margin: "0 0 12px", whiteSpace: "pre-line" }}>{p.description}</p> : null}
          <dl className={styles.productFacts}>
            {rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{dash(v)}</dd></div>)}
          </dl>
        </div>
      </div>
    </div>
  );
}
/* eslint-enable @next/next/no-img-element */

/** Product lookup for quoting from the lead page (GET /api/products/search?query=). */
export function ProductsModal({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [products, setProducts] = useState<Product[] | null>(null);
  const [selected, setSelected] = useState<Product | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const search = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setBusy(true); setError(null); setSelected(null);
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
    <Modal title="Search products" description="Look up catalogue items, prices and GST while talking to a lead. Click a product for its photo and full details." onClose={onClose} wide footer={<button type="button" className="button secondary" onClick={onClose}>Close</button>}>
      <form onSubmit={search} className="toolbar" style={{ marginBottom: 14 }} role="search">
        <div className="search-input"><Search size={15} aria-hidden="true" /><input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Product name, code, colour…" aria-label="Product search" /></div>
        <button className="button" type="submit" disabled={busy || !query.trim()}>{busy ? "Searching…" : "Search"}</button>
      </form>
      {error ? <p className="error">{error}</p> : null}
      {selected ? <ProductDetail p={selected} onBack={() => setSelected(null)} /> : (
        <>
          {products && products.length === 0 ? <p className={styles.muted}>No products found.</p> : null}
          {products && products.length > 0 ? (
            <div className={styles.tableScroll}>
              <table className={styles.miniTable} style={{ minWidth: 820 }}>
                <thead><tr><th><span className="sr-only">Image</span></th><th>Code</th><th>Name</th><th>Type</th><th>Colour</th><th>Dimension</th><th>GST %</th><th>Category</th><th>Net price</th></tr></thead>
                <tbody>
                  {products.map((p) => (
                    <tr key={p.id} className={styles.clickableRow} tabIndex={0} aria-label={`View details for ${p.name}`}
                      onClick={() => setSelected(p)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelected(p); } }}>
                      <td><Thumb p={p} /></td>
                      <td>{p.code ?? "—"}</td><td>{p.name}</td><td>{p.type ?? "—"}</td><td>{p.color ?? "—"}</td><td>{p.dimension ?? "—"}</td>
                      <td>{dash(p.gstRate)}</td><td>{p.category?.name ?? "—"}</td><td>{dash(p.price?.netAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </>
      )}
    </Modal>
  );
}
