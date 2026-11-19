"use client";

import { AlertTriangle } from "lucide-react";
import { useState } from "react";
import { Modal } from "./modal";

/**
 * In-app replacement for window.confirm(). `onConfirm` resolves to true when the dialog may close;
 * returning false keeps it open (the caller has already shown the error, e.g. via a toast).
 */
export function ConfirmDialog({ title, message, confirmLabel = "Confirm", destructive, onConfirm, onClose }: {
  title: string; message: React.ReactNode; confirmLabel?: string; destructive?: boolean;
  onConfirm: () => Promise<boolean | void> | boolean | void; onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try {
      const ok = await onConfirm();
      if (ok !== false) onClose();
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      title={title} onClose={onClose} busy={busy}
      footer={<>
        <button type="button" className="button secondary" onClick={onClose} disabled={busy} data-autofocus>Cancel</button>
        <button type="button" className={`button${destructive ? " danger" : ""}`} onClick={run} disabled={busy}>{busy ? "Working…" : confirmLabel}</button>
      </>}
    >
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        {destructive ? <span className="kpi-icon tone-danger" aria-hidden="true" style={{ width: 36, height: 36 }}><AlertTriangle size={18} /></span> : null}
        <div style={{ color: "var(--text-2)" }}>{message}</div>
      </div>
    </Modal>
  );
}
