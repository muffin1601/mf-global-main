"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { assignLeadsAction, bulkUpdateAction, transferAssignmentsAction, type ActionResult } from "@/app/(crm)/crm/lead-management/actions";
import styles from "./leads.module.css";
import type { UserOption } from "./lead-form-modal";
import { Modal } from "./modal";

type Done = () => void;

export function ConfirmModal({ title, message, confirmLabel, onConfirm, onClose }: {
  title: string; message: React.ReactNode; confirmLabel: string; onConfirm: () => Promise<ActionResult<object>>; onClose: () => void;
}) {
  const [pending, start] = useTransition();
  return (
    <Modal
      title={title} onClose={onClose}
      footer={
        <>
          <button type="button" className="button secondary" onClick={onClose}>Cancel</button>
          <button
            type="button" className="button" disabled={pending}
            onClick={() => start(async () => { const r = await onConfirm(); if (!r.ok) toast.error(r.error); else onClose(); })}
          >{pending ? "Working…" : confirmLabel}</button>
        </>
      }
    >
      <p>{message}</p>
    </Modal>
  );
}

export function AssignModal({ leadIds, users, onClose, onDone }: { leadIds: string[]; users: UserOption[]; onClose: () => void; onDone: Done }) {
  const [picked, setPicked] = useState<string[]>([]);
  const [level, setLevel] = useState<"view" | "update">("update");
  const [pending, start] = useTransition();
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  return (
    <Modal
      title={`Assign ${leadIds.length} lead${leadIds.length === 1 ? "" : "s"}`} onClose={onClose}
      footer={
        <>
          <button type="button" className="button secondary" onClick={onClose}>Cancel</button>
          <button
            type="button" className="button" disabled={pending || picked.length === 0}
            onClick={() => start(async () => {
              const r = await assignLeadsAction(leadIds, picked, level);
              if (!r.ok) { toast.error(r.error); return; }
              toast.success(`Assigned ${r.leads} lead(s) to ${r.users} user(s).`);
              onDone();
            })}
          >{pending ? "Assigning…" : "Assign"}</button>
        </>
      }
    >
      <p className={styles.muted}>Selected users are added to the leads; existing assignees keep their access.</p>
      <div className={styles.checklist} style={{ maxHeight: 220 }}>
        {users.length === 0 ? <span className={styles.muted}>No users available.</span> : null}
        {users.map((u) => <label key={u.id}><input type="checkbox" checked={picked.includes(u.id)} onChange={() => toggle(u.id)} />{u.name}</label>)}
      </div>
      <div className={styles.radioRow} style={{ marginTop: "1rem" }}>
        <label><input type="radio" name="level" checked={level === "view"} onChange={() => setLevel("view")} />View only</label>
        <label><input type="radio" name="level" checked={level === "update"} onChange={() => setLevel("update")} />View and update</label>
      </div>
    </Modal>
  );
}

export function TransferModal({ leadIds, users, onClose, onDone }: { leadIds: string[]; users: UserOption[]; onClose: () => void; onDone: Done }) {
  const [target, setTarget] = useState("");
  const [pending, start] = useTransition();
  return (
    <Modal
      title={`Transfer ${leadIds.length} lead${leadIds.length === 1 ? "" : "s"}`} onClose={onClose}
      footer={
        <>
          <button type="button" className="button secondary" onClick={onClose}>Cancel</button>
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
      <p className={styles.muted}>All current assignees are replaced by the selected user, who gets view and update access.</p>
      <div className="field">
        <label htmlFor="transfer-user">Transfer to</label>
        <select id="transfer-user" value={target} onChange={(e) => setTarget(e.target.value)}>
          <option value="">Select user</option>
          {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
      </div>
    </Modal>
  );
}

export function BulkUpdateModal({ leadIds, onClose, onDone }: { leadIds: string[]; onClose: () => void; onDone: Done }) {
  const [category, setCategory] = useState(""), [location, setLocation] = useState("");
  const [pending, start] = useTransition();
  return (
    <Modal
      title={`Bulk update ${leadIds.length} lead${leadIds.length === 1 ? "" : "s"}`} onClose={onClose}
      footer={
        <>
          <button type="button" className="button secondary" onClick={onClose}>Cancel</button>
          <button
            type="button" className="button" disabled={pending || (!category.trim() && !location.trim())}
            onClick={() => start(async () => {
              const r = await bulkUpdateAction(leadIds, category, location);
              if (!r.ok) { toast.error(r.error); return; }
              toast.success(`Updated ${r.updated} lead(s).`);
              onDone();
            })}
          >{pending ? "Updating…" : "Apply"}</button>
        </>
      }
    >
      <p className={styles.muted}>Leave a field empty to keep its current value.</p>
      <div className="form-grid">
        <div className="field"><label htmlFor="bu-cat">Category</label><input id="bu-cat" value={category} onChange={(e) => setCategory(e.target.value)} /></div>
        <div className="field"><label htmlFor="bu-loc">Location</label><input id="bu-loc" value={location} onChange={(e) => setLocation(e.target.value)} /></div>
      </div>
    </Modal>
  );
}
