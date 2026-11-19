"use client";

import Link from "next/link";
import type { Route } from "next";
import { ExternalLink, Pencil } from "lucide-react";
import { LeadDetailBody, LeadDetailSkeleton } from "./lead-detail-body";
import { Modal } from "./modal";
import { useLeadDetail } from "./use-lead-detail";

export function ViewLeadModal({ id, onClose, onEdit }: { id: string; onClose: () => void; onEdit?: () => void }) {
  const { lead, error, loading } = useLeadDetail(id);
  return (
    <Modal
      title={lead?.name || "Lead details"} description={lead ? [lead.company, lead.location].filter(Boolean).join(" · ") || undefined : undefined}
      onClose={onClose} wide
      footer={<>
        <Link className="button ghost" href={`/crm/lead-management/${id}` as Route}><ExternalLink size={15} aria-hidden="true" />Open full page</Link>
        <span style={{ flex: 1 }} />
        <button type="button" className="button secondary" onClick={onClose}>Close</button>
        {onEdit ? <button type="button" className="button" onClick={onEdit}><Pencil size={15} aria-hidden="true" />Edit lead</button> : null}
      </>}
    >
      {loading ? <LeadDetailSkeleton /> : error ? <p className="error" role="alert">{error}</p> : lead ? <LeadDetailBody lead={lead} /> : null}
    </Modal>
  );
}
