// Vendor CSV import — upload, map columns, review, confirm.
//
// Nothing is written until the user has seen the validation result and pressed
// confirm. Every rejected row is listed with the reason, and the full report is
// downloadable, so no record is ever silently skipped.

import React, { useRef, useState } from 'react';
import { FiUploadCloud, FiDownload, FiCheck } from 'react-icons/fi';

import { vendorApi, vendorFiles } from '../../../utils/vendorApi';
import { Modal, Alert, EmptyState, notifySuccess, reportError } from './VendorUI';

const STEPS = ['Upload file', 'Map columns', 'Review', 'Done'];

const FIELD_LABELS = {
  name: 'Vendor Name (required)',
  legalName: 'Legal Name',
  type: 'Vendor Type',
  categoryName: 'Category',
  status: 'Status',
  priority: 'Priority',
  email: 'Email',
  phone: 'Phone',
  contact_name: 'Contact Person',
  website: 'Website',
  gstin: 'GSTIN',
  pan: 'PAN',
  cin: 'CIN',
  industry: 'Industry',
  description: 'Description',
  addr1: 'Address Line 1',
  addr2: 'Address Line 2',
  city: 'City',
  state: 'State',
  pin_code: 'Pincode',
  tags: 'Tags',
};

const MAX_CSV_BYTES = 15 * 1024 * 1024;

const statusTone = { Ready: 'vm-status-active', Imported: 'vm-status-active', Duplicate: 'vm-status-pending', Error: 'vm-status-blacklisted' };

