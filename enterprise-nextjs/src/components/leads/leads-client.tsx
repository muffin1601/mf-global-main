"use client";

import type { Route } from "next";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { deleteAllFilteredAction, deleteLeadsAction, removeAssignmentsAction } from "@/app/(crm)/crm/lead-management/actions";
import { activeFilterCount, filterToParams, PAGE_SIZES, type LeadFilter, type LeadPreset } from "@/server/leads/filter-schema";
import type { FilterMeta, LeadListResult } from "@/server/leads/types";
import { dash, fmtDate } from "./format";
import { AssignModal, BulkUpdateModal, ConfirmModal, TransferModal } from "./lead-bulk-modals";
import { DownloadModal } from "./lead-download-modal";
import { FilterModal } from "./lead-filter-modal";
import { AddLeadModal, EditLeadModal, type UserOption } from "./lead-form-modal";
import { ProductsModal } from "./lead-products-modal";
import { ViewLeadModal } from "./lead-view-modal";
import styles from "./leads.module.css";

type ModalState =
  | { kind: "view" | "edit" | "deleteOne"; id: string }
  | { kind: "add" | "filter" | "download" | "products" | "assign" | "transfer" | "bulkUpdate" | "remove" | "deleteSelected" | "deleteFiltered" };

type Props = {
  preset: LeadPreset; isAdmin: boolean; result: LeadListResult; filter: LeadFilter; meta: FilterMeta; users: UserOption[];
};

const ASSIGNMENT_FILTER_PRESETS: LeadPreset[] = ["all", "assigned", "new", "trending", "won"];

