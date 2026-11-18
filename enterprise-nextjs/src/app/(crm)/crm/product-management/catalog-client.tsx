/* eslint-disable @next/next/no-img-element -- product photos are arbitrary public-bucket URLs */
"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { CategoryRow } from "@/server/catalog/categories";
import type { ProductView } from "@/server/catalog/products";
import { CategoriesModal } from "./categories-modal";
import styles from "./catalog.module.css";
import { ProductFormModal } from "./product-form-modal";

type Filters = { query: string; categoryId: string; status: string; sort: string; limit: number };
type Props = {
  isAdmin: boolean;
  products: ProductView[];
  categories: CategoryRow[];
  total: number;
  page: number;
  pages: number;
  filters: Filters;
};

const money = (n: number | null | undefined) => (n == null ? "—" : n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const statusLabel = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();

export function CatalogClient({ isAdmin, products, categories, total, page, pages, filters }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState(filters.query);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [modal, setModal] = useState<null | "add" | "edit" | "categories">(null);
  const selected = products.find((p) => p.id === selectedId) ?? null;

  const go = (next: Partial<Record<string, string | number>>) => {
    const merged: Record<string, string> = {
      query: filters.query, category: filters.categoryId, status: filters.status, sort: filters.sort, limit: String(filters.limit), page: String(page),
    };
    for (const [k, v] of Object.entries(next)) merged[k] = String(v);
    if (!("page" in next)) merged.page = "1";
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(merged)) if (v && !(k === "page" && v === "1")) params.set(k, v);
    startTransition(() => router.push((`/crm/product-management${params.size ? `?${params}` : ""}`) as never));
  };
  const refresh = () => startTransition(() => router.refresh());

  async function archive(product: ProductView) {
    if (!window.confirm(`Archive "${product.name ?? product.code}"? It will be hidden from active lists and quotation search.`)) return;
    const res = await fetch(`/api/products/${product.id}`, { method: "DELETE" });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return void toast.error(body.error ?? "Could not archive the product.");
    toast.success("Product archived.");
    setSelectedId(null);
    refresh();
  }

  const from = total === 0 ? 0 : (page - 1) * filters.limit + 1;
  const to = Math.min(page * filters.limit, total);

  return (
    <>
      <form
        className={styles.toolbar}
        onSubmit={(e) => { e.preventDefault(); go({ query: query.trim() }); }}
      >
        <div className={`field ${styles.grow}`}>
          <label htmlFor="pm-search">Search</label>
          <input id="pm-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Code, name, style code, type, colour, dimension, GST, category" />
        </div>
        <div className="field">
          <label htmlFor="pm-category">Category</label>
          <select id="pm-category" value={filters.categoryId} onChange={(e) => go({ category: e.target.value })}>
            <option value="">All categories</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="pm-status">Status</label>
          <select id="pm-status" value={filters.status} onChange={(e) => go({ status: e.target.value })}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="archived">Archived</option>
            <option value="all">All</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="pm-sort">Sort by</label>
          <select id="pm-sort" value={filters.sort} onChange={(e) => go({ sort: e.target.value })}>
            <option value="updated_desc">Recently updated</option>
            <option value="created_desc">Newest first</option>
            <option value="created_asc">Oldest first</option>
            <option value="name_asc">Name A–Z</option>
            <option value="name_desc">Name Z–A</option>
            <option value="price_asc">Price low to high</option>
            <option value="price_desc">Price high to low</option>
          </select>
        </div>
        <div className={styles.actions}>
          <button type="submit" className="button">Search</button>
          <button type="button" className="button secondary" onClick={() => { setQuery(""); setSelectedId(null); startTransition(() => router.push("/crm/product-management")); }}>Reset</button>
          <button type="button" className="button secondary" onClick={refresh} disabled={pending}>{pending ? "Refreshing…" : "Refresh"}</button>
          {isAdmin && <button type="button" className="button secondary" onClick={() => setModal("categories")}>Manage categories</button>}
          {isAdmin && <button type="button" className="button" onClick={() => setModal("add")}>Add product</button>}
        </div>
      </form>

      <div className={`${styles.layout} ${selected ? styles.withPanel : ""}`} style={{ marginTop: "1.25rem" }}>
        <section className="table-card" style={{ marginTop: 0 }}>
          <div className={styles.scroll}>
            <table>
              <thead>
                <tr><th>Image</th><th>Code</th><th>Product</th><th>Category</th><th>Type</th><th>Status</th><th>GST %</th><th>Net price</th></tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr
                    key={p.id}
                    className={`${styles.row} ${p.id === selectedId ? styles.rowActive : ""}`}
                    onClick={() => setSelectedId(p.id === selectedId ? null : p.id)}
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === "Enter") setSelectedId(p.id); }}
                  >
                    <td>{p.imagePath ? <img className={styles.thumb} src={p.imagePath} alt="" loading="lazy" /> : <span className={styles.thumbEmpty}>none</span>}</td>
                    <td className={styles.code}>{p.code ?? "—"}</td>
                    <td>{p.name ?? "—"}<div className={styles.muted}>{p.secondaryCode ?? ""}</div></td>
                    <td>{p.category?.name ?? "—"}</td>
                    <td>{p.type ?? "—"}</td>
                    <td><span className={`badge ${p.status === "INACTIVE" ? styles.badgeInactive : p.status === "ARCHIVED" ? styles.badgeArchived : ""}`}>{statusLabel(p.status)}</span></td>
                    <td>{p.gstRate ?? "—"}</td>
                    <td>{money(p.price?.netAmount)}</td>
                  </tr>
                ))}
                {products.length === 0 && <tr><td colSpan={8}>No products found.</td></tr>}
              </tbody>
            </table>
          </div>
          <div className={styles.pager}>
            <span className={styles.muted}>{from}–{to} of {total}</span>
            <div className={styles.pagerBtns}>
              <label htmlFor="pm-limit" className={styles.muted}>Rows per page</label>
              <select id="pm-limit" value={filters.limit} onChange={(e) => go({ limit: e.target.value })}>
                {[10, 20, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
              <button type="button" className="button secondary" disabled={page <= 1 || pending} onClick={() => go({ page: page - 1 })}>Previous</button>
              <span>Page {page} of {pages}</span>
              <button type="button" className="button secondary" disabled={page >= pages || pending} onClick={() => go({ page: page + 1 })}>Next</button>
            </div>
          </div>
        </section>

        {selected && (
          <aside className={styles.panel} aria-label="Product details">
            <div className="eyebrow">{selected.code}</div>
            <h3>{selected.name ?? "Unnamed product"}</h3>
            {selected.imagePath && <img src={selected.imagePath} alt={selected.name ?? "Product"} />}
            <dl className={styles.dl}>
              <dt>Style code</dt><dd>{selected.secondaryCode ?? "—"}</dd>
              <dt>Category</dt><dd>{selected.category?.name ?? "—"}</dd>
              <dt>Status</dt><dd>{statusLabel(selected.status)}</dd>
              <dt>Material type</dt><dd>{selected.type ?? "—"}</dd>
              <dt>Colour</dt><dd>{selected.color ?? "—"}</dd>
              <dt>Dimensions</dt><dd>{selected.dimension || "—"}</dd>
              <dt>HSN code</dt><dd>{selected.hsnCode ?? "—"}</dd>
              <dt>Description</dt><dd>{selected.description ?? "—"}</dd>
              <dt>Purchase price</dt><dd>{money(selected.price?.purchasePrice)}</dd>
              <dt>Basic amount</dt><dd>{money(selected.price?.basicAmount)}</dd>
              <dt>GST rate</dt><dd>{selected.gstRate ?? "—"}%</dd>
              <dt>Net amount</dt><dd><strong>{money(selected.price?.netAmount)}</strong></dd>
              <dt>Price code</dt><dd>{selected.price?.priceCode ?? "—"}</dd>
              <dt>Updated</dt><dd>{new Date(selected.updatedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</dd>
            </dl>
            <div className={styles.actions}>
              {isAdmin && selected.status !== "ARCHIVED" && <button type="button" className="button" onClick={() => setModal("edit")}>Edit</button>}
              {isAdmin && selected.status !== "ARCHIVED" && <button type="button" className="button secondary" onClick={() => archive(selected)}>Archive</button>}
              <button type="button" className="button secondary" onClick={() => setSelectedId(null)}>Close</button>
            </div>
          </aside>
        )}
      </div>

      {modal === "add" && (
        <ProductFormModal mode="add" categories={categories} onClose={() => setModal(null)} onSaved={(p) => { setModal(null); setSelectedId(p.id); refresh(); }} />
      )}
      {modal === "edit" && selected && (
        <ProductFormModal mode="edit" product={selected} categories={categories} onClose={() => setModal(null)} onSaved={() => { setModal(null); refresh(); }} onStale={refresh} />
      )}
      {modal === "categories" && <CategoriesModal categories={categories} onClose={() => setModal(null)} onChanged={refresh} />}
    </>
  );
}
