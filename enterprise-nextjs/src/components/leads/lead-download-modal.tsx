"use client";

import { useState } from "react";
import { toast } from "sonner";
import type { LeadDateType, LeadFilter, LeadPreset } from "@/server/leads/filter-schema";
import { filterToParams } from "@/server/leads/filter-schema";
import styles from "./leads.module.css";
import { Modal } from "./modal";

/**
 * Exports by FILTER (the server re-runs the query within the caller's scope); the browser never sends lead ids.
 * Without dates this exports the current view; with dates it narrows by createdAt/followUpDate (inclusive, IST).
 */
export function DownloadModal({ filter, preset, total, onClose }: { filter: LeadFilter; preset: LeadPreset; total: number; onClose: () => void }) {
  const [format, setFormat] = useState<"csv" | "xlsx">("csv");
  const [dateType, setDateType] = useState<LeadDateType>(filter.dateType ?? "createdAt");
  const [from, setFrom] = useState(filter.from ?? "");
  const [to, setTo] = useState(filter.to ?? "");

  const download = () => {
    if (from && to && from > to) { toast.error("The start date must not be after the end date."); return; }
    const params = filterToParams({ ...filter, dateType: from || to ? dateType : undefined, from: from || undefined, to: to || undefined });
    params.set("format", format);
    if (preset !== "all") params.set("preset", preset);
    const a = document.createElement("a");
    a.href = `/api/leads/export?${params.toString()}`;
    a.download = "";
    document.body.appendChild(a);
    a.click();
    a.remove();
    toast.success("Download started.");
    onClose();
  };

  return (
    <Modal
      title="Download leads" onClose={onClose}
      footer={
        <>
          <button type="button" className="button secondary" onClick={onClose}>Cancel</button>
          <button type="button" className="button" onClick={download}>Download</button>
        </>
      }
    >
      <p className={styles.muted}>
        Exports the leads in this view{from || to ? " within the date range" : ""} ({from || to ? "count depends on the range" : `${total} lead${total === 1 ? "" : "s"}`}). Up to 50,000 rows.
      </p>
      <div className="form-grid">
        <div className="field">
          <label htmlFor="dl-type">Date field</label>
          <select id="dl-type" value={dateType} onChange={(e) => setDateType(e.target.value as LeadDateType)}>
            <option value="createdAt">Entry date (created)</option>
            <option value="followUpDate">Follow-up date</option>
          </select>
        </div>
        <div className={styles.grid2}>
          <div className="field"><label htmlFor="dl-from">From (optional)</label><input id="dl-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div className="field"><label htmlFor="dl-to">To (optional)</label><input id="dl-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        </div>
        <div className={styles.radioRow}>
          <label><input type="radio" name="fmt" checked={format === "csv"} onChange={() => setFormat("csv")} />CSV</label>
          <label><input type="radio" name="fmt" checked={format === "xlsx"} onChange={() => setFormat("xlsx")} />Excel (XLSX)</label>
        </div>
      </div>
    </Modal>
  );
}
