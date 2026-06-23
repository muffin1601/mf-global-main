import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import CustomToast from "./CustomToast";
import { logActivity } from "../../utils/logActivity";

const API = import.meta.env.VITE_API_URL;
const BATCH = 500;

// Required-format spec shown to the user before upload.
const FORMAT_COLUMNS = [
  { name: "Company Name", required: true },
  { name: "Contact Person", required: true },
  { name: "Mobile Number", required: true },
  { name: "Email", required: false },
  { name: "City", required: false },
  { name: "State", required: false },
  { name: "Category", required: false },
  { name: "Requirements", required: false },
  { name: "Remarks", required: false },
];

const SAMPLE_CSV = [
  "Company Name,Contact Person,Mobile Number,Email,City,State,Category,Requirements,Remarks",
  "Acme Industries,Rahul Sharma,9876543210,rahul@acme.com,Delhi,Delhi,Manufacturing,Need 500 units of valves,Follow up next week",
  "Bright Electronics,Priya Verma,9812345678,priya@bright.in,Mumbai,Maharashtra,Electronics,Bulk LED order,Interested in catalogue",
  "Sunrise Traders,Amit Patel,9123456780,,Ahmedabad,Gujarat,Trading,Requirement for packaging material,Call after 5pm",
].join("\r\n");

