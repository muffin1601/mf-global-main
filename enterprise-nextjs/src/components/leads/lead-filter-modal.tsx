"use client";

import { useState } from "react";
import { CALL_STATUSES, LEAD_STATUSES } from "@/lib/crm/constants";
import type { LeadFilter } from "@/server/leads/filter-schema";
import type { FilterMeta } from "@/server/leads/types";
import styles from "./leads.module.css";
import { Modal } from "./modal";
import type { UserOption } from "./lead-form-modal";

type ListField = "category" | "location" | "state" | "dataType" | "fileName" | "status" | "callStatus" | "assignedTo";
type Option = { value: string; label: string };

function CheckGroup({ title, options, selected, onChange }: { title: string; options: Option[]; selected: string[]; onChange: (next: string[]) => void }) {
  const [q, setQ] = useState("");
  const shown = options.filter((o) => o.label.toLowerCase().includes(q.toLowerCase()));
  const toggle = (value: string) => onChange(selected.includes(value) ? selected.filter((x) => x !== value) : [...selected, value]);
  return (
    <div>
      <h3>{title}{selected.length ? ` (${selected.length})` : ""}</h3>
      {options.length > 8 ? <input className={styles.mini} placeholder={`Search ${title.toLowerCase()}…`} value={q} onChange={(e) => setQ(e.target.value)} /> : null}
      <div className={styles.checklist}>
        {shown.length === 0 ? <span className={styles.muted}>No values.</span> : null}
        {shown.map((o) => (
          <label key={o.value}><input type="checkbox" checked={selected.includes(o.value)} onChange={() => toggle(o.value)} />{o.label}</label>
        ))}
      </div>
    </div>
  );
}

const withBlank = (values: string[]): Option[] => values.map((v) => ({ value: v, label: v === "" ? "(blank)" : v }));

export function FilterModal({ filter, meta, users, isAdmin, showAssignment, onApply, onClose }: {
  filter: LeadFilter; meta: FilterMeta; users: UserOption[]; isAdmin: boolean; showAssignment: boolean;
  onApply: (next: LeadFilter) => void; onClose: () => void;
}) {
  const [draft, setDraft] = useState<LeadFilter>(filter);
  const list = (f: ListField) => draft[f] ?? [];
  const setList = (f: ListField) => (next: string[]) => setDraft((d) => ({ ...d, [f]: next.length ? next : undefined }));
  return (
    <Modal
      title="Filter leads" onClose={onClose} wide
      footer={
        <>
          <button type="button" className="button secondary" onClick={() => onApply({ q: draft.q })}>Clear filters</button>
          <button type="button" className="button" onClick={() => onApply(draft)}>Apply filters</button>
        </>
      }
    >
      <div className={styles.filterGroups}>
        <CheckGroup title="Category" options={withBlank(meta.categories)} selected={list("category")} onChange={setList("category")} />
        <CheckGroup title="Location" options={withBlank(meta.locations)} selected={list("location")} onChange={setList("location")} />
        <CheckGroup title="State" options={withBlank(meta.states)} selected={list("state")} onChange={setList("state")} />
        <CheckGroup title="Data type" options={withBlank(meta.dataTypes)} selected={list("dataType")} onChange={setList("dataType")} />
        <CheckGroup title="File name" options={withBlank(meta.fileNames)} selected={list("fileName")} onChange={setList("fileName")} />
        <CheckGroup title="Status" options={LEAD_STATUSES.map((s) => ({ value: s, label: s }))} selected={list("status")} onChange={setList("status")} />
        <CheckGroup title="Call status" options={CALL_STATUSES.map((s) => ({ value: s, label: s }))} selected={list("callStatus")} onChange={setList("callStatus")} />
        {isAdmin && showAssignment ? (
          <>
            <div>
              <h3>Assignment</h3>
              <div className={styles.radioRow}>
                {([["", "Any"], ["assigned", "Assigned"], ["unassigned", "Unassigned"]] as const).map(([val, label]) => (
                  <label key={val}><input type="radio" name="assigned" checked={(draft.assigned ?? "") === val} onChange={() => setDraft((d) => ({ ...d, assigned: val || undefined }))} />{label}</label>
                ))}
              </div>
            </div>
            <CheckGroup title="Assigned to" options={users.map((u) => ({ value: u.id, label: u.name }))} selected={list("assignedTo")} onChange={setList("assignedTo")} />
          </>
        ) : null}
      </div>
    </Modal>
  );
}
