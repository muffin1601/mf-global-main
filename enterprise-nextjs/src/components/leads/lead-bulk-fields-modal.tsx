"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Modal } from "@/components/ui/modal";
import { CALL_STATUSES, LEAD_PRIORITIES, LEAD_STATUSES } from "@/lib/crm/constants";
import { bulkSetFieldsAction } from "@/app/(crm)/crm/lead-management/actions";

/** Bulk-set status, call status, priority and add tags. Status changes are recorded in each lead's history. */
export function BulkFieldsModal({ leadIds, onClose, onDone }: { leadIds: string[]; onClose: () => void; onDone: () => void }) {
  const [status, setStatus] = useState("");
  const [callStatus, setCallStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [tags, setTags] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const addTags = tags.split(",").map((t) => t.trim()).filter(Boolean);

  const apply = async () => {
    if (!status && !callStatus && !priority && !addTags.length) { setError("Choose at least one change."); return; }
    setBusy(true); setError("");
    let r: Awaited<ReturnType<typeof bulkSetFieldsAction>>;
    try { r = await bulkSetFieldsAction(leadIds, { status, callStatus, priority, addTags }); }
    catch { setError("The update could not be sent. Check your connection and try again."); return; }
    finally { setBusy(false); }
    if (!r.ok) { setError(r.error); return; }
    toast.success(`Updated ${r.updated} lead(s)${r.statusChanged ? `; ${r.statusChanged} status change(s) recorded` : ""}.`);
    onDone();
  };

  return (
    <Modal title="Update status, priority & tags" description={`${leadIds.length} selected lead(s). Leave a field unchanged to keep each lead's current value.`}
      onClose={onClose} busy={busy}
      footer={<>
        <button type="button" className="button secondary" onClick={onClose} disabled={busy}>Cancel</button>
        <button type="button" className="button" onClick={apply} disabled={busy}>{busy ? "Updating…" : "Apply"}</button>
      </>}>
      <div className="form-grid cols-2">
        <div className="field">
          <label htmlFor="bf-status">Status</label>
          <select id="bf-status" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Keep current</option>{LEAD_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="bf-call">Call status</label>
          <select id="bf-call" value={callStatus} onChange={(e) => setCallStatus(e.target.value)}>
            <option value="">Keep current</option>{CALL_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="bf-priority">Priority</label>
          <select id="bf-priority" value={priority} onChange={(e) => setPriority(e.target.value)}>
            <option value="">Keep current</option>{LEAD_PRIORITIES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="bf-tags">Add tags</label>
          <input id="bf-tags" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Comma separated, e.g. expo, q4" />
          <span className="hint">Added to existing tags; nothing is removed.</span>
        </div>
        {error ? <p className="error" role="alert" style={{ gridColumn: "1 / -1", margin: 0 }}>{error}</p> : null}
      </div>
    </Modal>
  );
}