const fmtBytes = (b) => {
  if (!b) return "0 B";
  const k = 1024, sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(b) / Math.log(k));
  return `${(b / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
};

const StatusBadge = ({ status }) => {
  const cls =
    status === "Imported" ? "li-badge-green"
    : status === "Duplicate" ? "li-badge-amber"
    : status === "Valid" ? "li-badge-blue"
    : "li-badge-red";
  return <span className={`li-badge ${cls}`}>{status}</span>;
};

const LeadImport = () => {
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const isAdmin = user?.role === "admin";

  const [step, setStep] = useState("upload"); // upload | preview | importing | result
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);

  const [token, setToken] = useState(null);
  const [summary, setSummary] = useState(null);
  const [skippedPreview, setSkippedPreview] = useState([]);
  const [validPreview, setValidPreview] = useState([]);
  const [previewCap, setPreviewCap] = useState(100);

  const [users, setUsers] = useState([]);
  const [assignTo, setAssignTo] = useState("");

  const [progress, setProgress] = useState({ processed: 0, total: 0, imported: 0 });
  const [result, setResult] = useState(null);

  const [history, setHistory] = useState([]);
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchHistory();
    if (isAdmin) {
      axios.get(`${API}/users`).then((r) => setUsers(r.data || [])).catch(() => {});
    }
  }, []);

  const fetchHistory = async () => {
    try {
      const r = await axios.get(`${API}/lead-import/history`);
      setHistory(r.data || []);
    } catch { /* non-fatal */ }
  };

  // ---- Sample CSV (generated client-side, always available) ----
  const downloadSample = () => {
    const blob = new Blob([SAMPLE_CSV], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "lead_import_sample.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadReport = async (id) => {
    try {
      const r = await axios.get(`${API}/lead-import/report/${id}`, { responseType: "blob" });
      const url = URL.createObjectURL(r.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `import_report_${id}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast(<CustomToast type="error" title="Download Failed" message="Could not download the report." />);
    }
  };

  // ---- File selection + preview ----
  const onFilePicked = (picked) => {
    if (!picked) return;
    if (!/\.csv$/i.test(picked.name)) {
      toast(<CustomToast type="error" title="Wrong File Type" message="Please choose a .csv file." />);
      return;
    }
    setFile(picked);
    runPreview(picked);
  };

  const runPreview = async (picked) => {
    setBusy(true);
    setStep("upload");
    const fd = new FormData();
    fd.append("file", picked);
    try {
      const r = await axios.post(`${API}/lead-import/preview`, fd);
      setToken(r.data.token);
      setSummary(r.data.summary);
      setSkippedPreview(r.data.skippedPreview || []);
      setValidPreview(r.data.validPreview || []);
      setPreviewCap(r.data.previewCap || 100);
      setStep("preview");
    } catch (err) {
      const msg = !err.response
        ? "Could not reach the server, or the file is locked (is it open in Excel?)."
        : err.response.data?.message || "Could not read the file.";
      toast(<CustomToast type="error" title="Upload Failed" message={msg} />);
      resetToUpload();
    } finally {
      setBusy(false);
    }
  };

  const resetToUpload = () => {
    setStep("upload");
    setFile(null);
    setToken(null);
    setSummary(null);
    setSkippedPreview([]);
    setValidPreview([]);
    setProgress({ processed: 0, total: 0, imported: 0 });
    setResult(null);
    setAssignTo("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ---- Batched import (keeps UI responsive, shows progress) ----
  const runImport = async () => {
    if (!token || !summary) return;
    setStep("importing");
    setProgress({ processed: 0, total: summary.valid, imported: 0 });

    let importId = null;
    let offset = 0;
    let last = null;
    try {
      do {
        const body = { token, importId, offset, limit: BATCH };
        if (isAdmin && assignTo) body.assignTo = assignTo;
        const r = await axios.post(`${API}/lead-import/commit`, body);
        last = r.data;
        importId = r.data.importId;
        offset = r.data.processed;
        setProgress({ processed: r.data.processed, total: r.data.totalValid, imported: r.data.imported });
      } while (last && !last.done);

      setResult(last);
      setStep("result");
      toast(<CustomToast type="success" title="Import Complete" message={`Imported ${last.imported} lead(s).`} />);
      await logActivity("Imported Leads CSV", {
        fileName: file?.name,
        imported: last.imported,
        skipped: last.skipped,
        duplicates: last.duplicates,
        total: last.total,
      });
      fetchHistory();
    } catch (err) {
      const msg = err.response?.data?.message || "Import failed. Re-uploading is safe — duplicates are skipped.";
      toast(<CustomToast type="error" title="Import Failed" message={msg} />);
      setStep("preview");
    }
  };

  const pct = progress.total ? Math.min(100, Math.round((progress.processed / progress.total) * 100)) : 0;

  return (
    <div className="li-wrap">
      {/* Header */}
      <div className="li-header">
        <div>
          <h1 className="li-title">Import Leads</h1>
          <p className="li-subtitle">Upload a CSV file to create leads in bulk.</p>
        </div>
        <div className="li-header-actions">
          <button className="li-btn li-btn-ghost" onClick={downloadSample}>⬇ Download Sample CSV</button>
          {step !== "upload" && (
            <button className="li-btn li-btn-ghost" onClick={resetToUpload}>↺ Start Over</button>
          )}
        </div>
      </div>

      {/* Required format */}
      <div className="li-card">
        <h3 className="li-card-title">Required Format</h3>
        <div className="li-format-grid">
          {FORMAT_COLUMNS.map((c) => (
            <div key={c.name} className={`li-chip ${c.required ? "li-chip-req" : ""}`}>
              {c.name}{c.required && <span className="li-req-star"> *</span>}
            </div>
          ))}
        </div>
        <p className="li-helper">
          <strong>Required fields must be filled.</strong> Duplicate mobile numbers (or emails) will be skipped automatically.
        </p>
      </div>

      {/* Upload / Drag & Drop */}
      {step === "upload" && (
        <div className="li-card">
          <div
            className={`li-drop ${dragging ? "li-drop-active" : ""} ${busy ? "li-drop-busy" : ""}`}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              if (!busy) onFilePicked(e.dataTransfer.files?.[0]);
            }}
            onClick={() => !busy && fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              style={{ display: "none" }}
              onChange={(e) => onFilePicked(e.target.files?.[0])}
            />
            {busy ? (
              <>
                <div className="li-spinner" />
                <p className="li-drop-main">Reading and validating your file…</p>
              </>
            ) : (
              <>
                <div className="li-drop-icon">📄</div>
                <p className="li-drop-main">Drag &amp; drop your CSV here</p>
                <p className="li-drop-sub">or click to browse — .csv files only</p>
              </>
            )}
          </div>
          {file && !busy && (
            <p className="li-filemeta">Selected: <strong>{file.name}</strong> · {fmtBytes(file.size)}</p>
          )}
        </div>
      )}

      {/* Preview */}
      {(step === "preview" || step === "importing") && summary && (
        <>
          <div className="li-card">
            <div className="li-filemeta-row">
              <span>File: <strong>{file?.name}</strong> · {fmtBytes(file?.size)} · {summary.total} rows detected</span>
            </div>
            <div className="li-summary">
              <SummaryCard label="Total Rows" value={summary.total} tone="blue" />
              <SummaryCard label="Valid Rows" value={summary.valid} tone="green" />
              <SummaryCard label="Invalid Rows" value={summary.invalid} tone="red" />
              <SummaryCard label="Duplicate Rows" value={summary.duplicate} tone="amber" />
            </div>

            {isAdmin && (
              <div className="li-assign">
                <label>Assign imported leads to (optional):</label>
                <select value={assignTo} onChange={(e) => setAssignTo(e.target.value)} disabled={step === "importing"}>
                  <option value="">— Leave unassigned —</option>
                  {users.map((u) => <option key={u._id} value={u._id}>{u.name}</option>)}
                </select>
              </div>
            )}

            {step === "importing" ? (
              <div className="li-progress-box">
                <div className="li-progress-track"><div className="li-progress-fill" style={{ width: `${pct}%` }} /></div>
                <p className="li-progress-text">Processing row {progress.processed} of {progress.total} · {progress.imported} imported</p>
              </div>
            ) : (
              <div className="li-actions">
                <button className="li-btn li-btn-secondary" onClick={resetToUpload}>Cancel</button>
                <button className="li-btn li-btn-primary" onClick={runImport} disabled={summary.valid === 0}>
                  Import {summary.valid} Lead{summary.valid === 1 ? "" : "s"}
                </button>
              </div>
            )}
            {step === "preview" && summary.valid === 0 && (
              <p className="li-helper li-warn">No valid rows to import. Review the skipped rows below and fix your file.</p>
            )}
          </div>

          {validPreview.length > 0 && (
            <div className="li-card">
              <h3 className="li-card-title">Valid Rows Preview {summary.valid > previewCap && `(showing first ${previewCap} of ${summary.valid})`}</h3>
              <div className="li-table-wrap">
                <table className="li-table">
                  <thead><tr><th>Row #</th><th>Company</th><th>Status</th></tr></thead>
                  <tbody>
                    {validPreview.map((r) => (
                      <tr key={r.rowNumber}><td>{r.rowNumber}</td><td>{r.company}</td><td><StatusBadge status="Valid" /></td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {skippedPreview.length > 0 && (
            <div className="li-card">
              <h3 className="li-card-title">Skipped Rows {(summary.invalid + summary.duplicate) > previewCap && `(showing first ${previewCap} of ${summary.invalid + summary.duplicate})`}</h3>
              <div className="li-table-wrap">
                <table className="li-table">
                  <thead><tr><th>Row #</th><th>Company</th><th>Status</th><th>Reason</th></tr></thead>
                  <tbody>
                    {skippedPreview.map((r) => (
                      <tr key={r.rowNumber}>
                        <td>{r.rowNumber}</td><td>{r.company || <em>—</em>}</td>
                        <td><StatusBadge status={r.status} /></td><td>{r.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Result */}
      {step === "result" && result && (
        <div className="li-card">
          <h3 className="li-card-title">Import Result</h3>
          <div className="li-summary">
            <SummaryCard label="Total Rows" value={result.total} tone="blue" />
            <SummaryCard label="Imported" value={result.imported} tone="green" />
            <SummaryCard label="Skipped" value={result.skipped} tone="red" />
            <SummaryCard label="Duplicates" value={result.duplicates} tone="amber" />
          </div>
          <div className="li-actions">
            <button className="li-btn li-btn-ghost" onClick={() => downloadReport(result.importId)}>⬇ Download Import Report</button>
            <button className="li-btn li-btn-primary" onClick={resetToUpload}>Import Another File</button>
          </div>
        </div>
      )}

      {/* Import History */}
      <div className="li-card">
        <h3 className="li-card-title">{isAdmin ? "Import History (all users)" : "My Import History"}</h3>
        {history.length === 0 ? (
          <p className="li-helper">No imports yet.</p>
        ) : (
          <div className="li-table-wrap">
            <table className="li-table">
              <thead>
                <tr>
                  <th>Date</th>{isAdmin && <th>User</th>}<th>File</th><th>Total</th>
                  <th>Imported</th><th>Skipped</th><th>Duplicates</th><th>Status</th><th>Report</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h._id}>
                    <td>{new Date(h.createdAt).toLocaleString()}</td>
                    {isAdmin && <td>{h.userName || "—"}</td>}
                    <td className="li-ellipsis" title={h.fileName}>{h.fileName}</td>
                    <td>{h.totalRows}</td><td>{h.imported}</td><td>{h.skipped}</td><td>{h.duplicates}</td>
                    <td><StatusBadge status={h.status === "completed" ? "Imported" : h.status === "in_progress" ? "Valid" : "Skipped"} /></td>
                    <td><button className="li-link" onClick={() => downloadReport(h._id)}>Download</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

const SummaryCard = ({ label, value, tone }) => (
  <div className={`li-sumcard li-sum-${tone}`}>
    <div className="li-sum-value">{value}</div>
    <div className="li-sum-label">{label}</div>
  </div>
);

export default LeadImport;

// ---- Styles (CSS-in-JS injection, matching CRM glassmorphic conventions) ----
const css = `
.li-wrap { display:flex; flex-direction:column; gap:1.25rem; padding:1.5rem; font-family:'Outfit',sans-serif; }
.li-header { display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:1rem; }
.li-title { font-size:1.75rem; color:#222; margin:0; }
.li-subtitle { color:#666; margin:.25rem 0 0; }
.li-header-actions { display:flex; gap:.75rem; flex-wrap:wrap; }
.li-card { background:rgba(255,255,255,0.55); backdrop-filter:blur(15px); border:1px solid rgba(255,255,255,0.6);
  border-radius:16px; padding:1.25rem 1.5rem; box-shadow:0 4px 14px rgba(0,0,0,0.06); }
.li-card-title { margin:0 0 1rem; font-size:1.1rem; color:#333; }
.li-format-grid { display:flex; flex-wrap:wrap; gap:.5rem; }
.li-chip { padding:.4rem .8rem; border-radius:20px; background:rgba(255,255,255,0.85); border:1px solid rgba(0,0,0,0.08);
  font-size:.85rem; color:#444; }
.li-chip-req { background:rgba(255,140,0,0.12); border-color:rgba(255,140,0,0.4); color:#a85a00; font-weight:600; }
.li-req-star { color:#e53935; }
.li-helper { margin:1rem 0 0; color:#666; font-size:.9rem; }
.li-warn { color:#c62828; }
.li-drop { border:2px dashed rgba(23,146,23,0.5); border-radius:14px; padding:2.5rem 1rem; text-align:center;
  cursor:pointer; transition:all .2s ease; background:rgba(255,255,255,0.4); }
.li-drop:hover, .li-drop-active { background:rgba(23,146,23,0.07); border-color:rgba(23,146,23,0.9); }
.li-drop-busy { cursor:progress; }
.li-drop-icon { font-size:2.5rem; }
.li-drop-main { font-size:1.1rem; color:#333; margin:.5rem 0 .25rem; font-weight:600; }
.li-drop-sub { color:#777; margin:0; font-size:.9rem; }
.li-filemeta, .li-filemeta-row { color:#555; font-size:.9rem; margin-top:.75rem; }
.li-filemeta-row { margin-bottom:1rem; }
.li-summary { display:grid; grid-template-columns:repeat(auto-fit,minmax(140px,1fr)); gap:1rem; }
.li-sumcard { border-radius:12px; padding:1rem; text-align:center; color:#fff; }
.li-sum-value { font-size:1.8rem; font-weight:700; }
.li-sum-label { font-size:.85rem; opacity:.95; margin-top:.25rem; }
.li-sum-blue { background:linear-gradient(135deg,#2196f3,#1565c0); }
.li-sum-green { background:linear-gradient(135deg,#4caf50,#2e7d32); }
.li-sum-red { background:linear-gradient(135deg,#ef5350,#c62828); }
.li-sum-amber { background:linear-gradient(135deg,#ffb300,#ef6c00); }
.li-assign { margin-top:1.25rem; display:flex; align-items:center; gap:.75rem; flex-wrap:wrap; }
.li-assign label { color:#444; font-size:.9rem; }
.li-assign select { padding:.5rem .9rem; border-radius:10px; border:1px solid rgba(0,0,0,0.15); background:#fff; min-width:220px; }
.li-actions { display:flex; gap:.75rem; justify-content:flex-end; margin-top:1.25rem; flex-wrap:wrap; }
.li-btn { padding:.6rem 1.2rem; border-radius:10px; border:none; cursor:pointer; font-family:inherit; font-size:.95rem;
  transition:all .2s ease; white-space:nowrap; }
.li-btn:disabled { opacity:.5; cursor:not-allowed; }
.li-btn-primary { background:rgba(23,146,23,1); color:#fff; }
.li-btn-primary:hover:not(:disabled) { background:rgba(18,120,18,0.95); }
.li-btn-secondary { background:rgba(120,120,120,0.18); color:#444; }
.li-btn-ghost { background:rgba(255,255,255,0.85); color:#333; border:1px solid rgba(0,0,0,0.12); }
.li-btn-ghost:hover { background:#fff; }
.li-progress-box { margin-top:1.25rem; }
.li-progress-track { height:14px; background:rgba(0,0,0,0.1); border-radius:10px; overflow:hidden; }
.li-progress-fill { height:100%; background:linear-gradient(90deg,#4caf50,#2e7d32); transition:width .3s ease; }
.li-progress-text { margin:.6rem 0 0; color:#444; font-size:.9rem; text-align:center; }
.li-table-wrap { overflow-x:auto; max-height:420px; overflow-y:auto; border-radius:10px; border:1px solid rgba(0,0,0,0.08); }
.li-table { width:100%; border-collapse:collapse; }
.li-table th, .li-table td { padding:.6rem .9rem; text-align:left; font-size:.85rem; border-bottom:1px solid rgba(0,0,0,0.07); }
.li-table th { background:rgba(0,0,0,0.04); position:sticky; top:0; color:#333; }
.li-ellipsis { max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.li-badge { padding:.2rem .6rem; border-radius:20px; font-size:.75rem; font-weight:600; }
.li-badge-green { background:rgba(46,125,50,0.15); color:#2e7d32; }
.li-badge-amber { background:rgba(239,108,0,0.15); color:#ef6c00; }
.li-badge-red { background:rgba(198,40,40,0.15); color:#c62828; }
.li-badge-blue { background:rgba(21,101,192,0.15); color:#1565c0; }
.li-link { background:none; border:none; color:#1565c0; cursor:pointer; text-decoration:underline; font-size:.85rem; }
.li-spinner { width:34px; height:34px; border:4px solid rgba(23,146,23,0.2); border-top-color:rgba(23,146,23,1);
  border-radius:50%; margin:0 auto; animation:li-spin .8s linear infinite; }
@keyframes li-spin { to { transform:rotate(360deg); } }
`;
if (typeof document !== "undefined" && !document.getElementById("lead-import-styles")) {
  const style = document.createElement("style");
  style.id = "lead-import-styles";
  style.textContent = css;
  document.head.appendChild(style);
}
