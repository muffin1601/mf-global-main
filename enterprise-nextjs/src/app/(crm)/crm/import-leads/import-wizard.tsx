"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  BATCH_SIZE, MAX_FILE_BYTES, MAX_IMPORT_ROWS, PREVIEW_CAP, analyzeRows, parseLeadCsv, validateRow,
  type AnalyzedRow, type Analysis,
} from "@/lib/imports/lead-csv";
import { Check, CircleCheck, Download, FileSpreadsheet, RefreshCw, RotateCcw, Upload, UploadCloud } from "lucide-react";
import styles from "./import-wizard.module.css";
import { StatusBadge } from "@/components/ui/status-badge";

type Step = "upload" | "preview" | "importing" | "result";
type Progress = { processed: number; total: number; imported: number };
type Result = { jobId: string; total: number; imported: number; skipped: number; duplicates: number };
type BatchResponse = { processed: number; total: number; imported: number; skipped: number; duplicates: number; failed: number; done: boolean };

const sha256Hex = async (text: string) => {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
};

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as { error?: string }).error ?? `Request failed (${res.status})`);
  return json as T;
}

export function ImportWizard({ isAdmin, users }: { isAdmin: boolean; users: { id: string; name: string }[] }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("upload");
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState("");
  const [sha, setSha] = useState("");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [assignTo, setAssignTo] = useState("");
  const [progress, setProgress] = useState<Progress>({ processed: 0, total: 0, imported: 0 });
  const [result, setResult] = useState<Result | null>(null);
  // The browser keeps the file; the server is stateless between requests.
  const [clientKey, setClientKey] = useState(() => crypto.randomUUID());

  const reset = () => {
    setStep("upload"); setAnalysis(null); setFileName(""); setSha(""); setAssignTo(""); setResult(null);
    setProgress({ processed: 0, total: 0, imported: 0 }); setClientKey(crypto.randomUUID());
    if (inputRef.current) inputRef.current.value = "";
  };

  async function onFile(file: File | undefined) {
    if (!file) return;
    if (!/\.csv$/i.test(file.name)) return void toast.error("Please choose a .csv file.");
    if (file.size > MAX_FILE_BYTES) return void toast.error("The file is larger than 50 MB.");
    setBusy(true);
    try {
      const text = await file.text();
      const parsed = parseLeadCsv(text);
      if (!parsed.ok) return void toast.error(parsed.error);
      if (parsed.rows.length > MAX_IMPORT_ROWS) return void toast.error(`Files are limited to ${MAX_IMPORT_ROWS} rows.`);
      const phones: string[] = [];
      const emails: string[] = [];
      for (const r of parsed.rows) {
        const v = validateRow(r.data);
        if (v.ok) { phones.push(v.lead.phone); if (v.lead.email) emails.push(v.lead.email); }
      }
      const existingPhones = new Set<string>();
      const existingEmails = new Set<string>();
      for (let i = 0; i < Math.max(phones.length, emails.length); i += 5000) {
        const found = await postJson<{ phones: string[]; emails: string[] }>("/api/lead-import/check", {
          phones: phones.slice(i, i + 5000), emails: emails.slice(i, i + 5000),
        });
        found.phones.forEach((p) => existingPhones.add(p));
        found.emails.forEach((e) => existingEmails.add(e.toLowerCase()));
      }
      setSha(await sha256Hex(text));
      setFileName(file.name);
      setAnalysis(analyzeRows(parsed.rows, { phones: existingPhones, emails: existingEmails }));
      setStep("preview");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not read the file.");
    } finally {
      setBusy(false);
    }
  }

  async function runImport() {
    if (!analysis) return;
    setStep("importing");
    const rows = analysis.rows;
    setProgress({ processed: 0, total: rows.length, imported: 0 });
    try {
      const job = await postJson<{ jobId: string }>("/api/lead-import/jobs", {
        fileName, totalRows: rows.length, sha256: sha, clientKey, assignTo: isAdmin && assignTo ? assignTo : null,
      });
      let last: BatchResponse | null = null;
      for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const entries = rows.slice(i, i + BATCH_SIZE).map((r: AnalyzedRow) =>
          r.status === "Valid"
            ? { kind: "row" as const, rowNumber: r.rowNumber, data: r.data }
            : { kind: "report" as const, rowNumber: r.rowNumber, company: r.company, status: r.status, reason: r.reason });
        // Re-sending a batch is always safe (idempotent); retry transient failures.
        for (let attempt = 1; ; attempt++) {
          try {
            last = await postJson<BatchResponse>(`/api/lead-import/jobs/${job.jobId}/batch`, { sha256: sha, entries });
            if (last.failed === 0) break;
            if (attempt >= 3) throw new Error(`${last.failed} row(s) could not be saved. Click Import again to resume.`);
          } catch (e) {
            if (attempt >= 3) throw e;
          }
        }
        setProgress({ processed: last.processed, total: rows.length, imported: last.imported });
      }
      if (last) setResult({ jobId: job.jobId, total: last.total, imported: last.imported, skipped: last.skipped, duplicates: last.duplicates });
      setStep("result");
      toast.success(`Imported ${last?.imported ?? 0} lead(s).`);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed. Retrying is safe: duplicates are never created.");
      setStep("preview");
    }
  }

  const pct = progress.total ? Math.min(100, Math.round((progress.processed / progress.total) * 100)) : 0;
  const skipped = analysis?.rows.filter((r) => r.status !== "Valid") ?? [];
  const valid = analysis?.rows.filter((r) => r.status === "Valid") ?? [];

  return (
    <div className={styles.stack}>
      <section className="card" style={{ padding: "14px 16px" }}>
        <div className={styles.stepper} aria-label="Import progress">
          {(["upload", "preview", "importing", "result"] as const).map((k, i) => {
            const order = ["upload", "preview", "importing", "result"].indexOf(step);
            const state = i < order ? "done" : i === order ? "current" : "todo";
            return (
              <div key={k} className={styles.step} data-state={state} aria-current={state === "current" ? "step" : undefined}>
                <span className={styles.stepNum}>{state === "done" ? <Check size={13} aria-hidden="true" /> : i + 1}</span>
                {["Upload file", "Review", "Import", "Result"][i]}
              </div>
            );
          })}
          {step !== "upload" && step !== "importing" && <button type="button" className="button ghost small" style={{ marginLeft: "auto" }} onClick={reset}><RotateCcw size={14} aria-hidden="true" />Start over</button>}
        </div>
      </section>

      {step === "upload" && (
        <section className="card">
          <div
            className={`${styles.drop} ${dragging ? styles.dropActive : ""}`}
            role="button" tabIndex={0} aria-label="Choose a CSV file to import" aria-busy={busy}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); if (!busy) void onFile(e.dataTransfer.files?.[0]); }}
            onClick={() => !busy && inputRef.current?.click()}
            onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && !busy) { e.preventDefault(); inputRef.current?.click(); } }}
          >
            <input ref={inputRef} type="file" accept=".csv" hidden aria-label="CSV file to import" onChange={(e) => void onFile(e.target.files?.[0])} />
            <span className={styles.dropIcon} aria-hidden="true">{busy ? <RefreshCw size={20} className="spin" /> : <UploadCloud size={20} />}</span>
            <strong>{busy ? "Reading and validating your file…" : "Drop your CSV here, or click to browse"}</strong>
            <span className="muted" style={{ fontSize: ".8125rem" }}>.csv up to 50 MB · Required columns: Company Name, Contact Person, Mobile Number</span>
            <span className="muted" style={{ fontSize: ".75rem" }}>Optional: Email, City, State, Category, Requirements, Remarks. Duplicate mobile numbers or emails are skipped automatically.</span>
          </div>
        </section>
      )}

      {(step === "preview" || step === "importing") && analysis && (
        <>
          <section className="card">
            <p style={{ display: "flex", alignItems: "center", gap: 8 }}><FileSpreadsheet size={16} aria-hidden="true" style={{ color: "var(--text-3)" }} /><strong>{fileName}</strong><span className="muted">· {analysis.summary.total} rows detected</span></p>
            <div className={styles.summary}>
              <div className={styles.sum}>Total rows<strong>{analysis.summary.total}</strong></div>
              <div className={styles.sum} data-tone="success">Valid rows<strong>{analysis.summary.valid}</strong></div>
              <div className={styles.sum} data-tone="danger">Invalid rows<strong>{analysis.summary.invalid}</strong></div>
              <div className={styles.sum} data-tone="warning">Duplicate rows<strong>{analysis.summary.duplicate}</strong></div>
            </div>
            {isAdmin && (
              <label className="field">
                <span>Assign imported leads to (optional)</span>
                <select value={assignTo} onChange={(e) => setAssignTo(e.target.value)} disabled={step === "importing"}>
                  <option value="">Leave unassigned</option>
                  {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </label>
            )}
            {step === "importing" ? (
              <div style={{ marginTop: 12 }}>
                <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Import progress"><span style={{ width: `${pct}%` }} /></div>
                <p className="muted" style={{ marginTop: 8 }} aria-live="polite">Processing row {progress.processed} of {progress.total} · {progress.imported} imported · {pct}%</p>
              </div>
            ) : (
              <div className={styles.row}>
                <button type="button" className="button secondary" onClick={reset}>Cancel</button>
                <button type="button" className="button" onClick={() => void runImport()} disabled={analysis.summary.valid === 0}><Upload size={15} aria-hidden="true" />
                  Import {analysis.summary.valid} lead{analysis.summary.valid === 1 ? "" : "s"}
                </button>
              </div>
            )}
            {analysis.summary.valid === 0 && step === "preview" && <div className="callout tone-danger" role="alert" style={{ marginTop: 12 }}>No valid rows to import. Review the skipped rows below and fix your file.</div>}
          </section>
          {valid.length > 0 && (
            <section className="table-card">
              <div className="section-head"><h3>Valid rows {valid.length > PREVIEW_CAP && <span className="muted">(first {PREVIEW_CAP} of {valid.length})</span>}</h3></div>
              <table>
                <thead><tr><th>Row</th><th>Company</th><th>Status</th></tr></thead>
                <tbody>{valid.slice(0, PREVIEW_CAP).map((r) => <tr key={r.rowNumber}><td>{r.rowNumber}</td><td>{r.company}</td><td><StatusBadge value="Valid" /></td></tr>)}</tbody>
              </table>
            </section>
          )}
          {skipped.length > 0 && (
            <section className="table-card">
              <div className="section-head"><h3>Skipped rows {skipped.length > PREVIEW_CAP && <span className="muted">(first {PREVIEW_CAP} of {skipped.length})</span>}</h3></div>
              <table>
                <thead><tr><th>Row</th><th>Company</th><th>Status</th><th>Reason</th></tr></thead>
                <tbody>{skipped.slice(0, PREVIEW_CAP).map((r) => <tr key={r.rowNumber}><td>{r.rowNumber}</td><td>{r.company || "-"}</td><td><StatusBadge value={r.status} tone={r.status === "Duplicate" ? "warning" : "danger"} /></td><td>{r.reason}</td></tr>)}</tbody>
              </table>
            </section>
          )}
        </>
      )}

      {step === "result" && result && (
        <section className="card">
          <div className="callout tone-success" role="status" style={{ marginBottom: 12 }}><CircleCheck size={16} aria-hidden="true" />Import finished. Download the report for a row-by-row breakdown.</div>
          <div className={styles.summary}>
            <div className={styles.sum}>Total rows<strong>{result.total}</strong></div>
            <div className={styles.sum} data-tone="success">Imported<strong>{result.imported}</strong></div>
            <div className={styles.sum} data-tone="danger">Skipped<strong>{result.skipped}</strong></div>
            <div className={styles.sum} data-tone="warning">Duplicates<strong>{result.duplicates}</strong></div>
          </div>
          <div className={styles.row}>
            <a className="button secondary" href={`/api/lead-import/report/${result.jobId}`}><Download size={15} aria-hidden="true" />Download import report</a>
            <button type="button" className="button" onClick={reset}>Import another file</button>
          </div>
        </section>
      )}
    </div>
  );
}
