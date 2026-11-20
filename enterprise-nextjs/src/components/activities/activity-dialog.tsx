"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { createActivityAction, type ActivityFormValues } from "@/app/(crm)/crm/activities/actions";
import { TYPE_OPTIONS } from "./options";

const PRIORITIES = [["LOW", "Low"], ["MEDIUM", "Medium"], ["HIGH", "High"]] as const;

type User = { id: string; name: string };

/**
 * Button + dialog to log an activity or create a task. Recording a call or email here is a manual
 * record: the CRM does not place calls or send email. "Already done" is the user's explicit choice.
 */
export function LogActivityButton({ leadId, leadLabel, users, currentUserId, defaultType = "CALL", label = "Log activity", variant = "button" }: {
  leadId?: string; leadLabel?: string; users: User[]; currentUserId: string; defaultType?: string; label?: string; variant?: "button" | "secondary";
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={variant === "secondary" ? "button secondary" : "button"} onClick={() => setOpen(true)}>
        <Plus size={15} aria-hidden="true" />{label}
      </button>
      {open ? <ActivityDialog leadId={leadId} leadLabel={leadLabel} users={users} currentUserId={currentUserId} defaultType={defaultType} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

export function ActivityDialog({ leadId, leadLabel, users, currentUserId, defaultType, onClose }: {
  leadId?: string; leadLabel?: string; users: User[]; currentUserId: string; defaultType: string; onClose: () => void;
}) {
  const router = useRouter();
  const id = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [v, setV] = useState<ActivityFormValues>({ type: defaultType, subject: "", body: "", priority: "MEDIUM", dueAt: "", leadId, assigneeId: currentUserId, completed: false, outcome: "" });
  const set = <K extends keyof ActivityFormValues>(k: K, value: ActivityFormValues[K]) => setV((s) => ({ ...s, [k]: value }));
  const isNote = v.type === "NOTE";
  const canAssign = users.length > 1;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!v.subject.trim()) { setError("Enter a subject."); return; }
    if (v.type === "FOLLOW_UP" && !v.dueAt) { setError("A follow-up needs a due date and time."); return; }
    setBusy(true); setError("");
    const r = await createActivityAction({ ...v, dueAt: isNote ? "" : v.dueAt, completed: isNote ? false : v.completed });
    setBusy(false);
    if (!r.ok) { setError(r.error); return; }
    toast.success(isNote ? "Note added." : v.completed ? "Activity logged." : "Activity scheduled.");
    onClose();
    router.refresh();
  };

  return (
    <Modal
      title={leadLabel ? `Log activity · ${leadLabel}` : "New activity"} onClose={onClose} busy={busy}
      description="Records are entered by you. The CRM does not place calls or send email."
      footer={<>
        <button type="button" className="button secondary" onClick={onClose} disabled={busy}>Cancel</button>
        <button type="submit" form={id} className="button" disabled={busy}>{busy ? "Saving…" : "Save"}</button>
      </>}
    >
      <form id={id} onSubmit={submit} className="form-grid cols-2" noValidate>
        <div className="field">
          <label htmlFor={`${id}-type`}>Type</label>
          <select id={`${id}-type`} value={v.type} onChange={(e) => set("type", e.target.value)}>
            {TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <span className="hint">{TYPE_OPTIONS.find((o) => o.value === v.type)?.hint}</span>
        </div>
        <div className="field">
          <label htmlFor={`${id}-priority`}>Priority</label>
          <select id={`${id}-priority`} value={v.priority} onChange={(e) => set("priority", e.target.value)} disabled={isNote}>
            {PRIORITIES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
        <div className="field" style={{ gridColumn: "1 / -1" }}>
          <label htmlFor={`${id}-subject`}>Subject<span className="req" aria-hidden="true">*</span></label>
          <input id={`${id}-subject`} value={v.subject} onChange={(e) => set("subject", e.target.value)} maxLength={200} required data-autofocus />
        </div>
        {!isNote ? (
          <div className="field">
            <label htmlFor={`${id}-due`}>Due (IST){v.type === "FOLLOW_UP" ? <span className="req" aria-hidden="true">*</span> : null}</label>
            <input id={`${id}-due`} type="datetime-local" value={v.dueAt} onChange={(e) => set("dueAt", e.target.value)} />
          </div>
        ) : null}
        {!isNote && canAssign ? (
          <div className="field">
            <label htmlFor={`${id}-assignee`}>Assigned to</label>
            <select id={`${id}-assignee`} value={v.assigneeId} onChange={(e) => set("assigneeId", e.target.value)}>
              {users.map((u) => <option key={u.id} value={u.id}>{u.id === currentUserId ? `${u.name} (me)` : u.name}</option>)}
            </select>
          </div>
        ) : null}
        <div className="field" style={{ gridColumn: "1 / -1" }}>
          <label htmlFor={`${id}-body`}>{isNote ? "Note" : "Details"}</label>
          <textarea id={`${id}-body`} rows={4} value={v.body} onChange={(e) => set("body", e.target.value)} maxLength={10000} />
        </div>
        {!isNote ? (
          <div className="field" style={{ gridColumn: "1 / -1" }}>
            <label className="check-row"><input type="checkbox" checked={Boolean(v.completed)} onChange={(e) => set("completed", e.target.checked)} />This already happened — record it as done</label>
            {v.completed ? <input aria-label="Outcome" placeholder="Outcome (optional), e.g. Interested, asked for quotation" value={v.outcome} onChange={(e) => set("outcome", e.target.value)} maxLength={1000} /> : null}
          </div>
        ) : null}
        {error ? <p className="error" role="alert" style={{ gridColumn: "1 / -1", margin: 0 }}>{error}</p> : null}
      </form>
    </Modal>
  );
}
