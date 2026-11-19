"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import {
  ArrowRightLeft, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Download, Eye, ListFilter, Package, Pencil, Plus,
  Search, SquarePen, Trash2, UserMinus, UserPlus, X,
} from "lucide-react";
import { deleteAllFilteredAction, deleteLeadsAction, removeAssignmentsAction } from "@/app/(crm)/crm/lead-management/actions";
import { activeFilterCount, filterToParams, PAGE_SIZES, type LeadFilter, type LeadPreset } from "@/server/leads/filter-schema";
import type { FilterMeta, LeadListResult, LeadRow } from "@/server/leads/types";
import { WON_STATUS } from "@/lib/crm/constants";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyRow } from "@/components/ui/empty-state";
import { fmtDate } from "./format";
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
  preset: LeadPreset; title: string; isAdmin: boolean; result: LeadListResult; filter: LeadFilter; meta: FilterMeta; users: UserOption[];
  today: string; openCreate?: boolean;
};

const ASSIGNMENT_FILTER_PRESETS: LeadPreset[] = ["all", "assigned", "new", "trending", "won"];
const HREF: Record<LeadPreset, string> = {
  all: "/crm/lead-management", new: "/crm/new-leads", assigned: "/crm/assigned-leads", unassigned: "/crm/unassigned-leads",
  trending: "/crm/trending-leads", won: "/crm/won-leads", mine: "/crm/my-leads", myTrending: "/crm/my-trending-leads",
  conversions: "/crm/conversions", today: "/crm/today-followups", upcoming: "/crm/upcoming-followups",
};
const DESCRIPTION: Record<LeadPreset, string> = {
  all: "Every lead you are authorised to see.",
  new: "Leads created in the last 24 hours.",
  assigned: "Leads with at least one assignee.",
  unassigned: "Leads waiting to be assigned to the team.",
  trending: "Leads currently In Progress.",
  won: "Leads marked Won Lead.",
  mine: "Leads assigned to you.",
  myTrending: "Your leads that are In Progress.",
  conversions: "Your leads marked Won Lead.",
  today: "Your leads with a follow-up due today (IST).",
  upcoming: "Your leads with a follow-up from tomorrow onwards.",
};
/** Related views shown as a segmented switcher. Admin pipeline views are only offered to admins. */
const VIEW_SETS: { admin?: boolean; items: [LeadPreset, string][] }[] = [
  { admin: true, items: [["all", "All"], ["new", "New"], ["assigned", "Assigned"], ["unassigned", "Unassigned"], ["trending", "Trending"], ["won", "Won"]] },
  { items: [["mine", "All my leads"], ["myTrending", "Trending"], ["conversions", "Won"]] },
  { items: [["today", "Due today"], ["upcoming", "Upcoming"]] },
];
const FILTER_LABELS: Record<string, string> = {
  category: "Category", location: "Location", state: "State", dataType: "Data type", fileName: "File", status: "Status", callStatus: "Call status", assignedTo: "Assigned to",
};
const CLOSED = new Set([WON_STATUS, "Lost Lead"]);
const initials = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");

function FollowUp({ row, today }: { row: LeadRow; today: string }) {
  if (!row.followUpDate) return <span className="muted">—</span>;
  const day = new Date(new Date(row.followUpDate).getTime() + 5.5 * 3_600_000).toISOString().slice(0, 10);
  const open = !CLOSED.has(row.status);
  const tone = !open ? null : day < today ? "danger" : day === today ? "warning" : null;
  return (
    <span style={{ display: "inline-flex", flexDirection: "column", gap: 2 }}>
      <span style={{ fontVariantNumeric: "tabular-nums" }}>{fmtDate(row.followUpDate)}</span>
      {tone ? <StatusBadge value={tone === "danger" ? "Overdue" : "Due today"} tone={tone} /> : null}
    </span>
  );
}