export function LeadsClient({ preset, isAdmin, result, filter, meta, users }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [modal, setModal] = useState<ModalState | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [q, setQ] = useState(filter.q ?? "");

  const go = (next: { filter?: LeadFilter; page?: number; pageSize?: number }) => {
    const params = filterToParams(next.filter ?? filter);
    const size = next.pageSize ?? result.pageSize;
    if (size !== PAGE_SIZES[0]) params.set("pageSize", String(size));
    if ((next.page ?? 1) > 1) params.set("page", String(next.page));
    const qs = params.toString();
    router.push((qs ? `${pathname}?${qs}` : pathname) as Route);
    setSelected(new Set());
  };

  const close = () => setModal(null);
  const done = () => { close(); setSelected(new Set()); router.refresh(); };
  const ids = [...selected];
  const filterCount = activeFilterCount(filter);
  const filtered = preset !== "all" || Boolean(filter.q) || filterCount > 0 || Boolean(filter.from || filter.to);
  const allOnPage = result.rows.length > 0 && result.rows.every((r) => selected.has(r.id));
  const first = result.total === 0 ? 0 : (result.page - 1) * result.pageSize + 1;
  const last = Math.min(result.total, result.page * result.pageSize);

  return (
    <>
      <div className={styles.toolbar}>
        <form className={styles.search} onSubmit={(e) => { e.preventDefault(); go({ filter: { ...filter, q: q.trim() || undefined } }); }}>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, company, phone, email…" aria-label="Search leads" />
          <button className="button secondary" type="submit">Search</button>
        </form>
        <button type="button" className="button secondary" onClick={() => setModal({ kind: "filter" })}>Filters{filterCount ? ` (${filterCount})` : ""}</button>
        <button type="button" className="button secondary" onClick={() => setModal({ kind: "products" })}>Products</button>
        <button type="button" className="button secondary" onClick={() => setModal({ kind: "download" })}>Download</button>
        <button type="button" className="button" onClick={() => setModal({ kind: "add" })}>Add lead</button>
      </div>

      {isAdmin && (selected.size > 0 || (filtered && result.total > 0)) ? (
        <div className={styles.bulkBar}>
          {selected.size > 0 ? (
            <>
              <strong>{selected.size} selected</strong>
              <button type="button" className={`button ${styles.small}`} onClick={() => setModal({ kind: "assign" })}>Assign</button>
              <button type="button" className={`button secondary ${styles.small}`} onClick={() => setModal({ kind: "transfer" })}>Transfer</button>
              <button type="button" className={`button secondary ${styles.small}`} onClick={() => setModal({ kind: "remove" })}>Remove assignment</button>
              <button type="button" className={`button secondary ${styles.small}`} onClick={() => setModal({ kind: "bulkUpdate" })}>Bulk update</button>
              <button type="button" className={`button secondary ${styles.small} ${styles.danger}`} onClick={() => setModal({ kind: "deleteSelected" })}>Delete</button>
              <button type="button" className={`button secondary ${styles.small}`} onClick={() => setSelected(new Set())}>Clear selection</button>
            </>
          ) : null}
          {filtered && result.total > 0 && !(preset === "all" && !filter.q && filterCount === 0 && !filter.from && !filter.to) ? (
            <button type="button" className={`button secondary ${styles.small} ${styles.danger}`} onClick={() => setModal({ kind: "deleteFiltered" })}>
              Delete all {result.total} matching
            </button>
          ) : null}
        </div>
      ) : null}

      <section className="table-card">
        <div className={styles.tableScroll}>
          <table>
            <thead>
              <tr>
                {isAdmin ? (
                  <th style={{ width: 36 }}>
                    <input type="checkbox" aria-label="Select all leads on this page" checked={allOnPage}
                      onChange={(e) => setSelected(e.target.checked ? new Set(result.rows.map((r) => r.id)) : new Set())} />
                  </th>
                ) : null}
                <th>Lead</th><th>Phone</th><th>Entry date</th><th>Status</th><th>Call status</th><th>Follow-up</th><th>Assigned to</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {result.rows.map((row) => (
                <tr key={row.id}>
                  {isAdmin ? (
                    <td>
                      <input type="checkbox" aria-label={`Select ${row.name ?? row.phone ?? "lead"}`} checked={selected.has(row.id)}
                        onChange={(e) => setSelected((prev) => { const n = new Set(prev); if (e.target.checked) n.add(row.id); else n.delete(row.id); return n; })} />
                    </td>
                  ) : null}
                  <td>{dash(row.name)}<br /><small>{dash(row.company)} · {dash(row.location)}</small></td>
                  <td>{row.phone || row.contact || "—"}</td>
                  <td title={row.createdAt}>{fmtDate(row.createdAt)}</td>
                  <td><span className="badge">{row.status}</span></td>
                  <td>{row.callStatus}</td>
                  <td>{fmtDate(row.followUpDate)}</td>
                  <td>{row.assignees.map((a) => a.name).join(", ") || "Unassigned"}</td>
                  <td>
                    <div className={styles.rowActions}>
                      <button type="button" className={`button secondary ${styles.small}`} onClick={() => setModal({ kind: "view", id: row.id })}>View</button>
                      {row.canUpdate ? <button type="button" className={`button secondary ${styles.small}`} onClick={() => setModal({ kind: "edit", id: row.id })}>Edit</button> : null}
                      {isAdmin ? <button type="button" className={`button secondary ${styles.small} ${styles.danger}`} onClick={() => setModal({ kind: "deleteOne", id: row.id })}>Delete</button> : null}
                    </div>
                  </td>
                </tr>
              ))}
              {result.rows.length === 0 ? <tr><td colSpan={isAdmin ? 9 : 8}>No leads match this view.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>

      <div className={styles.pager}>
        <span className={styles.muted}>{first}–{last} of {result.total} leads · Page {result.page} of {result.pages}</span>
        <div className={styles.pagerBtns}>
          <label className={styles.muted} htmlFor="page-size">Rows</label>
          <select id="page-size" value={result.pageSize} onChange={(e) => go({ pageSize: Number(e.target.value) })}>
            {PAGE_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <button type="button" className={`button secondary ${styles.small}`} disabled={result.page <= 1} onClick={() => go({ page: 1 })}>First</button>
          <button type="button" className={`button secondary ${styles.small}`} disabled={result.page <= 1} onClick={() => go({ page: result.page - 1 })}>Previous</button>
          <button type="button" className={`button secondary ${styles.small}`} disabled={result.page >= result.pages} onClick={() => go({ page: result.page + 1 })}>Next</button>
          <button type="button" className={`button secondary ${styles.small}`} disabled={result.page >= result.pages} onClick={() => go({ page: result.pages })}>Last</button>
        </div>
      </div>

      {modal?.kind === "view" ? <ViewLeadModal id={modal.id} onClose={close} /> : null}
      {modal?.kind === "edit" ? <EditLeadModal id={modal.id} isAdmin={isAdmin} users={users} onClose={close} onDone={done} /> : null}
      {modal?.kind === "add" ? <AddLeadModal isAdmin={isAdmin} users={users} onClose={close} onDone={done} /> : null}
      {modal?.kind === "filter" ? (
        <FilterModal filter={filter} meta={meta} users={users} isAdmin={isAdmin} showAssignment={ASSIGNMENT_FILTER_PRESETS.includes(preset)}
          onClose={close} onApply={(next) => { close(); go({ filter: next }); }} />
      ) : null}
      {modal?.kind === "download" ? <DownloadModal filter={filter} preset={preset} total={result.total} onClose={close} /> : null}
      {modal?.kind === "products" ? <ProductsModal onClose={close} /> : null}
      {modal?.kind === "assign" ? <AssignModal leadIds={ids} users={users} onClose={close} onDone={done} /> : null}
      {modal?.kind === "transfer" ? <TransferModal leadIds={ids} users={users} onClose={close} onDone={done} /> : null}
      {modal?.kind === "bulkUpdate" ? <BulkUpdateModal leadIds={ids} onClose={close} onDone={done} /> : null}
      {modal?.kind === "remove" ? (
        <ConfirmModal title="Remove assignments" confirmLabel="Remove" onClose={close}
          message={`Remove every assignee from ${ids.length} selected lead(s)? They become unassigned.`}
          onConfirm={async () => { const r = await removeAssignmentsAction(ids); if (r.ok) { toast.success(`Unassigned ${r.leads} lead(s).`); done(); } return r; }} />
      ) : null}
      {modal?.kind === "deleteSelected" ? (
        <ConfirmModal title="Delete leads" confirmLabel="Delete" onClose={close}
          message={`Permanently delete ${ids.length} selected lead(s)? This cannot be undone.`}
          onConfirm={async () => { const r = await deleteLeadsAction(ids); if (r.ok) { toast.success(`Deleted ${r.deleted} lead(s).`); done(); } return r; }} />
      ) : null}
      {modal?.kind === "deleteOne" ? (
        <ConfirmModal title="Delete lead" confirmLabel="Delete" onClose={close}
          message="Permanently delete this lead? This cannot be undone."
          onConfirm={async () => { const r = await deleteLeadsAction([modal.id]); if (r.ok) { toast.success("Lead deleted."); done(); } return r; }} />
      ) : null}
      {modal?.kind === "deleteFiltered" ? (
        <ConfirmModal title="Delete all matching leads" confirmLabel={`Delete ${result.total} leads`} onClose={close}
          message={`Permanently delete all ${result.total} leads matching the current view and filters (not just this page)? This cannot be undone.`}
          onConfirm={async () => { const r = await deleteAllFilteredAction(filterToParams(filter).toString(), preset); if (r.ok) { toast.success(`Deleted ${r.deleted} lead(s).`); done(); } return r; }} />
      ) : null}
    </>
  );
}
