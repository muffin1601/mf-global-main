"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import type { CategoryRow } from "@/server/catalog/categories";
import type { ProductView } from "@/server/catalog/products";
import styles from "./catalog.module.css";

const MAX_BYTES = 5 * 1024 * 1024;

type Props = {
  mode: "add" | "edit";
  product?: ProductView;
  categories: CategoryRow[];
  onClose: () => void;
  onSaved: (product: ProductView) => void;
  onStale?: () => void;
};

const s = (v: number | null | undefined) => (v == null ? "" : String(v));

export function ProductFormModal({ mode, product, categories, onClose, onSaved, onStale }: Props) {
  const [form, setForm] = useState({
    name: product?.name ?? "",
    secondaryCode: product?.secondaryCode ?? "",
    type: product?.type ?? "",
    color: product?.color ?? "",
    hsnCode: product?.hsnCode ?? "",
    dimension: product?.dimension ?? "",
    categoryId: product?.category?.id ?? "",
    description: product?.description ?? "",
    purchasePrice: s(product?.price?.purchasePrice),
    basicAmount: s(product?.price?.basicAmount),
    gstRate: s(product?.price?.gstRate ?? product?.gstRate),
  });
  const [file, setFile] = useState<File | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [codePreview, setCodePreview] = useState("");
  const [codeError, setCodeError] = useState("");
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const filePreview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => { if (filePreview) URL.revokeObjectURL(filePreview); }, [filePreview]);

  // Code preview (add only): informational, the real code is allocated on save.
  useEffect(() => {
    if (mode !== "add" || !form.categoryId) return;
    const controller = new AbortController();
    fetch(`/api/products/code-preview?categoryId=${encodeURIComponent(form.categoryId)}`, { signal: controller.signal })
      .then(async (r) => ({ ok: r.ok, body: await r.json() }))
      .then(({ ok, body }) => {
        setCodePreview(ok ? body.productCode : "");
        setCodeError(ok ? "" : body.error ?? "Unable to preview the product code.");
      })
      .catch(() => {});
    return () => controller.abort();
  }, [mode, form.categoryId]);

  // Price auto-calc (AddProductModal parity): net = basic + basic * gst / 100.
  const net = useMemo(() => {
    const basic = Number(form.basicAmount);
    const gst = Number(form.gstRate);
    if (form.basicAmount === "" || form.gstRate === "" || !Number.isFinite(basic) || !Number.isFinite(gst)) return "";
    return (basic + (basic * gst) / 100).toFixed(2);
  }, [form.basicAmount, form.gstRate]);

  function pickFile(f: File | null) {
    if (f && f.size > MAX_BYTES) { setError("Product image must be 5 MB or smaller."); return; }
    setError("");
    setFile(f);
    if (f) setRemoveImage(false);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    const body = new FormData();
    for (const k of ["name", "secondaryCode", "type", "color", "hsnCode", "dimension", "categoryId", "description"] as const) body.set(k, form[k]);
    body.set("price", JSON.stringify({ purchasePrice: form.purchasePrice, basicAmount: form.basicAmount, gstRate: form.gstRate }));
    if (file) body.set("image", file);
    if (mode === "edit" && product) {
      body.set("expectedUpdatedAt", product.updatedAt);
      if (removeImage) body.set("removeImage", "true");
    }
    try {
      const res = await fetch(mode === "add" ? "/api/products" : `/api/products/${product!.id}`, { method: mode === "add" ? "POST" : "PUT", body });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "The product could not be saved.");
        if (res.status === 409 && mode === "edit") onStale?.();
        return;
      }
      toast.success(mode === "add" ? `Product ${json.product.code} added.` : "Product updated.");
      onSaved(json.product);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const currentImage = mode === "edit" && !removeImage ? product?.imagePath : null;
  const shown = filePreview ?? currentImage;

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label={mode === "add" ? "Add product" : "Edit product"} onClick={() => !saving && onClose()}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHead}>
          <h2>{mode === "add" ? "Add new product" : `Edit ${product?.code ?? "product"}`}</h2>
          <button type="button" className="button secondary" aria-label="Close" onClick={onClose} disabled={saving}>×</button>
        </div>
        <form onSubmit={submit}>
          <div className={styles.modalBody}>
            <div className={`field ${styles.full}`}>
              <label htmlFor="pf-image">Product image (JPG, PNG, WEBP or GIF, max 5 MB)</label>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {shown && <img className={styles.preview} src={shown} alt="Product preview" />}
              <input id="pf-image" type="file" accept="image/jpeg,image/png,image/webp,image/gif" disabled={saving} onChange={(e) => { pickFile(e.target.files?.[0] ?? null); e.target.value = ""; }} />
              {(file || currentImage) && (
                <div className={styles.actions}>
                  {file && <button type="button" className="button secondary" onClick={() => setFile(null)}>Discard new image</button>}
                  {mode === "edit" && currentImage && !file && <button type="button" className="button secondary" onClick={() => setRemoveImage(true)}>Remove image</button>}
                </div>
              )}
              {removeImage && <span className={styles.muted}>The current image will be removed when you save. <button type="button" className="button secondary" onClick={() => setRemoveImage(false)}>Undo</button></span>}
            </div>

            <div className="field">
              <label htmlFor="pf-category">Category *</label>
              <select id="pf-category" required value={form.categoryId} onChange={set("categoryId")} disabled={saving}>
                <option value="">Select category</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Product code</label>
              <div className={styles.code}>
                {mode === "edit" ? product?.code : codePreview || <span className={styles.muted}>Select a category</span>}
              </div>
              <span className={styles.muted}>{mode === "edit" ? "Codes never change after creation." : "Preview only; final code is assigned on save."}</span>
              {codeError && <span className="error">{codeError}</span>}
            </div>
            <div className="field"><label htmlFor="pf-s">Style code *</label><input id="pf-s" required value={form.secondaryCode} onChange={set("secondaryCode")} disabled={saving} /></div>
            <div className="field"><label htmlFor="pf-n">Product name *</label><input id="pf-n" required value={form.name} onChange={set("name")} disabled={saving} /></div>
            <div className="field"><label htmlFor="pf-t">Material type</label><input id="pf-t" value={form.type} onChange={set("type")} disabled={saving} /></div>
            <div className="field"><label htmlFor="pf-c">Colour</label><input id="pf-c" value={form.color} onChange={set("color")} disabled={saving} /></div>
            <div className="field"><label htmlFor="pf-h">HSN code</label><input id="pf-h" value={form.hsnCode} onChange={set("hsnCode")} disabled={saving} /></div>
            <div className="field"><label htmlFor="pf-d">Dimensions</label><input id="pf-d" value={form.dimension} onChange={set("dimension")} disabled={saving} /></div>
            <div className={`field ${styles.full}`}><label htmlFor="pf-desc">Description</label><textarea id="pf-desc" rows={3} value={form.description} onChange={set("description")} disabled={saving} /></div>

            <div className="field"><label htmlFor="pf-pp">Purchase price</label><input id="pf-pp" type="number" min="0" step="0.01" value={form.purchasePrice} onChange={set("purchasePrice")} disabled={saving} /></div>
            <div className="field"><label htmlFor="pf-ba">Basic amount *</label><input id="pf-ba" type="number" min="0" step="0.01" required value={form.basicAmount} onChange={set("basicAmount")} disabled={saving} /></div>
            <div className="field"><label htmlFor="pf-g">GST rate (%) *</label><input id="pf-g" type="number" min="0" step="0.01" required value={form.gstRate} onChange={set("gstRate")} disabled={saving} /></div>
            <div className="field"><label htmlFor="pf-net">Net amount (auto)</label><input id="pf-net" readOnly value={net} placeholder="Calculated" /></div>
            {error && <div className={`error ${styles.full}`} role="alert">{error}</div>}
          </div>
          <div className={styles.modalFoot}>
            <button type="button" className="button secondary" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" className="button" disabled={saving}>{saving ? "Saving…" : mode === "add" ? "Add product" : "Save changes"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
