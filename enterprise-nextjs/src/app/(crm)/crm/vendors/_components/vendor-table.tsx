"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { archiveAction, bulkArchiveAction, bulkStatusAction, restoreAction, setStatusAction } from "../actions";
import { ActionButton } from "./confirm-button";
import { StatusBadge } from "@/components/ui/status-badge";
import s from "./vendors.module.css";

export type VendorRow = {
  id: string;
  vendorCode: string;
  name: string;
  vendorType: string | null;
  categoryName: string | null;
  ownerName: string | null;
  status: string;
  statusLabel: string;
  priority: string;
  contactLine: string;
  city: string;
  productCount: number;
  score: number | null;
  band: string;
  archived: boolean;
  createdAt: string;
};

const STATUS_OPTIONS = [["ACTIVE", "Active"], ["PENDING", "Pending"], ["INACTIVE", "Inactive"], ["BLOCKED", "Blacklisted"]] as const;

export function VendorTable({ rows, canEdit, canArchive, showArchived }: { rows: VendorRow[]; canEdit: boolean; canArchive: boolean; showArchived: boolean }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState("ACTIVE");
  const [pending, start] = useTransition();
  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const ids = useMemo(() => [...selected], [selected]);
  const selectable = canEdit || canArchive;

  const toggle = (id: string) => setSelected((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const bulk = (run: () => ReturnType<typeof bulkStatusAction>) => start(async () => {
    const r = await run();
    if (!r.ok) { toast.error(r.error); return; }
    toast.success(r.message ?? "Done");
    setSelected(new Set());
    router.refresh();
  });

  return (
    <>
      {selectable && selected.size > 0 ? (
        <div className={s.toolbar} role="region" aria-label="Bulk actions" style={{ padding: "8px 14px", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", background: "var(--primary-soft)" }}>
          <strong>{selected.size} selected</strong>
          <div className={s.toolbarGroup}>
            {canEdit && !showArchived ? (
              <>
                <select value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value)} aria-label="New status">
                  {STATUS_OPTIONS.filter(([v]) => v !== "BLOCKED" || canArchive).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
                <button type="button" className="button small" disabled={pending} onClick={() => bulk(() => bulkStatusAction(ids, bulkStatus))}>Set status</button>
              </>
            ) : null}
            {canArchive ? (
              <button type="button" className="button secondary small" disabled={pending} onClick={() => bulk(() => bulkArchiveAction(ids, showArchived))}>
                {showArchived ? "Restore selected" : "Archive selected"}
              </button>
            ) : null}
            <button type="button" className={s.linkBtn} onClick={() => setSelected(new Set())}>Clear</button>
          </div>
        </div>
      ) : null}
      <section className="table-card">
        <div className={s.scroll}>
          <table>
            <thead>
              <tr>
                {selectable ? <th style={{ width: 36 }}><input type="checkbox" aria-label="Select all" checked={allSelected} onChange={() => setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)))} /></th> : null}
                <th>Vendor</th><th>Category</th><th>Primary contact</th><th>Status</th><th>Priority</th><th className="num">Products</th><th>Rating</th><th>Owner</th><th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  {selectable ? <td><input type="checkbox" aria-label={`Select ${r.name}`} checked={selected.has(r.id)} onChange={() => toggle(r.id)} /></td> : null}
                  <td>
                    <Link href={`/crm/vendors/${r.id}` as Route} className="cell-primary link" style={{ color: "var(--text)" }}>{r.name}</Link>
                    <div className={s.muted}><span className={s.mono}>{r.vendorCode}</span>{r.vendorType ? ` · ${r.vendorType}` : ""}{r.city ? ` · ${r.city}` : ""}</div>
                  </td>
                  <td>{r.categoryName ?? "-"}</td>
                  <td>{r.contactLine || "-"}</td>
                  <td>
                    {canEdit && !r.archived ? (
                      <select aria-label={`Status of ${r.name}`} value={r.status} onChange={(e) => {
                        const v = e.target.value;
                        start(async () => { const x = await setStatusAction(r.id, v); if (x.ok) { toast.success(x.message ?? "Status updated"); } else toast.error(x.error); router.refresh(); });
                      }} disabled={pending}>
                        {STATUS_OPTIONS.filter(([v]) => v !== "BLOCKED" || canArchive || r.status === "BLOCKED").map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                    ) : <StatusBadge value={r.archived ? "Archived" : r.status}>{r.archived ? "Archived" : r.statusLabel}</StatusBadge>}
                  </td>
                  <td><StatusBadge value={r.priority} dot={false} /></td>
                  <td className="num">{r.productCount}</td>
                  <td>{r.score == null ? <span className={s.muted}>No data</span> : `${r.score.toFixed(2)} · ${r.band}`}</td>
                  <td>{r.ownerName ?? <span className={s.muted}>Unassigned</span>}</td>
                  <td>
                    <div className={s.rowActions}>
                      <Link href={`/crm/vendors/${r.id}` as Route} className={s.linkBtn}>Open</Link>
                      {canArchive ? (r.archived
                        ? <ActionButton label="Restore" action={restoreAction.bind(null, r.id)} />
                        : <ActionButton label="Archive" danger confirm={`Archive ${r.name}? It can be restored later.`} action={archiveAction.bind(null, r.id)} />) : null}
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 ? <tr><td colSpan={selectable ? 10 : 9} className="cell-empty">No vendors match these filters. Try clearing a filter or switching the status view.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
