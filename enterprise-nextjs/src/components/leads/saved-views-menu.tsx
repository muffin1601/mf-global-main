"use client";

import type { Route } from "next";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Bookmark, BookmarkPlus, ChevronDown, Share2, Trash2 } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { deleteViewAction, saveViewAction } from "@/app/(crm)/crm/views-actions";
import type { SavedViewDto } from "@/server/views/service";

const toQuery = (params: SavedViewDto["params"]) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) for (const x of Array.isArray(v) ? v : [v]) p.append(k, x);
  return p.toString();
};

/**
 * Saved views for a list page: open a view (navigates to its saved query on this same page, so the
 * server applies the viewer's own scope), save the current filters/sort, share (admins), delete.
 */
export function SavedViewsMenu({ entity, views, canShare, isAdmin }: { entity: string; views: SavedViewDto[]; canShare: boolean; isAdmin: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [shared, setShared] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = (() => { const p = new URLSearchParams(search.toString()); p.delete("page"); p.delete("create"); return p.toString(); })();
  const active = views.find((v) => toQuery(v.params) === current && current !== "");

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown); document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const save = async () => {
    if (!name.trim()) { toast.error("Name the view."); return; }
    setBusy(true);
    const r = await saveViewAction(entity, name.trim(), current, shared);
    setBusy(false);
    if (!r.ok) { toast.error(r.error); return; }
    toast.success(`Saved view “${r.view.name}”.`);
    setSaving(false); setName(""); setShared(false); router.refresh();
  };
  const remove = async (v: SavedViewDto) => {
    const r = await deleteViewAction(v.id);
    if (!r.ok) { toast.error(r.error); return; }
    toast.success(`Deleted “${v.name}”.`); router.refresh();
  };

  return (
    <div className="menu-wrap" ref={ref}>
      <button type="button" className="button secondary" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}>
        <Bookmark size={15} aria-hidden="true" />{active ? active.name : "Views"}<ChevronDown size={14} aria-hidden="true" />
      </button>
      {open ? (
        <div className="menu" role="menu" aria-label="Saved views" style={{ minWidth: 260, left: 0, right: "auto" }}>
          {views.length ? views.map((v) => (
            <div key={v.id} style={{ display: "flex", alignItems: "center" }}>
              <button type="button" role="menuitem" className="menu-item" style={{ flex: 1 }}
                onClick={() => { setOpen(false); const q = toQuery(v.params); router.push((q ? `${pathname}?${q}` : pathname) as Route); }}>
                {v.shared ? <Share2 size={14} aria-hidden="true" /> : <Bookmark size={14} aria-hidden="true" />}
                <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{v.name}</span>
                {!v.mine ? <span className="muted" style={{ marginLeft: "auto", fontSize: ".75rem" }}>{v.owner}</span> : null}
              </button>
              {v.mine || isAdmin ? (
                <button type="button" className="icon-btn" aria-label={`Delete view ${v.name}`} title="Delete view" onClick={() => remove(v)}><Trash2 size={14} /></button>
              ) : null}
            </div>
          )) : <div className="menu-label" style={{ padding: "8px 10px" }}>No saved views yet</div>}
          <div className="menu-sep" />
          <button type="button" role="menuitem" className="menu-item" disabled={!current} onClick={() => { setOpen(false); setSaving(true); }}
            title={current ? undefined : "Apply a filter, search or sort first"}>
            <BookmarkPlus size={14} aria-hidden="true" />Save current view…
          </button>
        </div>
      ) : null}
      {saving ? (
        <Modal title="Save view" description="Saves the current search, filters and sort. Opening it always shows only records you are allowed to see."
          onClose={() => setSaving(false)} busy={busy}
          footer={<>
            <button type="button" className="button secondary" onClick={() => setSaving(false)} disabled={busy}>Cancel</button>
            <button type="button" className="button" onClick={save} disabled={busy}>{busy ? "Saving…" : "Save view"}</button>
          </>}>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="view-name">Name</label>
              <input id="view-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="e.g. Hot leads in Pune" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void save(); } }} />
              <span className="hint">Saving with an existing name replaces that view.</span>
            </div>
            {canShare ? <label className="check-row"><input type="checkbox" checked={shared} onChange={(e) => setShared(e.target.checked)} />Share with everyone</label> : null}
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
