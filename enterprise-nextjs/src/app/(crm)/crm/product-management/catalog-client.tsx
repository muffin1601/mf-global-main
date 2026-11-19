/* eslint-disable @next/next/no-img-element -- product photos are arbitrary public-bucket URLs */
"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Archive, ChevronLeft, ChevronRight, ImageOff, Pencil, Plus, RefreshCw, Search, Tags, X } from "lucide-react";
import type { CategoryRow } from "@/server/catalog/categories";
import type { ProductView } from "@/server/catalog/products";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyRow } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
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
  openCreate?: boolean;
};

const money = (n: number | null | undefined) => (n == null ? "—" : `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
const statusLabel = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();

export function CatalogClient({ isAdmin, products, categories, total, page, pages, filters, openCreate }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState(filters.query);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [modal, setModal] = useState<null | "add" | "edit" | "categories" | "archive">(openCreate && isAdmin ? "add" : null);
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
  const closeModal = () => {
    setModal(null);
    if (openCreate) startTransition(() => router.replace(pathname as never, { scroll: false }));
  };

  async function archive(product: ProductView) {
    const res = await fetch(`/api/products/${product.id}`, { method: "DELETE" });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) { toast.error(body.error ?? "Could not archive the product."); return false; }
    toast.success("Product archived.");
    setSelectedId(null);
    refresh();
    return true;
  }

  const from = total === 0 ? 0 : (page - 1) * filters.limit + 1;
  const to = Math.min(page * filters.limit, total);
  const hasFilters = Boolean(filters.query || filters.categoryId || filters.status !== "active" || filters.sort !== "updated_desc");

  return (
    <>
      <PageHeader
        title="Products"
        description={`${total.toLocaleString("en-IN")} product${total === 1 ? "" : "s"} in the catalogue. Select a row to see pricing and details.`}
        actions={isAdmin ? <>
          <button type="button" className="button secondary" onClick={() => setModal("categories")}><Tags size={15} aria-hidden="true" />Manage categories</button>
          <button type="button" className="button" onClick={() => setModal("add")}><Plus size={15} aria-hidden="true" />Add product</button>
        </> : undefined}
      />
      <form className="filter-bar" onSubmit={(e) => { e.preventDefault(); go({ query: query.trim() }); }} role="search" aria-label="Filter products">
        <div className="field grow">
          <label htmlFor="pm-search">Search</label>
          <div className="search-input">
            <Search size={15} aria-hidden="true" />
            <input id="pm-search" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Code, name, style code, type, colour, GST…" />
          </div>
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
        <div className="actions">
          <button type="submit" className="button">Search</button>
          {hasFilters ? <button type="button" className="button ghost" onClick={() => { setQuery(""); setSelectedId(null); startTransition(() => router.push("/crm/product-management")); }}>Reset</button> : null}
          <button type="button" className="icon-btn bordered" onClick={refresh} disabled={pending} aria-label="Refresh list" title="Refresh"><RefreshCw size={15} className={pending ? "spin" : undefined} /></button>
        </div>
      </form>

      <div className={`${styles.layout} ${selected ? styles.withPanel : ""}`}>
        <section className="table-card" aria-busy={pending}>
          <div className={styles.scroll}>
            <table>
              <thead>
                <tr><th style={{ width: 56 }}><span className="sr-only">Image</span></th><th>Product</th><th>Code</th><th>Category</th><th>Type</th><th>Status</th><th className="num">GST</th><th className="num">Net price</th></tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr
                    key={p.id}
                    className={`${styles.row} ${p.id === selectedId ? styles.rowActive : ""}`}
                    onClick={() => setSelectedId(p.id === selectedId ? null : p.id)}
                    tabIndex={0}
                    aria-selected={p.id === selectedId}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelectedId(p.id === selectedId ? null : p.id); } }}
                  >
                    <td>{p.imagePath ? <img className={styles.thumb} src={p.imagePath} alt="" loading="lazy" /> : <span className={styles.thumbEmpty} aria-hidden="true"><ImageOff size={15} /></span>}</td>
                    <td><span className={styles.productName}>{p.name ?? "—"}</span>{p.secondaryCode ? <span className="sub">Style {p.secondaryCode}</span> : null}</td>
                    <td className={styles.code}>{p.code ?? "—"}</td>
                    <td>{p.category?.name ?? "—"}</td>
                    <td>{p.type ?? "—"}</td>
                    <td><StatusBadge value={p.status} kind="generic">{statusLabel(p.status)}</StatusBadge></td>
                    <td className="num">{p.gstRate == null ? "—" : `${p.gstRate}%`}</td>
                    <td className="num" style={{ fontWeight: 600 }}>{money(p.price?.netAmount)}</td>
                  </tr>
                ))}
                {products.length === 0 && (
                  <EmptyRow
                    colSpan={8} title={hasFilters ? "No products match these filters" : "No products yet"}
                    description={hasFilters ? "Try another search term, category or status." : isAdmin ? "Add your first product to start quoting." : "Products added by an administrator will appear here."}
                  />
                )}
              </tbody>
            </table>
          </div>
          <div className="table-foot">
            <span>{from}–{to} of {total.toLocaleString("en-IN")}</span>
            <div className="pager">
              <label htmlFor="pm-limit">Rows per page</label>
              <select id="pm-limit" value={filters.limit} onChange={(e) => go({ limit: e.target.value })}>
                {[10, 20, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
              <span style={{ margin: "0 6px" }}>Page {page} of {Math.max(1, pages)}</span>
              <button type="button" className="icon-btn bordered" disabled={page <= 1 || pending} onClick={() => go({ page: page - 1 })} aria-label="Previous page"><ChevronLeft size={15} /></button>
              <button type="button" className="icon-btn bordered" disabled={page >= pages || pending} onClick={() => go({ page: page + 1 })} aria-label="Next page"><ChevronRight size={15} /></button>
            </div>
          </div>
        </section>

        {selected && (
          <aside className={styles.panel} aria-label="Product details">
            <div className={styles.panelHead}>
              <div>
                <span className={styles.code}>{selected.code}</span>
                <h3>{selected.name ?? "Unnamed product"}</h3>
              </div>
              <button type="button" className="icon-btn" onClick={() => setSelectedId(null)} aria-label="Close details"><X size={16} /></button>
            </div>
            <div className={styles.panelBody}>
              {selected.imagePath && <img className={styles.panelImg} src={selected.imagePath} alt={selected.name ?? "Product"} />}
              <dl className={styles.dl}>
                <dt>Status</dt><dd><StatusBadge value={selected.status}>{statusLabel(selected.status)}</StatusBadge></dd>
                <dt>Style code</dt><dd>{selected.secondaryCode ?? "—"}</dd>
                <dt>Category</dt><dd>{selected.category?.name ?? "—"}</dd>
                <dt>Material type</dt><dd>{selected.type ?? "—"}</dd>
                <dt>Colour</dt><dd>{selected.color ?? "—"}</dd>
                <dt>Dimensions</dt><dd>{selected.dimension || "—"}</dd>
                <dt>HSN code</dt><dd>{selected.hsnCode ?? "—"}</dd>
                <dt>Description</dt><dd>{selected.description ?? "—"}</dd>
                <dt>Updated</dt><dd>{new Date(selected.updatedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })}</dd>
              </dl>
              <dl className={styles.priceBox} aria-label="Pricing">
                <dt>Purchase price</dt><dd>{money(selected.price?.purchasePrice)}</dd>
                <dt>Basic amount</dt><dd>{money(selected.price?.basicAmount)}</dd>
                <dt>GST rate</dt><dd>{selected.gstRate ?? "—"}%</dd>
                <dt className={styles.net}>Net amount</dt><dd className={styles.net}>{money(selected.price?.netAmount)}</dd>
                <dt>Price code</dt><dd>{selected.price?.priceCode ?? "—"}</dd>
              </dl>
            </div>
            {isAdmin && selected.status !== "ARCHIVED" ? (
              <div className={styles.panelFoot}>
                <button type="button" className="button" onClick={() => setModal("edit")}><Pencil size={15} aria-hidden="true" />Edit</button>
                <button type="button" className="button secondary danger" onClick={() => setModal("archive")}><Archive size={15} aria-hidden="true" />Archive</button>
              </div>
            ) : null}
          </aside>
        )}
      </div>

      {modal === "add" && (
        <ProductFormModal mode="add" categories={categories} onClose={closeModal} onSaved={(p) => { closeModal(); setSelectedId(p.id); refresh(); }} />
      )}
      {modal === "edit" && selected && (
        <ProductFormModal mode="edit" product={selected} categories={categories} onClose={() => setModal(null)} onSaved={() => { setModal(null); refresh(); }} onStale={refresh} />
      )}
      {modal === "categories" && <CategoriesModal categories={categories} onClose={() => setModal(null)} onChanged={refresh} />}
      {modal === "archive" && selected && (
        <ConfirmDialog
          title="Archive product" confirmLabel="Archive product" destructive onClose={() => setModal(null)}
          message={<>Archive <strong>{selected.name ?? selected.code}</strong>? It will be hidden from active lists and quotation search.</>}
          onConfirm={() => archive(selected)}
        />
      )}
    </>
  );
}
