"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { AlertTriangle, Search } from "lucide-react";
import { assignLeadsAction, bulkUpdateAction, transferAssignmentsAction, type ActionResult } from "@/app/(crm)/crm/lead-management/actions";
import styles from "./leads.module.css";
import type { UserOption } from "./lead-form-modal";
import { Modal } from "./modal";

type Done = () => void;

export function ConfirmModal({ title, message, confirmLabel, onConfirm, onClose, destructive }: {
  title: string; message: React.ReactNode; confirmLabel: string; onConfirm: () => Promise<ActionResult<object>>; onClose: () => void; destructive?: boolean;
}) {
  const [pending, start] = useTransition();
  return (
    <Modal
      title={title} onClose={onClose} busy={pending}
      footer={
        <>
          <button type="button" className="button secondary" onClick={onClose} disabled={pending} data-autofocus>Cancel</button>
          <button
            type="button" className={`button${destructive ? " danger" : ""}`} disabled={pending}
            onClick={() => start(async () => { const r = await onConfirm(); if (!r.ok) toast.error(r.error); else onClose(); })}
          >{pending ? "Working…" : confirmLabel}</button>
        </>
      }
    >
      <div style={{ display: "flex", gap: 12 }}>
        {destructive ? <span className="kpi-icon tone-danger" aria-hidden="true" style={{ width: 36, height: 36 }}><AlertTriangle size={18} /></span> : null}
        <p style={{ margin: 0, color: "var(--text-2)" }}>{message}</p>
      </div>
    </Modal>
  );
}

/** Filterable list of employees (large teams stay usable). Single or multi select. */
function UserPicker({ users, picked, onToggle, multi, name }: { users: UserOption[]; picked: string[]; onToggle: (id: string) => void; multi: boolean; name: string }) {
  const [q, setQ] = useState("");
  const shown = users.filter((u) => u.name.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <div className="search-input">
        <Search size={15} aria-hidden="true" />
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search employees…" aria-label="Search employees" />
      </div>
      <div className={styles.checklist} style={{ maxHeight: 240 }} role="group" aria-label="Employees">
        {shown.length === 0 ? <span className={styles.muted} style={{ padding: 6 }}>{users.length ? "No matching employees." : "No users available."}</span> : null}
        {shown.map((u) => (
          <label key={u.id}>
            <input type={multi ? "checkbox" : "radio"} name={name} checked={picked.includes(u.id)} onChange={() => onToggle(u.id)} />
            <span className="avatar sm" aria-hidden="true">{u.name.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("")}</span>
            {u.name}
          </label>
        ))}
      </div>
    </div>
  );
}

export function AssignModal({ leadIds, users, onClose, onDone }: { leadIds: string[]; users: UserOption[]; onClose: () => void; onDone: Done }) {
  const [picked, setPicked] = useState<string[]>([]);
  const [level, setLevel] = useState<"view" | "update">("update");
  const [pending, start] = useTransition();
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  return (
    <Modal
      title={`Assign ${leadIds.length} lead${leadIds.length === 1 ? "" : "s"}`}
      description="Selected users are added to the leads; existing assignees keep their access."
      onClose={onClose} busy={pending}
      footer={
        <>
          <button type="button" className="button secondary" onClick={onClose} disabled={pending}>Cancel</button>
          <button
            type="button" className="button" disabled={pending || picked.length === 0}
            onClick={() => start(async () => {
              const r = await assignLeadsAction(leadIds, picked, level);
              if (!r.ok) { toast.error(r.error); return; }
              toast.success(`Assigned ${r.leads} lead(s) to ${r.users} user(s).`);
              onDone();
            })}
          >{pending ? "Assigning…" : picked.length ? `Assign to ${picked.length} user${picked.length === 1 ? "" : "s"}` : "Assign"}</button>
        </>
      }
    >
      <div className="form-grid">
        <UserPicker users={users} picked={picked} onToggle={toggle} multi name="assign-user" />
        <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="field" style={{ fontSize: ".8125rem", fontWeight: 500, color: "var(--text-2)", marginBottom: 6 }}>Access level</legend>
          <div className={styles.choiceGrid}>
            <label className={styles.choice}><input type="radio" name="level" checked={level === "update"} onChange={() => setLevel("update")} /><span><strong>View and update</strong><span>Can edit the lead and its follow-ups</span></span></label>
            <label className={styles.choice}><input type="radio" name="level" checked={level === "view"} onChange={() => setLevel("view")} /><span><strong>View only</strong><span>Read-only access</span></span></label>
          </div>
        </fieldset>
      </div>
    </Modal>
  );
}

export function TransferModal({ leadIds, users, onClose, onDone }: { leadIds: string[]; users: UserOption[]; onClose: () => void; onDone: Done }) {
  const [target, setTarget] = useState("");
  const [pending, start] = useTransition();
  return (
    <Modal
      title={`Transfer ${leadIds.length} lead${leadIds.length === 1 ? "" : "s"}`}
      description="All current assignees are replaced by the selected user, who gets view and update access."
      onClose={onClose} busy={pending}
      footer={
        <>
          <button type="button" className="button secondary" onClick={onClose} disabled={pending}>Cancel</button>
          <button
            type="button" className="button" disabled={pending || !target}
            onClick={() => start(async () => {
              const r = await transferAssignmentsAction(leadIds, target);
              if (!r.ok) { toast.error(r.error); return; }
              toast.success(`Transferred ${r.leads} lead(s).`);
              onDone();
            })}
          >{pending ? "Transferring…" : "Transfer"}</button>
        </>
      }
    >
      <UserPicker users={users} picked={target ? [target] : []} onToggle={setTarget} multi={false} name="transfer-user" />
    </Modal>
  );
}

export function BulkUpdateModal({ leadIds, onClose, onDone }: { leadIds: string[]; onClose: () => void; onDone: Done }) {
  const [category, setCategory] = useState(""), [location, setLocation] = useState("");
  const [pending, start] = useTransition();
  return (
    <Modal
      title={`Bulk update ${leadIds.length} lead${leadIds.length === 1 ? "" : "s"}`}
      description="Leave a field empty to keep its current value."
      onClose={onClose} busy={pending}
      footer={
        <>
          <button type="button" className="button secondary" onClick={onClose} disabled={pending}>Cancel</button>
          <button
            type="button" className="button" disabled={pending || (!category.trim() && !location.trim())}
            onClick={() => start(async () => {
              const r = await bulkUpdateAction(leadIds, category, location);
              if (!r.ok) { toast.error(r.error); return; }
              toast.success(`Updated ${r.updated} lead(s).`);
              onDone();
            })}
          >{pending ? "Updating…" : "Apply changes"}</button>
        </>
      }
    >
      <div className="form-grid cols-2">
        <div className="field"><label htmlFor="bu-cat">Category</label><input id="bu-cat" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Keep current" /></div>
        <div className="field"><label htmlFor="bu-loc">Location</label><input id="bu-loc" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Keep current" /></div>
      </div>
    </Modal>
  );
}
