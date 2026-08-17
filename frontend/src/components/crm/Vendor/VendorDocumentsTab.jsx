// Vendor documents: upload, preview, download, replace, edit and delete.
//
// Files are never linked directly — every download goes through the
// authenticated API and is streamed as a blob, so documents are not publicly
// reachable and the browser still gets a normal "save file" experience.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  FiPlus, FiEdit2, FiTrash2, FiDownload, FiEye, FiRefreshCw, FiFile,
} from 'react-icons/fi';

import { vendorApi, vendorFiles } from '../../../utils/vendorApi';
import {
  validateDocumentForm, validateDocumentFile, hasErrors,
  ALLOWED_DOCUMENT_EXTENSIONS,
} from '../../../utils/vendorValidation';
import {
  Modal, ConfirmDialog, Field, TextInput, Select, TextArea, Alert, EmptyState,
  ErrorState, TableSkeleton, ExpiryBadge, notifySuccess, reportError,
  formatDate, formatBytes,
} from './VendorUI';

const blankDocument = {
  name: '', documentType: 'Other', description: '', issueDate: '', expiryDate: '',
};

const UploadForm = ({ document: existing, meta, onClose, onSubmit, saving }) => {
  const [form, setForm] = useState(() => ({
    ...blankDocument,
    ...(existing || {}),
    issueDate: existing?.issueDate ? String(existing.issueDate).slice(0, 10) : '',
    expiryDate: existing?.expiryDate ? String(existing.expiryDate).slice(0, 10) : '',
  }));
  const [file, setFile] = useState(null);
  const [fileError, setFileError] = useState('');
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const fileRef = useRef(null);

  const isEdit = Boolean(existing);
  const set = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));
  const errorFor = (field) => (touched[field] ? errors[field] : '');

  useEffect(() => { setErrors(validateDocumentForm(form)); }, [form]);

  const pickFile = (chosen) => {
    if (!chosen) { setFile(null); setFileError(''); return; }
    const message = validateDocumentFile(chosen);
    setFileError(message);
    setFile(message ? null : chosen);
    // Default the document name to the filename so the field is rarely empty.
    if (!message && !form.name) set('name', chosen.name.replace(/\.[^.]+$/, ''));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const found = validateDocumentForm(form);
    setErrors(found);
    setTouched(Object.fromEntries(Object.keys(found).map((k) => [k, true])));

    if (!isEdit && !file) { setFileError('Choose a file to upload'); return; }
    if (hasErrors(found) || fileError) return;

    onSubmit(form, file);
  };

  return (
    <Modal
      title={isEdit ? `Edit ${existing.name}` : 'Upload a document'}
      onClose={onClose}
      footer={(
        <>
          <button type="button" className="vm-btn vm-btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="submit" form="vm-doc-form" className="vm-btn vm-btn-success" disabled={saving}>
            {saving && <span className="vm-spinner" aria-hidden="true" />}
            {saving ? 'Saving…' : (isEdit ? 'Save changes' : 'Upload')}
          </button>
        </>
      )}
    >
      <form id="vm-doc-form" noValidate onSubmit={handleSubmit}>
        {!isEdit && (
          <Field label="File" htmlFor="vm-doc-file" required error={fileError}
            hint={`Allowed: ${ALLOWED_DOCUMENT_EXTENSIONS.join(', ')} · up to 10 MB`} wide>
            <input
              id="vm-doc-file"
              ref={fileRef}
              type="file"
              className="vm-input"
              accept={ALLOWED_DOCUMENT_EXTENSIONS.join(',')}
              aria-invalid={fileError ? 'true' : undefined}
              onChange={(e) => pickFile(e.target.files?.[0])}
            />
          </Field>
        )}

        <div className="vm-form-grid" style={{ marginTop: isEdit ? 0 : '1rem' }}>
          <Field label="Document name" htmlFor="vm-doc-name" required error={errorFor('name')} wide>
            <TextInput id="vm-doc-name" value={form.name} error={errorFor('name')}
              onChange={(e) => set('name', e.target.value)}
              onBlur={() => setTouched((p) => ({ ...p, name: true }))}
              placeholder="e.g. GST Certificate 2025-26" />
          </Field>

          <Field label="Document type" htmlFor="vm-doc-type">
            <Select id="vm-doc-type" value={form.documentType} onChange={(e) => set('documentType', e.target.value)}>
              {meta.documentTypes.map((t) => <option key={t} value={t}>{t}</option>)}
            </Select>
          </Field>

          <Field label="Issue date" htmlFor="vm-doc-issue">
            <TextInput id="vm-doc-issue" type="date" value={form.issueDate} onChange={(e) => set('issueDate', e.target.value)} />
          </Field>

          <Field label="Expiry date" htmlFor="vm-doc-expiry" error={errorFor('expiryDate')}
            hint="Used to warn you before it lapses">
            <TextInput id="vm-doc-expiry" type="date" value={form.expiryDate} error={errorFor('expiryDate')}
              onChange={(e) => set('expiryDate', e.target.value)}
              onBlur={() => setTouched((p) => ({ ...p, expiryDate: true }))} />
          </Field>

          <Field label="Description" htmlFor="vm-doc-description" wide>
            <TextArea id="vm-doc-description" rows={2} value={form.description} onChange={(e) => set('description', e.target.value)} />
          </Field>
        </div>
      </form>
    </Modal>
  );
};

