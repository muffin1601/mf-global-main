"use client";

import { useState } from "react";
import { toast } from "sonner";
import type { CategoryRow } from "@/server/catalog/categories";
import styles from "./catalog.module.css";

type Props = { categories: CategoryRow[]; onClose: () => void; onChanged: () => void };

export function CategoriesModal({ categories, onClose, onChanged }: Props) {
  const [newName, setNewName] = useState("");
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function call(url: string, method: string, body?: unknown) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(url, { method, headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setError(json.error ?? "Request failed."); return false; }
      onChanged();
      return true;
    } catch {
      setError("Network error. Please try again.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="Manage categories" onClick={() => !busy && onClose()}>
      <div className={styles.modal} style={{ width: "min(560px,100%)" }} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHead}>
          <h2>Manage categories</h2>
          <button type="button" className="button secondary" aria-label="Close" onClick={onClose}>×</button>
        </div>
        <div className={styles.catList}>
          <form
            className={styles.catRow}
            onSubmit={async (e) => {
              e.preventDefault();
              if (await call("/api/categories", "POST", { name: newName })) { setNewName(""); toast.success("Category added."); }
            }}
          >
            <input aria-label="New category name" placeholder="New category name" value={newName} onChange={(e) => setNewName(e.target.value)} disabled={busy} />
            <button type="submit" className="button" disabled={busy || !newName.trim()}>Add</button>
          </form>
          {categories.length === 0 && <p className={styles.muted}>No categories yet.</p>}
          {categories.map((c) => {
            const value = edits[c.id] ?? c.name;
            return (
              <div key={c.id} className={styles.catRow}>
                <span className={styles.tag}>{c.code}</span>
                <input aria-label={`Name of ${c.name}`} value={value} onChange={(e) => setEdits((m) => ({ ...m, [c.id]: e.target.value }))} disabled={busy} />
                <span className={styles.tag}>{c.productCount} product{c.productCount === 1 ? "" : "s"}</span>
                <button
                  type="button"
                  className="button secondary"
                  disabled={busy || value.trim() === c.name || !value.trim()}
                  onClick={async () => {
                    if (await call(`/api/categories/${c.id}`, "PUT", { name: value })) {
                      setEdits((m) => { const { [c.id]: _drop, ...rest } = m; void _drop; return rest; });
                      toast.success("Category renamed.");
                    }
                  }}
                >
                  Rename
                </button>
                <button
                  type="button"
                  className="button secondary"
                  disabled={busy}
                  onClick={async () => {
                    if (!window.confirm(`Delete category "${c.name}"?`)) return;
                    if (await call(`/api/categories/${c.id}`, "DELETE")) toast.success("Category deleted.");
                  }}
                >
                  Delete
                </button>
              </div>
            );
          })}
          {error && <div className="error" role="alert">{error}</div>}
        </div>
      </div>
    </div>
  );
}
