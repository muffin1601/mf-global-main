"use client";

import { LeadDetailBody } from "./lead-detail-body";
import { Modal } from "./modal";
import { useLeadDetail } from "./use-lead-detail";

export function ViewLeadModal({ id, onClose }: { id: string; onClose: () => void }) {
  const { lead, error, loading } = useLeadDetail(id);
  return (
    <Modal title={lead?.name || "Lead details"} onClose={onClose} wide footer={<button type="button" className="button secondary" onClick={onClose}>Close</button>}>
      {loading ? <p>Loading…</p> : error ? <p className="error">{error}</p> : lead ? <LeadDetailBody lead={lead} /> : null}
    </Modal>
  );
}