const VendorImportModal = ({ onClose, onImported }) => {
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const [job, setJob] = useState(null);       // { jobId, headers, mapping, totalRows, sampleRows }
  const [mapping, setMapping] = useState({});
  const [validation, setValidation] = useState(null); // { summary, preview, previewTruncated }
  const [result, setResult] = useState(null);         // { summary }

  const fileInputRef = useRef(null);

  const reset = () => {
    setStep(0); setJob(null); setMapping({}); setValidation(null); setResult(null); setError('');
  };

  /* ------------------------------- Step 1 ------------------------------- */

  const handleFile = async (file) => {
    if (!file) return;

    // Cheap client-side checks so an obviously wrong file never leaves the
    // browser. The server re-checks both size and type regardless.
    if (!/\.csv$/i.test(file.name)) {
      setError('Choose a .csv file. Export your spreadsheet as CSV first.');
      return;
    }
    if (file.size > MAX_CSV_BYTES) {
      setError('That file is larger than 15 MB. Split it into smaller files.');
      return;
    }
    if (file.size === 0) {
      setError('That file is empty.');
      return;
    }

    setBusy(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const data = await vendorApi.importUpload(formData);
      setJob(data);
      setMapping(data.mapping || {});
      setStep(1);
    } catch (err) {
      setError(err.message);
      reportError(err, 'Upload failed');
    } finally {
      setBusy(false);
      // Allow the same file to be selected again after a failure.
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  /* ------------------------------- Step 2 ------------------------------- */

  const nameMapped = Object.values(mapping).includes('name');

  const validate = async () => {
    setBusy(true);
    setError('');
    try {
      const data = await vendorApi.importValidate(job.jobId, mapping);
      setValidation(data);
      setStep(2);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  /* ------------------------------- Step 3 ------------------------------- */

  const commit = async () => {
    setBusy(true);
    setError('');
    try {
      const data = await vendorApi.importCommit(job.jobId);
      setResult(data);
      setStep(3);
      notifySuccess('Import complete', `${data.summary.imported} vendor${data.summary.imported === 1 ? '' : 's'} imported.`);
      onImported?.();
    } catch (err) {
      setError(err.message);
      reportError(err, 'Import failed');
    } finally {
      setBusy(false);
    }
  };

  const downloadReport = async () => {
    try {
      await vendorFiles.importReport(job.jobId);
    } catch (err) {
      reportError(err, 'Could not download the report');
    }
  };

  const downloadTemplate = async () => {
    try {
      await vendorFiles.importTemplate();
    } catch (err) {
      reportError(err, 'Could not download the template');
    }
  };

  /* ------------------------------- Footer ------------------------------- */

  const footer = (() => {
    if (step === 0) {
      return (
        <>
          <button type="button" className="vm-btn vm-btn-ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="vm-btn vm-btn-ghost" onClick={downloadTemplate}>
            <FiDownload aria-hidden="true" /> Download template
          </button>
        </>
      );
    }
    if (step === 1) {
      return (
        <>
          <button type="button" className="vm-btn vm-btn-ghost" onClick={reset} disabled={busy}>Start over</button>
          <button type="button" className="vm-btn vm-btn-primary" onClick={validate} disabled={busy || !nameMapped}>
            {busy && <span className="vm-spinner" aria-hidden="true" />}
            {busy ? 'Checking…' : 'Validate rows'}
          </button>
        </>
      );
    }
    if (step === 2) {
      return (
        <>
          <button type="button" className="vm-btn vm-btn-ghost" onClick={() => setStep(1)} disabled={busy}>Back</button>
          <button type="button" className="vm-btn vm-btn-ghost" onClick={downloadReport} disabled={busy}>
            <FiDownload aria-hidden="true" /> Download report
          </button>
          <button
            type="button"
            className="vm-btn vm-btn-success"
            onClick={commit}
            disabled={busy || !validation?.summary?.readyToImport}
          >
            {busy && <span className="vm-spinner" aria-hidden="true" />}
            {busy ? 'Importing…' : `Import ${validation?.summary?.readyToImport || 0} vendors`}
          </button>
        </>
      );
    }
    return (
      <>
        <button type="button" className="vm-btn vm-btn-ghost" onClick={downloadReport}>
          <FiDownload aria-hidden="true" /> Download report
        </button>
        <button type="button" className="vm-btn vm-btn-primary" onClick={onClose}>Done</button>
      </>
    );
  })();

  return (
    <Modal
      title="Import vendors from CSV"
      subtitle="Review every row before anything is saved."
      size="lg"
      onClose={onClose}
      footer={footer}
    >
      <ol className="vm-steps" aria-label="Import progress">
        {STEPS.map((label, index) => (
          <li
            key={label}
            className={`vm-step ${index === step ? 'vm-step-active' : ''} ${index < step ? 'vm-step-done' : ''}`}
            aria-current={index === step ? 'step' : undefined}
          >
            <span className="vm-step-num">{index < step ? <FiCheck aria-hidden="true" /> : index + 1}</span>
            {label}
          </li>
        ))}
      </ol>

      {error && <Alert type="error">{error}</Alert>}

      {/* ------------------------------ Upload ------------------------------ */}
      {step === 0 && (
        <div>
          <p className="vm-hint" style={{ marginBottom: '1rem' }}>
            Upload a CSV file with one vendor per row. Only a vendor name is required —
            everything else can be filled in later. Download the template if you are unsure
            which columns to use.
          </p>

          <label
            htmlFor="vm-import-file"
            className="vm-empty"
            style={{ border: '2px dashed #cbd5e1', borderRadius: 16, cursor: 'pointer' }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); handleFile(e.dataTransfer.files?.[0]); }}
          >
            <FiUploadCloud className="vm-empty-icon" aria-hidden="true" />
            <h4>{busy ? 'Uploading…' : 'Choose a CSV file or drop it here'}</h4>
            <p>Maximum 15 MB, up to 20,000 rows.</p>
            <input
              id="vm-import-file"
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="vm-sr-only"
              disabled={busy}
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
          </label>
        </div>
      )}

      {/* ------------------------------ Mapping ------------------------------ */}
      {step === 1 && job && (
        <div>
          <Alert type="info">
            <strong>{job.fileName}</strong> — {job.totalRows} row{job.totalRows === 1 ? '' : 's'} detected.
            Check that each column has been matched to the right field. Set a column to
            &ldquo;Ignore&rdquo; to leave it out.
          </Alert>

          {!nameMapped && (
            <Alert type="warning">
              Map one column to <strong>Vendor Name</strong> before continuing.
            </Alert>
          )}

          <div className="vm-table-wrapper">
            <table className="vm-table">
              <thead>
                <tr>
                  <th scope="col">Column in your file</th>
                  <th scope="col">First value</th>
                  <th scope="col">Import as</th>
                </tr>
              </thead>
              <tbody>
                {job.headers.map((header) => (
                  <tr key={header}>
                    <td data-label="Column"><strong>{header}</strong></td>
                    <td data-label="First value" className="vm-cell-muted">
                      <span className="vm-truncate">{job.sampleRows?.[0]?.[header] || '—'}</span>
                    </td>
                    <td data-label="Import as">
                      <label className="vm-sr-only" htmlFor={`vm-map-${header}`}>Map {header} to</label>
                      <select
                        id={`vm-map-${header}`}
                        className="vm-select"
                        value={mapping[header] || ''}
                        onChange={(e) => setMapping((prev) => ({ ...prev, [header]: e.target.value }))}
                      >
                        <option value="">Ignore this column</option>
                        {Object.entries(FIELD_LABELS).map(([field, label]) => (
                          <option key={field} value={field}>{label}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ------------------------------ Review ------------------------------ */}
      {step === 2 && validation && (
        <div>
          <div className="vm-import-summary">
            <div className="vm-import-stat">
              <strong>{validation.summary.totalRows}</strong>
              <span>Rows processed</span>
            </div>
            <div className="vm-import-stat">
              <strong style={{ color: '#15803d' }}>{validation.summary.readyToImport}</strong>
              <span>Ready to import</span>
            </div>
            <div className="vm-import-stat">
              <strong style={{ color: '#b45309' }}>{validation.summary.duplicates}</strong>
              <span>Duplicates</span>
            </div>
            <div className="vm-import-stat">
              <strong style={{ color: '#b91c1c' }}>{validation.summary.errors}</strong>
              <span>Validation errors</span>
            </div>
          </div>

          {validation.summary.readyToImport === 0 ? (
            <Alert type="error">
              No rows can be imported. Download the report to see why each row was rejected,
              correct the file and upload it again.
            </Alert>
          ) : (
            <Alert type="info">
              Only the {validation.summary.readyToImport} valid row
              {validation.summary.readyToImport === 1 ? '' : 's'} will be imported. Duplicates and
              rows with errors are left untouched and listed in the downloadable report.
            </Alert>
          )}

          <div className="vm-table-wrapper">
            <table className="vm-table">
              <caption className="vm-sr-only">Row-by-row validation result</caption>
              <thead>
                <tr>
                  <th scope="col">Row</th>
                  <th scope="col">Vendor</th>
                  <th scope="col">Status</th>
                  <th scope="col">Reason</th>
                </tr>
              </thead>
              <tbody>
                {validation.preview.map((row) => (
                  <tr key={row.rowNumber}>
                    <td data-label="Row">{row.rowNumber}</td>
                    <td data-label="Vendor">{row.vendorName || <span className="vm-cell-muted">(blank)</span>}</td>
                    <td data-label="Status">
                      <span className={`vm-badge ${statusTone[row.status] || 'vm-status-inactive'}`}>{row.status}</span>
                    </td>
                    <td data-label="Reason" className="vm-cell-muted">{row.reason || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {validation.previewTruncated && (
            <p className="vm-hint" style={{ marginTop: '0.75rem' }}>
              Showing the first {validation.preview.length} rows. Download the report to see all of them.
            </p>
          )}
        </div>
      )}

      {/* ------------------------------- Done ------------------------------- */}
      {step === 3 && result && (
        <div>
          <div className="vm-import-summary">
            <div className="vm-import-stat">
              <strong>{result.summary.totalRows}</strong>
              <span>Rows processed</span>
            </div>
            <div className="vm-import-stat">
              <strong style={{ color: '#15803d' }}>{result.summary.imported}</strong>
              <span>Imported</span>
            </div>
            <div className="vm-import-stat">
              <strong style={{ color: '#b45309' }}>{result.summary.duplicates}</strong>
              <span>Duplicates skipped</span>
            </div>
            <div className="vm-import-stat">
              <strong style={{ color: '#b91c1c' }}>{result.summary.errors}</strong>
              <span>Errors</span>
            </div>
          </div>

          {result.summary.imported > 0 ? (
            <Alert type="success">
              {result.summary.imported} vendor{result.summary.imported === 1 ? '' : 's'} added.
              They start with the status from your file, or <strong>Pending</strong> if none was given.
            </Alert>
          ) : (
            <EmptyState
              title="Nothing was imported"
              message="Every row was either a duplicate or failed validation. Download the report for details."
            />
          )}
        </div>
      )}
    </Modal>
  );
};

export default VendorImportModal;
