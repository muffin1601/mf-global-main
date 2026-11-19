"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Download } from "lucide-react";
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
      title="Export leads" description="Exports respect the current view, filters and your access." onClose={onClose}
      footer={
        <>
          <button type="button" className="button secondary" onClick={onClose}>Cancel</button>
          <button type="button" className="button" onClick={download}><Download size={15} aria-hidden="true" />Download</button>
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
        <div className="form-grid cols-2">
          <div className="field"><label htmlFor="dl-from">From (optional)</label><input id="dl-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div className="field"><label htmlFor="dl-to">To (optional)</label><input id="dl-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        </div>
        <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
          <legend style={{ fontSize: ".8125rem", fontWeight: 500, color: "var(--text-2)", marginBottom: 6 }}>Format</legend>
          <div className={styles.choiceGrid}>
            <label className={styles.choice}><input type="radio" name="fmt" checked={format === "csv"} onChange={() => setFormat("csv")} /><span><strong>CSV</strong><span>Plain text, any spreadsheet app</span></span></label>
            <label className={styles.choice}><input type="radio" name="fmt" checked={format === "xlsx"} onChange={() => setFormat("xlsx")} /><span><strong>Excel (XLSX)</strong><span>Formatted workbook</span></span></label>
          </div>
        </fieldset>
      </div>
    </Modal>
  );
}
