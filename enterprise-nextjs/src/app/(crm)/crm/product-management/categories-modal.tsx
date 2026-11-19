"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Check, Plus, Trash2 } from "lucide-react";
import type { CategoryRow } from "@/server/catalog/categories";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Modal } from "@/components/ui/modal";
import styles from "./catalog.module.css";

type Props = { categories: CategoryRow[]; onClose: () => void; onChanged: () => void };

export function CategoriesModal({ categories, onClose, onChanged }: Props) {
  const [newName, setNewName] = useState("");
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState<CategoryRow | null>(null);

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

  if (deleting) {
    return (
      <ConfirmDialog
        title="Delete category" confirmLabel="Delete category" destructive onClose={() => setDeleting(null)}
        message={<>Delete <strong>{deleting.name}</strong>?{deleting.productCount ? ` It is used by ${deleting.productCount} product(s), which must be moved to another category first.` : ""}</>}
        onConfirm={async () => {
          const ok = await call(`/api/categories/${deleting.id}`, "DELETE");
          if (ok) toast.success("Category deleted.");
          return true;
        }}
      />
    );
  }

  return (
    <Modal title="Manage categories" description="Category codes prefix new product codes and never change." onClose={onClose} busy={busy}
      footer={<button type="button" className="button secondary" onClick={onClose} disabled={busy}>Done</button>}>
      <form
        className="toolbar" style={{ marginBottom: 14 }}
        onSubmit={async (e) => {
          e.preventDefault();
          if (await call("/api/categories", "POST", { name: newName })) { setNewName(""); toast.success("Category added."); }
        }}
      >
        <input style={{ flex: 1, minWidth: 0 }} aria-label="New category name" placeholder="New category name" value={newName} onChange={(e) => setNewName(e.target.value)} disabled={busy} />
        <button type="submit" className="button" disabled={busy || !newName.trim()}><Plus size={15} aria-hidden="true" />Add</button>
      </form>
      {error && <div className="callout tone-danger" role="alert" style={{ marginBottom: 10 }}>{error}</div>}
      <div className={styles.catList}>
        {categories.length === 0 && <p className="muted">No categories yet.</p>}
        {categories.map((c) => {
          const value = edits[c.id] ?? c.name;
          const dirty = value.trim() !== c.name && !!value.trim();
          return (
            <div key={c.id} className={styles.catRow}>
              <span className={styles.tag} title="Category code">{c.code}</span>
              <input aria-label={`Name of ${c.name}`} value={value} onChange={(e) => setEdits((m) => ({ ...m, [c.id]: e.target.value }))} disabled={busy} />
              <span className={styles.count}>{c.productCount} product{c.productCount === 1 ? "" : "s"}</span>
              <button
                type="button" className="icon-btn" disabled={busy || !dirty} aria-label={`Save new name for ${c.name}`} title="Rename"
                onClick={async () => {
                  if (await call(`/api/categories/${c.id}`, "PUT", { name: value })) {
                    setEdits((m) => { const { [c.id]: _drop, ...rest } = m; void _drop; return rest; });
                    toast.success("Category renamed.");
                  }
                }}
              >
                <Check size={15} />
              </button>
              <button type="button" className="icon-btn" disabled={busy} aria-label={`Delete ${c.name}`} title="Delete" onClick={() => setDeleting(c)} style={{ color: "var(--danger)" }}>
                <Trash2 size={15} />
              </button>
            </div>
          );
        })}
      </div>
    </Modal>
  );
}