const VendorDocumentsTab = ({ vendorId, meta, canManage, onChanged }) => {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState(null);
  const [busy, setBusy] = useState(false);
  const [replacing, setReplacing] = useState(null);
  const replaceRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await vendorApi.documents(vendorId, { limit: 100 });
      setDocuments(data.documents || []);
    } catch (err) {
      setError(err.message);
      reportError(err, 'Unable to load documents');
    } finally {
      setLoading(false);
    }
  }, [vendorId]);

  useEffect(() => { load(); }, [load]);

  const save = async (form, file) => {
    setSaving(true);
    try {
      if (editing?._id) {
        await vendorApi.updateDocument(vendorId, editing._id, form);
        notifySuccess('Document updated', `"${form.name}" has been updated.`);
      } else {
        const formData = new FormData();
        formData.append('file', file);
        Object.entries(form).forEach(([key, value]) => {
          if (value !== '' && value !== null && value !== undefined) formData.append(key, value);
        });
        await vendorApi.uploadDocument(vendorId, formData);
        notifySuccess('Document uploaded', `"${form.name}" has been uploaded.`);
      }
      setEditing(null);
      await load();
      onChanged?.();
    } catch (err) {
      reportError(err, 'Could not save the document');
    } finally {
      setSaving(false);
    }
  };

  const replaceFile = async (doc, file) => {
    const message = validateDocumentFile(file);
    if (message) { reportError({ message }, 'Cannot replace the file'); return; }

    setBusy(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      await vendorApi.replaceDocumentFile(vendorId, doc._id, formData);
      notifySuccess('File replaced', `A new file has been attached to "${doc.name}".`);
      await load();
      onChanged?.();
    } catch (err) {
      reportError(err, 'Could not replace the file');
    } finally {
      setBusy(false);
      setReplacing(null);
      if (replaceRef.current) replaceRef.current.value = '';
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await vendorApi.deleteDocument(vendorId, toDelete._id);
      notifySuccess('Document deleted', `"${toDelete.name}" has been deleted.`);
      setToDelete(null);
      await load();
      onChanged?.();
    } catch (err) {
      reportError(err, 'Could not delete the document');
    } finally {
      setBusy(false);
    }
  };

  const download = async (doc) => {
    try {
      await vendorFiles.downloadDocument(vendorId, doc._id, doc.originalName);
    } catch (err) {
      reportError(err, 'Download failed');
    }
  };

  const preview = async (doc) => {
    try {
      await vendorFiles.previewDocument(vendorId, doc._id);
    } catch (err) {
      reportError(err, 'Preview failed');
    }
  };

  const expiringCount = documents.filter((d) => d.expiryState === 'expiring' || d.expiryState === 'expired').length;

  return (
    <div>
      <div className="vm-card-header">
        <div>
          <h3>Documents</h3>
          <p className="vm-card-subtitle">
            {loading ? 'Loading…' : `${documents.length} document${documents.length === 1 ? '' : 's'}`}
          </p>
        </div>
        {canManage && (
          <button type="button" className="vm-btn vm-btn-success vm-btn-sm" onClick={() => setEditing({})}>
            <FiPlus aria-hidden="true" /> Upload document
          </button>
        )}
      </div>

      {!loading && expiringCount > 0 && (
        <Alert type="warning">
          {expiringCount} document{expiringCount === 1 ? ' has' : 's have'} expired or will expire within 30 days.
        </Alert>
      )}

      {loading && <TableSkeleton rows={4} columns={6} />}
      {!loading && error && <ErrorState message={error} onRetry={load} />}

      {!loading && !error && documents.length === 0 && (
        <EmptyState
          title="No documents yet"
          message="Upload GST certificates, agreements, bank proofs and compliance documents to keep them in one place."
          action={canManage && (
            <button type="button" className="vm-btn vm-btn-success" onClick={() => setEditing({})}>
              <FiPlus aria-hidden="true" /> Upload document
            </button>
          )}
        />
      )}

      {!loading && !error && documents.length > 0 && (
        <div className="vm-table-wrapper">
          <table className="vm-table">
            <caption className="vm-sr-only">Documents held for this vendor</caption>
            <thead>
              <tr>
                <th scope="col">Document</th>
                <th scope="col">Type</th>
                <th scope="col">Issued</th>
                <th scope="col">Expiry</th>
                <th scope="col">Uploaded by</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {documents.map((doc) => (
                <tr key={doc._id}>
                  <td data-label="Document">
                    <span className="vm-cell-primary">
                      <FiFile aria-hidden="true" style={{ marginRight: 6, verticalAlign: '-2px' }} />
                      {doc.name}
                    </span>
                    <div className="vm-cell-muted">
                      {doc.originalName} · {formatBytes(doc.sizeBytes)}
                    </div>
                    {doc.description && <div className="vm-cell-muted">{doc.description}</div>}
                  </td>
                  <td data-label="Type">{doc.documentType}</td>
                  <td data-label="Issued">{formatDate(doc.issueDate)}</td>
                  <td data-label="Expiry">
                    <ExpiryBadge state={doc.expiryState} days={doc.daysToExpiry} />
                    {doc.expiryDate && <div className="vm-cell-muted">{formatDate(doc.expiryDate)}</div>}
                  </td>
                  <td data-label="Uploaded by">
                    {doc.uploadedByName || '—'}
                    <div className="vm-cell-muted">{formatDate(doc.createdAt)}</div>
                  </td>
                  <td data-label="Actions">
                    <div className="vm-cell-actions">
                      {/* Preview is only offered for types a browser can safely render. */}
                      {doc.canPreview && (
                        <button type="button" className="vm-icon-btn" title="Preview"
                          aria-label={`Preview ${doc.name}`} onClick={() => preview(doc)}>
                          <FiEye />
                        </button>
                      )}
                      <button type="button" className="vm-icon-btn" title="Download"
                        aria-label={`Download ${doc.name}`} onClick={() => download(doc)}>
                        <FiDownload />
                      </button>
                      {canManage && (
                        <>
                          <button type="button" className="vm-icon-btn" title="Replace file"
                            aria-label={`Replace the file for ${doc.name}`}
                            disabled={busy}
                            onClick={() => { setReplacing(doc); replaceRef.current?.click(); }}>
                            <FiRefreshCw />
                          </button>
                          <button type="button" className="vm-icon-btn" title="Edit details"
                            aria-label={`Edit details for ${doc.name}`} onClick={() => setEditing(doc)}>
                            <FiEdit2 />
                          </button>
                          <button type="button" className="vm-icon-btn vm-danger" title="Delete"
                            aria-label={`Delete ${doc.name}`} onClick={() => setToDelete(doc)}>
                            <FiTrash2 />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Hidden input driving the "replace file" action. */}
      <input
        ref={replaceRef}
        type="file"
        className="vm-sr-only"
        accept={ALLOWED_DOCUMENT_EXTENSIONS.join(',')}
        aria-hidden="true"
        tabIndex={-1}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file && replacing) replaceFile(replacing, file);
        }}
      />

      {editing && (
        <UploadForm
          document={editing._id ? editing : null}
          meta={meta}
          saving={saving}
          onClose={() => setEditing(null)}
          onSubmit={save}
        />
      )}

      {toDelete && (
        <ConfirmDialog
          title="Delete this document?"
          message={`"${toDelete.name}" and its uploaded file will be permanently deleted. This cannot be undone.`}
          confirmLabel="Delete document"
          busy={busy}
          onConfirm={remove}
          onCancel={() => setToDelete(null)}
        />
      )}
    </div>
  );
};

export default VendorDocumentsTab;
