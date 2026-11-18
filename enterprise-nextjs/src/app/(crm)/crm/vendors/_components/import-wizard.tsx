"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { commitImportAction, validateImportAction } from "../actions";
import s from "./vendors.module.css";

type Upload = { jobId: string; fileName: string; headers: string[]; mapping: Record<string, string>; mappableFields: string[]; totalRows: number; sampleRows: Record<string, string>[] };
type Report = { rowNumber: number; vendorName: string; status: string; reason: string };
type Validation = { summary: { totalRows: number; readyToImport: number; duplicates: number; errors: number }; preview: Report[]; previewTruncated: boolean };
type Done = { imported: number; duplicates: number; errors: number; totalRows: number };

const LABELS: Record<string, string> = {
  name: "Vendor name *", legalName: "Legal name", vendorType: "Vendor type", categoryName: "Category", status: "Status", priority: "Priority", email: "Email", phone: "Phone",
  contactName: "Contact person", website: "Website", gstin: "GSTIN", pan: "PAN", cin: "CIN", industry: "Industry", description: "Description", addressLine1: "Address line 1",
  addressLine2: "Address line 2", city: "City", state: "State", postalCode: "PIN code", tags: "Tags",
};

export function ImportWizard() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const keyRef = useRef<string>("");
  const [pending, start] = useTransition();
  const [upload, setUpload] = useState<Upload | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [validation, setValidation] = useState<Validation | null>(null);
  const [done, setDone] = useState<Done | null>(null);
  const [progress, setProgress] = useState<string>("");

  const step = done ? 4 : validation ? 3 : upload ? 2 : 1;

  const doUpload = () => {
    const file = fileRef.current?.files?.[0];
    if (!file) { toast.error("Choose a .csv file first"); return; }
    if (!keyRef.current) keyRef.current = crypto.randomUUID(); // same key on retry => same job
    const fd = new FormData();
    fd.set("file", file);
    fd.set("idempotencyKey", keyRef.current);
    start(async () => {
      const res = await fetch("/api/vendors/import/upload", { method: "POST", body: fd }).catch(() => null);
      const body = (await res?.json().catch(() => null)) as (Upload & { ok?: boolean; error?: string }) | null;
      if (!res || !res.ok || !body) { toast.error(body?.error ?? "Upload failed. Please try again."); return; }
      setUpload(body);
      setMapping(body.mapping);
      setValidation(null);
    });
  };

  const doValidate = () => upload && start(async () => {
    const r = await validateImportAction(upload.jobId, mapping);
    if (!r.ok) { toast.error(r.error); return; }
    setValidation(r as unknown as Validation);
  });

  const doCommit = () => upload && start(async () => {
    // Commit runs in resumable slices (500-row batches); keep calling until the server reports done.
    for (let guard = 0; guard < 100; guard += 1) {
      const r = await commitImportAction(upload.jobId);
      if (!r.ok) { toast.error(r.error); return; }
      const res = r as unknown as { done: boolean; remaining?: number; summary: Done };
      if (res.done) { setDone(res.summary); toast.success(`${res.summary.imported} vendor(s) imported`); router.refresh(); return; }
      setProgress(`Imported ${res.summary.imported} of ${validation?.summary.readyToImport ?? res.summary.totalRows}...`);
    }
  });

  const reset = () => { setUpload(null); setValidation(null); setDone(null); setProgress(""); keyRef.current = ""; if (fileRef.current) fileRef.current.value = ""; };

  return (
    <div>
      <ol className={s.steps}>
        {["1. Upload", "2. Map columns", "3. Review", "4. Done"].map((l, i) => <li key={l} className={step >= i + 1 ? s.stepOn : ""}>{l}</li>)}
      </ol>

      {step === 1 ? (
        <div className={`${s.panel} ${s.dropzone}`}>
          <p>Choose a CSV file (UTF-8, first row = headers).</p>
          <input ref={fileRef} type="file" accept=".csv,text/csv" aria-label="CSV file" />
          <p><button type="button" className="button" disabled={pending} onClick={doUpload}>{pending ? "Uploading..." : "Upload and detect columns"}</button></p>
        </div>
      ) : null}

      {upload && step >= 2 && step < 4 ? (
        <div className={s.panel}>
          <h3>Map columns - {upload.fileName} ({upload.totalRows} rows)</h3>
          <div className={s.mapGrid}>
            {upload.headers.map((h) => (
              <label key={h} style={{ display: "contents" }}>
                <span><strong>{h}</strong><br /><span className={s.help}>e.g. {upload.sampleRows[0]?.[h] || "(empty)"}</span></span>
                <select value={mapping[h] ?? ""} onChange={(e) => { setMapping({ ...mapping, [h]: e.target.value }); setValidation(null); }} aria-label={`Map ${h}`}>
                  <option value="">Do not import</option>
                  {upload.mappableFields.map((f) => <option key={f} value={f}>{LABELS[f] ?? f}</option>)}
                </select>
              </label>
            ))}
          </div>
          <p><button type="button" className="button" disabled={pending} onClick={doValidate}>{pending ? "Validating..." : "Validate"}</button> <button type="button" className="button secondary" onClick={reset}>Start over</button></p>
        </div>
      ) : null}

      {validation && !done ? (
        <div className={s.panel}>
          <h3>Review</h3>
          <section className="kpis">
            <div className="kpi"><span>Rows</span><strong>{validation.summary.totalRows}</strong></div>
            <div className="kpi"><span>Ready to import</span><strong>{validation.summary.readyToImport}</strong></div>
            <div className="kpi"><span>Duplicates (skipped)</span><strong>{validation.summary.duplicates}</strong></div>
            <div className="kpi"><span>Errors (skipped)</span><strong>{validation.summary.errors}</strong></div>
          </section>
          <section className="table-card"><div className={s.scroll}><table>
            <thead><tr><th>Row</th><th>Vendor</th><th>Result</th><th>Reason</th></tr></thead>
            <tbody>{validation.preview.map((r) => <tr key={r.rowNumber}><td>{r.rowNumber}</td><td>{r.vendorName || "-"}</td><td><span className={`badge ${r.status === "Ready" ? "" : r.status === "Error" ? s.badgeBad : s.badgeWarn}`}>{r.status}</span></td><td>{r.reason}</td></tr>)}</tbody>
          </table></div></section>
          {validation.previewTruncated ? <p className={s.help}>Showing the first 50 rows. The full per-row report is available after the import.</p> : null}
          <p>
            <button type="button" className="button" disabled={pending || validation.summary.readyToImport === 0} onClick={doCommit}>{pending ? "Importing..." : `Import ${validation.summary.readyToImport} vendor(s)`}</button>{" "}
            <a className="button secondary" href={`/api/vendors/import/${upload?.jobId}/report`}>Download row report</a>
          </p>
          {progress ? <p className={s.muted}>{progress}</p> : null}
        </div>
      ) : null}

      {done && upload ? (
        <div className={s.panel}>
          <h3>Import complete</h3>
          <p>{done.imported} imported, {done.duplicates} duplicates skipped, {done.errors} rows with errors, out of {done.totalRows}.</p>
          <p>
            <a className="button secondary" href={`/api/vendors/import/${upload.jobId}/report`}>Download row report (CSV)</a>{" "}
            <Link className="button" href={"/crm/vendors" as Route}>View vendors</Link>{" "}
            <button type="button" className="button secondary" onClick={reset}>Import another file</button>
          </p>
        </div>
      ) : null}
    </div>
  );
}