export function LeadsClient({ preset, title, isAdmin, result, filter, meta, users, today, openCreate }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [modal, setModal] = useState<ModalState | null>(openCreate ? { kind: "add" } : null);
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

  // A quick-create deep link (?create=lead) is consumed once: closing drops it from the URL.
  const close = () => {
    setModal(null);
    if (openCreate) { const qs = filterToParams(filter).toString(); router.replace((qs ? `${pathname}?${qs}` : pathname) as Route, { scroll: false }); }
  };
  const done = () => { close(); setSelected(new Set()); router.refresh(); };
  const ids = [...selected];
  const filterCount = activeFilterCount(filter) + (filter.from || filter.to ? 1 : 0);
  const filtered = preset !== "all" || Boolean(filter.q) || filterCount > 0;
  const allOnPage = result.rows.length > 0 && result.rows.every((r) => selected.has(r.id));
  const someOnPage = !allOnPage && result.rows.some((r) => selected.has(r.id));
  const first = result.total === 0 ? 0 : (result.page - 1) * result.pageSize + 1;
  const last = Math.min(result.total, result.page * result.pageSize);
  const views = VIEW_SETS.find((v) => v.items.some(([p]) => p === preset) && (isAdmin || !v.admin));
  const cols = isAdmin ? 9 : 8;

  // Active filter chips: one per filtered dimension, each removable on its own.
  const chips: { key: string; label: string; clear: LeadFilter }[] = [];
  for (const [k, label] of Object.entries(FILTER_LABELS)) {
    const vals = filter[k as keyof LeadFilter] as string[] | undefined;
    if (!vals?.length) continue;
    const shown = k === "assignedTo" ? vals.map((id) => users.find((u) => u.id === id)?.name ?? "user") : vals.map((v) => (v === "" ? "(blank)" : v));
    chips.push({ key: k, label: `${label}: ${shown.slice(0, 2).join(", ")}${shown.length > 2 ? ` +${shown.length - 2}` : ""}`, clear: { ...filter, [k]: undefined } });
  }
  if (filter.assigned) chips.push({ key: "assigned", label: filter.assigned === "assigned" ? "Assigned only" : "Unassigned only", clear: { ...filter, assigned: undefined } });
  if (filter.from || filter.to) {
    chips.push({
      key: "dates", label: `${filter.dateType === "followUpDate" ? "Follow-up" : "Entry date"}: ${filter.from ?? "…"} → ${filter.to ?? "…"}`,
      clear: { ...filter, from: undefined, to: undefined, dateType: undefined },
    });
  }

  return (
    <>
      <PageHeader
        title={title}
        description={<>{DESCRIPTION[preset]} <span style={{ color: "var(--text-2)", fontWeight: 550 }}>{result.total.toLocaleString("en-IN")} {result.total === 1 ? "lead" : "leads"}</span></>}
        actions={<>
          <button type="button" className="button secondary" onClick={() => setModal({ kind: "products" })}><Package size={15} aria-hidden="true" />Products</button>
          <button type="button" className="button secondary" onClick={() => setModal({ kind: "download" })}><Download size={15} aria-hidden="true" />Export</button>
          <button type="button" className="button" onClick={() => setModal({ kind: "add" })}><Plus size={15} aria-hidden="true" />Add lead</button>
        </>}
      />

      {views && views.items.length > 1 ? (
        <nav className="segmented" aria-label="Lead views" style={{ maxWidth: "100%", overflowX: "auto" }}>
          {views.items.map(([p, label]) => (
            <Link key={p} href={HREF[p] as Route} aria-current={p === preset ? "page" : undefined}>{label}</Link>
          ))}
        </nav>
      ) : null}

      <section className="table-card">
        <div className={styles.toolbar}>
          <form className="search-input" role="search" onSubmit={(e) => { e.preventDefault(); go({ filter: { ...filter, q: q.trim() || undefined } }); }}>
            <Search size={15} aria-hidden="true" />
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, company, phone, email…  (Enter)" aria-label="Search leads" />
          </form>
          <button type="button" className={`button secondary${filterCount ? ` ${styles.filterOn}` : ""}`} onClick={() => setModal({ kind: "filter" })} aria-haspopup="dialog">
            <ListFilter size={15} aria-hidden="true" />Filters{filterCount ? <span className={styles.count}>{filterCount}</span> : null}
          </button>
        </div>

        {chips.length || filter.q ? (
          <div className={styles.chips} aria-label="Active filters">
            {filter.q ? (
              <button type="button" className={styles.chip} onClick={() => { setQ(""); go({ filter: { ...filter, q: undefined } }); }} aria-label={`Remove search ${filter.q}`}>
                Search: “{filter.q}”<X size={12} aria-hidden="true" />
              </button>
            ) : null}
            {chips.map((c) => (
              <button key={c.key} type="button" className={styles.chip} onClick={() => go({ filter: c.clear })} aria-label={`Remove filter ${c.label}`}>
                {c.label}<X size={12} aria-hidden="true" />
              </button>
            ))}
            <button type="button" className="button ghost small" onClick={() => { setQ(""); go({ filter: {} }); }}>Clear all</button>
          </div>
        ) : null}

        {isAdmin && (selected.size > 0 || (filtered && result.total > 0)) ? (
          <div className={styles.bulkBar} role="region" aria-label="Bulk actions">
            {selected.size > 0 ? (
              <>
                <strong>{selected.size} selected</strong>
                <span className={styles.bulkSep} aria-hidden="true" />
                <button type="button" className="button small" onClick={() => setModal({ kind: "assign" })}><UserPlus size={14} aria-hidden="true" />Assign</button>
                <button type="button" className="button secondary small" onClick={() => setModal({ kind: "transfer" })}><ArrowRightLeft size={14} aria-hidden="true" />Transfer</button>
                <button type="button" className="button secondary small" onClick={() => setModal({ kind: "remove" })}><UserMinus size={14} aria-hidden="true" />Unassign</button>
                <button type="button" className="button secondary small" onClick={() => setModal({ kind: "bulkUpdate" })}><SquarePen size={14} aria-hidden="true" />Bulk update</button>
                <button type="button" className="button secondary small danger" onClick={() => setModal({ kind: "deleteSelected" })}><Trash2 size={14} aria-hidden="true" />Delete</button>
                <button type="button" className="button ghost small" onClick={() => setSelected(new Set())}>Clear selection</button>
              </>
            ) : <span className="muted">Select rows to assign, transfer or update them.</span>}
            {filtered && result.total > 0 && !(preset === "all" && !filter.q && filterCount === 0) ? (
              <button type="button" className="button secondary small danger" style={{ marginLeft: "auto" }} onClick={() => setModal({ kind: "deleteFiltered" })}>
                Delete all {result.total.toLocaleString("en-IN")} matching
              </button>
            ) : null}
          </div>
        ) : null}

        <div className="table-scroll">
          <table className={styles.grid}>
            <thead>
              <tr>
                {isAdmin ? (
                  <th style={{ width: 40 }}>
                    <input
                      type="checkbox" aria-label="Select all leads on this page" checked={allOnPage}
                      ref={(el) => { if (el) el.indeterminate = someOnPage; }}
                      onChange={(e) => setSelected(e.target.checked ? new Set(result.rows.map((r) => r.id)) : new Set())}
                    />
                  </th>
                ) : null}
                <th>Lead</th><th>Contact</th><th>Status</th><th>Call status</th><th>Follow-up</th><th>Assigned to</th><th>Entry date</th>
                <th style={{ width: 1 }}><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {result.rows.map((row) => (
                <tr key={row.id} className={selected.has(row.id) ? styles.selected : undefined}>
                  {isAdmin ? (
                    <td>
                      <input type="checkbox" aria-label={`Select ${row.name ?? row.phone ?? "lead"}`} checked={selected.has(row.id)}
                        onChange={(e) => setSelected((prev) => { const n = new Set(prev); if (e.target.checked) n.add(row.id); else n.delete(row.id); return n; })} />
                    </td>
                  ) : null}
                  <td className={styles.leadCell}>
                    <button type="button" className={styles.leadName} onClick={() => setModal({ kind: "view", id: row.id })}>{row.name || "Unnamed lead"}</button>
                    <span className="sub">{[row.company, row.location].filter(Boolean).join(" · ") || "—"}</span>
                  </td>
                  <td>
                    <span style={{ fontVariantNumeric: "tabular-nums" }}>{row.phone || row.contact || "—"}</span>
                    {row.email ? <span className="sub" style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.email}</span> : null}
                  </td>
                  <td><StatusBadge value={row.status} kind="lead" /></td>
                  <td><StatusBadge value={row.callStatus} kind="call" dot={false} /></td>
                  <td><FollowUp row={row} today={today} /></td>
                  <td>
                    {row.assignees.length ? (
                      <span className={styles.assignees} title={row.assignees.map((a) => a.name).join(", ")}>
                        <span className="avatar sm" aria-hidden="true">{initials(row.assignees[0]!.name)}</span>
                        <span>{row.assignees[0]!.name}{row.assignees.length > 1 ? <span className="muted"> +{row.assignees.length - 1}</span> : null}</span>
                      </span>
                    ) : <span className="muted">Unassigned</span>}
                  </td>
                  <td className="muted" title={row.createdAt} style={{ whiteSpace: "nowrap" }}>{fmtDate(row.createdAt)}</td>
                  <td>
                    <div className="row-actions">
                      <button type="button" className="icon-btn" onClick={() => setModal({ kind: "view", id: row.id })} aria-label={`View ${row.name ?? "lead"}`} title="View"><Eye size={15} /></button>
                      {row.canUpdate ? <button type="button" className="icon-btn" onClick={() => setModal({ kind: "edit", id: row.id })} aria-label={`Edit ${row.name ?? "lead"}`} title="Edit"><Pencil size={15} /></button> : null}
                      {isAdmin ? <button type="button" className={`icon-btn ${styles.dangerIcon}`} onClick={() => setModal({ kind: "deleteOne", id: row.id })} aria-label={`Delete ${row.name ?? "lead"}`} title="Delete"><Trash2 size={15} /></button> : null}
                    </div>
                  </td>
                </tr>
              ))}
              {result.rows.length === 0 ? (
                <EmptyRow
                  colSpan={cols} title={filtered ? "No leads match this view" : "No leads yet"}
                  description={filtered ? "Try removing a filter or searching for something else." : "Add a lead or import a CSV to get started."}
                  action={filterCount || filter.q ? <button type="button" className="button secondary small" onClick={() => { setQ(""); go({ filter: {} }); }}>Clear filters</button> : undefined}
                />
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="table-foot">
          <span>{first.toLocaleString("en-IN")}–{last.toLocaleString("en-IN")} of {result.total.toLocaleString("en-IN")}</span>
          <div className="pager">
            <label htmlFor="page-size">Rows per page</label>
            <select id="page-size" value={result.pageSize} onChange={(e) => go({ pageSize: Number(e.target.value) })}>
              {PAGE_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <span style={{ margin: "0 6px" }}>Page {result.page} of {Math.max(1, result.pages)}</span>
            <button type="button" className="icon-btn bordered" disabled={result.page <= 1} onClick={() => go({ page: 1 })} aria-label="First page"><ChevronsLeft size={15} /></button>
            <button type="button" className="icon-btn bordered" disabled={result.page <= 1} onClick={() => go({ page: result.page - 1 })} aria-label="Previous page"><ChevronLeft size={15} /></button>
            <button type="button" className="icon-btn bordered" disabled={result.page >= result.pages} onClick={() => go({ page: result.page + 1 })} aria-label="Next page"><ChevronRight size={15} /></button>
            <button type="button" className="icon-btn bordered" disabled={result.page >= result.pages} onClick={() => go({ page: result.pages })} aria-label="Last page"><ChevronsRight size={15} /></button>
          </div>
        </div>
      </section>

      {modal?.kind === "view" ? (
        <ViewLeadModal
          id={modal.id} onClose={close}
          onEdit={result.rows.find((r) => r.id === modal.id)?.canUpdate ? () => setModal({ kind: "edit", id: modal.id }) : undefined}
        />
      ) : null}
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
        <ConfirmModal title="Remove assignments" confirmLabel="Remove assignments" onClose={close}
          message={`Remove every assignee from ${ids.length} selected lead(s)? They become unassigned.`}
          onConfirm={async () => { const r = await removeAssignmentsAction(ids); if (r.ok) { toast.success(`Unassigned ${r.leads} lead(s).`); done(); } return r; }} />
      ) : null}
      {modal?.kind === "deleteSelected" ? (
        <ConfirmModal title="Delete leads" confirmLabel={`Delete ${ids.length} lead${ids.length === 1 ? "" : "s"}`} destructive onClose={close}
          message={`Permanently delete ${ids.length} selected lead(s)? This cannot be undone.`}
          onConfirm={async () => { const r = await deleteLeadsAction(ids); if (r.ok) { toast.success(`Deleted ${r.deleted} lead(s).`); done(); } return r; }} />
      ) : null}
      {modal?.kind === "deleteOne" ? (
        <ConfirmModal title="Delete lead" confirmLabel="Delete lead" destructive onClose={close}
          message="Permanently delete this lead? This cannot be undone."
          onConfirm={async () => { const r = await deleteLeadsAction([modal.id]); if (r.ok) { toast.success("Lead deleted."); done(); } return r; }} />
      ) : null}
      {modal?.kind === "deleteFiltered" ? (
        <ConfirmModal title="Delete all matching leads" confirmLabel={`Delete ${result.total} leads`} destructive onClose={close}
          message={`Permanently delete all ${result.total} leads matching the current view and filters (not just this page)? This cannot be undone.`}
          onConfirm={async () => { const r = await deleteAllFilteredAction(filterToParams(filter).toString(), preset); if (r.ok) { toast.success(`Deleted ${r.deleted} lead(s).`); done(); } return r; }} />
      ) : null}
    </>
  );
}
