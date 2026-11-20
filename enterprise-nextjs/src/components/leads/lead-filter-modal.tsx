"use client";

import { useState } from "react";
import { CALL_STATUSES, LEAD_PRIORITIES, LEAD_STATUSES } from "@/lib/crm/constants";
import type { LeadDateType, LeadFilter } from "@/server/leads/filter-schema";
import type { FilterMeta } from "@/server/leads/types";
import styles from "./leads.module.css";
import { Modal } from "./modal";
import type { UserOption } from "./lead-form-modal";

type ListField = "category" | "location" | "state" | "dataType" | "fileName" | "status" | "callStatus" | "priority" | "tag" | "assignedTo";
type Option = { value: string; label: string };

function CheckGroup({ title, options, selected, onChange }: { title: string; options: Option[]; selected: string[]; onChange: (next: string[]) => void }) {
  const [q, setQ] = useState("");
  const shown = options.filter((o) => o.label.toLowerCase().includes(q.toLowerCase()));
  const toggle = (value: string) => onChange(selected.includes(value) ? selected.filter((x) => x !== value) : [...selected, value]);
  return (
    <fieldset style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
      <legend className={styles.groupHead}>
        <span>{title}</span>
        {selected.length ? <button type="button" className="button ghost small" onClick={() => onChange([])} aria-label={`Clear ${title}`}>Clear ({selected.length})</button> : null}
      </legend>
      {options.length > 8 ? <input className={styles.mini} type="search" placeholder={`Search ${title.toLowerCase()}…`} value={q} onChange={(e) => setQ(e.target.value)} aria-label={`Search ${title}`} /> : null}
      <div className={styles.checklist}>
        {shown.length === 0 ? <span className={styles.muted} style={{ padding: 6 }}>No values.</span> : null}
        {shown.map((o) => (
          <label key={o.value}><input type="checkbox" checked={selected.includes(o.value)} onChange={() => toggle(o.value)} />{o.label}</label>
        ))}
      </div>
    </fieldset>
  );
}

const withBlank = (values: string[]): Option[] => values.map((v) => ({ value: v, label: v === "" ? "(blank)" : v }));

export function FilterModal({ filter, meta, users, isAdmin, showAssignment, onApply, onClose }: {
  filter: LeadFilter; meta: FilterMeta; users: UserOption[]; isAdmin: boolean; showAssignment: boolean;
  onApply: (next: LeadFilter) => void; onClose: () => void;
}) {
  const [draft, setDraft] = useState<LeadFilter>(filter);
  const [dateError, setDateError] = useState("");
  const list = (f: ListField) => draft[f] ?? [];
  const setList = (f: ListField) => (next: string[]) => setDraft((d) => ({ ...d, [f]: next.length ? next : undefined }));
  const apply = () => {
    if (draft.from && draft.to && draft.from > draft.to) { setDateError("The start date must not be after the end date."); return; }
    onApply({ ...draft, dateType: draft.from || draft.to ? draft.dateType ?? "createdAt" : undefined });
  };
  return (
    <Modal
      title="Filter leads" description="Combine filters; leads must match every selected group. Within a group, any value matches."
      onClose={onClose} wide
      footer={
        <>
          <button type="button" className="button ghost" onClick={() => onApply({ q: draft.q })}>Clear all filters</button>
          <span style={{ flex: 1 }} />
          <button type="button" className="button secondary" onClick={onClose}>Cancel</button>
          <button type="button" className="button" onClick={apply}>Apply filters</button>
        </>
      }
    >
      <fieldset style={{ border: 0, padding: 0, margin: "0 0 18px" }}>
        <legend style={{ fontSize: ".8125rem", fontWeight: 600, marginBottom: 8 }}>Date range</legend>
        <div className="form-grid cols-3">
          <div className="field">
            <label htmlFor="flt-dt">Date field</label>
            <select id="flt-dt" value={draft.dateType ?? "createdAt"} onChange={(e) => setDraft((d) => ({ ...d, dateType: e.target.value as LeadDateType }))}>
              <option value="createdAt">Entry date (created)</option>
              <option value="followUpDate">Follow-up date</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="flt-from">From</label>
            <input id="flt-from" type="date" value={draft.from ?? ""} aria-invalid={!!dateError} onChange={(e) => { setDateError(""); setDraft((d) => ({ ...d, from: e.target.value || undefined })); }} />
          </div>
          <div className="field">
            <label htmlFor="flt-to">To</label>
            <input id="flt-to" type="date" value={draft.to ?? ""} aria-invalid={!!dateError} onChange={(e) => { setDateError(""); setDraft((d) => ({ ...d, to: e.target.value || undefined })); }} />
          </div>
        </div>
        <p className="hint" style={{ margin: "6px 0 0" }}>Inclusive, Asia/Kolkata days. Leave both empty for any date.</p>
        {dateError ? <p className="error" role="alert" style={{ margin: "4px 0 0" }}>{dateError}</p> : null}
      </fieldset>

      <div className={styles.filterGroups}>
        <CheckGroup title="Status" options={LEAD_STATUSES.map((s) => ({ value: s, label: s }))} selected={list("status")} onChange={setList("status")} />
        <CheckGroup title="Call status" options={CALL_STATUSES.map((s) => ({ value: s, label: s }))} selected={list("callStatus")} onChange={setList("callStatus")} />
        <CheckGroup title="Priority" options={[{ value: "", label: "(not set)" }, ...LEAD_PRIORITIES.map((p) => ({ value: p, label: p }))]} selected={list("priority")} onChange={setList("priority")} />
        {meta.tags.length ? <CheckGroup title="Tags" options={meta.tags.map((t) => ({ value: t, label: t }))} selected={list("tag")} onChange={setList("tag")} /> : null}
        <CheckGroup title="Category" options={withBlank(meta.categories)} selected={list("category")} onChange={setList("category")} />
        <CheckGroup title="Data type" options={withBlank(meta.dataTypes)} selected={list("dataType")} onChange={setList("dataType")} />
        <CheckGroup title="Location" options={withBlank(meta.locations)} selected={list("location")} onChange={setList("location")} />
        <CheckGroup title="State" options={withBlank(meta.states)} selected={list("state")} onChange={setList("state")} />
        <CheckGroup title="File name" options={withBlank(meta.fileNames)} selected={list("fileName")} onChange={setList("fileName")} />
        {isAdmin && showAssignment ? (
          <>
            <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
              <legend className={styles.groupHead}><span>Assignment</span></legend>
              <div className={styles.radioRow} style={{ flexDirection: "column", gap: 8 }}>
                {([["", "Any"], ["assigned", "Assigned"], ["unassigned", "Unassigned"]] as const).map(([val, label]) => (
                  <label key={val}><input type="radio" name="assigned" checked={(draft.assigned ?? "") === val} onChange={() => setDraft((d) => ({ ...d, assigned: val || undefined }))} />{label}</label>
                ))}
              </div>
            </fieldset>
            <CheckGroup title="Assigned to" options={users.map((u) => ({ value: u.id, label: u.name }))} selected={list("assignedTo")} onChange={setList("assignedTo")} />
          </>
        ) : null}
      </div>
    </Modal>
  );
}
