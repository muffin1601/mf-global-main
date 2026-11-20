"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Ban, CheckCircle2, RotateCcw, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Modal } from "@/components/ui/modal";
import {
  cancelActivityAction, completeActivityAction, deleteActivityAction, reopenActivityAction, type ActivityActionResult,
} from "@/app/(crm)/crm/activities/actions";

/**
 * Per-row actions. `canChange` / `canDelete` mirror the server rules for display only; the server
 * re-checks every call (creator, assignee or admin may change; creator or admin may delete).
 */
export function ActivityRowActions({ id, status, type, subject, leadId, canChange, canDelete }: {
  id: string; status: string; type: string; subject: string; leadId?: string | null; canChange: boolean; canDelete: boolean;
}) {
  const router = useRouter();
  const [modal, setModal] = useState<null | "complete" | "delete" | "cancel">(null);
  const [outcome, setOutcome] = useState("");
  const [busy, setBusy] = useState(false);
  const done = (r: ActivityActionResult, msg: string) => {
    if (!r.ok) { toast.error(r.error); return false; }
    toast.success(msg); setModal(null); router.refresh(); return true;
  };
  const isNote = type === "NOTE";
  if (!canChange && !canDelete) return null;

  return (
    <div className="row-actions">
      {canChange && !isNote && status === "OPEN" ? (
        <button type="button" className="icon-btn" aria-label={`Mark "${subject}" done`} title="Mark done" onClick={() => setModal("complete")}><CheckCircle2 size={16} /></button>
      ) : null}
      {canChange && !isNote && status !== "OPEN" ? (
        <button type="button" className="icon-btn" aria-label={`Reopen "${subject}"`} title="Reopen" disabled={busy}
          onClick={async () => { setBusy(true); done(await reopenActivityAction(id, leadId), "Reopened."); setBusy(false); }}><RotateCcw size={15} /></button>
      ) : null}
      {canChange && !isNote && status === "OPEN" ? (
        <button type="button" className="icon-btn" aria-label={`Cancel "${subject}"`} title="Cancel" onClick={() => setModal("cancel")}><Ban size={15} /></button>
      ) : null}
      {canDelete ? (
        <button type="button" className="icon-btn" aria-label={`Delete "${subject}"`} title="Delete" onClick={() => setModal("delete")}><Trash2 size={15} /></button>
      ) : null}

      {modal === "complete" ? (
        <Modal
          title="Mark as done" description={subject} onClose={() => setModal(null)} busy={busy}
          footer={<>
            <button type="button" className="button secondary" onClick={() => setModal(null)} disabled={busy}>Cancel</button>
            <button type="button" className="button" disabled={busy}
              onClick={async () => { setBusy(true); done(await completeActivityAction(id, outcome, leadId), "Marked as done."); setBusy(false); }}>
              {busy ? "Saving…" : "Mark done"}
            </button>
          </>}
        >
          <div className="field">
            <label htmlFor={`outcome-${id}`}>Outcome (optional)</label>
            <input id={`outcome-${id}`} value={outcome} onChange={(e) => setOutcome(e.target.value)} maxLength={1000} placeholder="e.g. Interested, call back next week" />
          </div>
        </Modal>
      ) : null}
      {modal === "cancel" ? (
        <ConfirmDialog title="Cancel activity" message={<>Cancel <strong>{subject}</strong>? It stays in history and can be reopened.</>} confirmLabel="Cancel activity"
          onClose={() => setModal(null)} onConfirm={async () => done(await cancelActivityAction(id, leadId), "Activity cancelled.")} />
      ) : null}
      {modal === "delete" ? (
        <ConfirmDialog destructive title="Delete activity" message={<>Permanently delete <strong>{subject}</strong>? This is recorded in the audit log.</>} confirmLabel="Delete"
          onClose={() => setModal(null)} onConfirm={async () => done(await deleteActivityAction(id, leadId), "Activity deleted.")} />
      ) : null}
    </div>
  );
}
