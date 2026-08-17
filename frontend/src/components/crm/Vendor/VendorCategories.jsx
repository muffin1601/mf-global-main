// Vendor categories — configurable master data.
//
// A category that is in use is never silently removed: the user either
// deactivates it (it stays on existing vendors but is no longer offered) or
// picks a category to move the affected vendors to.

import React, { useCallback, useEffect, useState } from 'react';
import { FiPlus, FiEdit2, FiTrash2 } from 'react-icons/fi';

import { vendorApi } from '../../../utils/vendorApi';
import { useVendorMeta } from './useVendorMeta';
import {
  Modal, ConfirmDialog, Field, TextInput, TextArea, Alert, EmptyState, ErrorState,
  TableSkeleton, notifySuccess, reportError, formatDate,
} from './VendorUI';
import '../../../styles/crm/Vendor.css';

const CategoryForm = ({ category, onClose, onSubmit, saving }) => {
  const [form, setForm] = useState({
    name: '', description: '', isActive: true, sortOrder: 0, ...(category || {}),
  });
  const [error, setError] = useState('');

  const set = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = (event) => {
    event.preventDefault();
    const name = String(form.name || '').trim();
    if (!name) { setError('Category name is required'); return; }
    if (name.length < 2) { setError('Enter at least 2 characters'); return; }
    setError('');
    onSubmit({ ...form, name, sortOrder: Number(form.sortOrder) || 0 });
  };

  return (
    <Modal
      title={category ? `Edit ${category.name}` : 'Add a vendor category'}
      size="sm"
      onClose={onClose}
      footer={(
        <>
          <button type="button" className="vm-btn vm-btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="submit" form="vm-cat-form" className="vm-btn vm-btn-success" disabled={saving}>
            {saving && <span className="vm-spinner" aria-hidden="true" />}
            {saving ? 'Saving…' : 'Save category'}
          </button>
        </>
      )}
    >
      <form id="vm-cat-form" noValidate onSubmit={handleSubmit}>
        <Field label="Category name" htmlFor="vm-cat-name" required error={error}>
          <TextInput id="vm-cat-name" value={form.name} error={error}
            onChange={(e) => set('name', e.target.value)}
            placeholder="e.g. Raw Materials" />
        </Field>

        <div style={{ marginTop: '1rem' }}>
          <Field label="Description" htmlFor="vm-cat-desc">
            <TextArea id="vm-cat-desc" rows={3} value={form.description} onChange={(e) => set('description', e.target.value)} />
          </Field>
        </div>

        <div style={{ marginTop: '1rem' }}>
          <Field label="Sort order" htmlFor="vm-cat-order" hint="Lower numbers appear first">
            <TextInput id="vm-cat-order" type="number" value={form.sortOrder} onChange={(e) => set('sortOrder', e.target.value)} />
          </Field>
        </div>

        <label className="vm-checkbox" style={{ marginTop: '1rem' }}>
          <input type="checkbox" checked={form.isActive} onChange={(e) => set('isActive', e.target.checked)} />
          Active — offer this category when creating or editing vendors
        </label>
      </form>
    </Modal>
  );
};

// Deleting a category that is in use requires choosing where its vendors go.
const ReassignDialog = ({ category, categories, onClose, onSubmit, busy }) => {
  const [target, setTarget] = useState('');
  const options = categories.filter((c) => c._id !== category._id);

  return (
    <Modal
      title="Move these vendors first"
      subtitle={`${category.vendorCount} vendor${category.vendorCount === 1 ? ' is' : 's are'} using "${category.name}"`}
      size="sm"
      onClose={onClose}
      footer={(
        <>
          <button type="button" className="vm-btn vm-btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="button" className="vm-btn vm-btn-danger" onClick={() => onSubmit(target)} disabled={busy || !target}>
            {busy && <span className="vm-spinner" aria-hidden="true" />}
            {busy ? 'Working…' : 'Move and delete'}
          </button>
        </>
      )}
    >
      {options.length === 0 ? (
        <Alert type="warning">
          There is no other category to move these vendors to. Create one first,
          or deactivate this category instead of deleting it.
        </Alert>
      ) : (
        <>
          <p style={{ marginTop: 0, color: '#374151', fontSize: '0.92rem' }}>
            Choose the category these vendors should move to. They will be reassigned
            and then &ldquo;{category.name}&rdquo; will be deleted.
          </p>
          <div className="vm-field">
            <label htmlFor="vm-reassign">Move vendors to</label>
            <select id="vm-reassign" className="vm-select" value={target} onChange={(e) => setTarget(e.target.value)}>
              <option value="">Select a category…</option>
              {options.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
            </select>
          </div>
        </>
      )}
    </Modal>
  );
};

const VendorCategories = () => {
  const { can } = useVendorMeta();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState(null);
  const [reassigning, setReassigning] = useState(null);
  const [busy, setBusy] = useState(false);

  const canManage = can('vendor.manage_categories');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await vendorApi.categories();
      setCategories(data.categories || []);
    } catch (err) {
      setError(err.message);
      reportError(err, 'Unable to load vendor categories');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async (form) => {
    setSaving(true);
    try {
      if (editing?._id) await vendorApi.updateCategory(editing._id, form);
      else await vendorApi.createCategory(form);
      notifySuccess('Category saved', `"${form.name}" has been saved.`);
      setEditing(null);
      await load();
    } catch (err) {
      reportError(err, 'Could not save the category');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (category) => {
    try {
      await vendorApi.updateCategory(category._id, { isActive: !category.isActive });
      notifySuccess(
        category.isActive ? 'Category deactivated' : 'Category activated',
        category.isActive
          ? `"${category.name}" will no longer be offered for new vendors.`
          : `"${category.name}" is available again.`
      );
      await load();
    } catch (err) {
      reportError(err, 'Could not update the category');
    }
  };

  const askDelete = (category) => {
    // In-use categories go through the reassignment flow instead.
    if (category.vendorCount > 0) setReassigning(category);
    else setToDelete(category);
  };

  const remove = async (reassignTo) => {
    const category = reassigning || toDelete;
    setBusy(true);
    try {
      const result = await vendorApi.deleteCategory(category._id, reassignTo);
      notifySuccess(
        'Category deleted',
        result.vendorsReassigned
          ? `"${category.name}" was deleted and ${result.vendorsReassigned} vendor${result.vendorsReassigned === 1 ? '' : 's'} moved.`
          : `"${category.name}" has been deleted.`
      );
      setToDelete(null);
      setReassigning(null);
      await load();
    } catch (err) {
      reportError(err, 'Could not delete the category');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="vm-module">
      <section className="vm-card">
        <div className="vm-card-header">
          <div>
            <h2>Vendor categories</h2>
            <p className="vm-card-subtitle">
              Group vendors by what they supply. Categories are configurable — add the ones your business uses.
            </p>
          </div>
          {canManage && (
            <button type="button" className="vm-btn vm-btn-success" onClick={() => setEditing({})}>
              <FiPlus aria-hidden="true" /> Add category
            </button>
          )}
        </div>

        {loading && <TableSkeleton rows={4} columns={5} />}
        {!loading && error && <ErrorState message={error} onRetry={load} />}

        {!loading && !error && categories.length === 0 && (
          <EmptyState
            title="No categories yet"
            message="Add categories such as Raw Materials, Packaging, Logistics or Services to organise your vendors."
            action={canManage && (
              <button type="button" className="vm-btn vm-btn-success" onClick={() => setEditing({})}>
                <FiPlus aria-hidden="true" /> Add category
              </button>
            )}
          />
        )}

        {!loading && !error && categories.length > 0 && (
          <div className="vm-table-wrapper">
            <table className="vm-table">
              <caption className="vm-sr-only">Vendor categories</caption>
              <thead>
                <tr>
                  <th scope="col">Category</th>
                  <th scope="col">Code</th>
                  <th scope="col">Vendors</th>
                  <th scope="col">Status</th>
                  <th scope="col">Created</th>
                  {canManage && <th scope="col">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {categories.map((category) => (
                  <tr key={category._id}>
                    <td data-label="Category">
                      <span className="vm-cell-primary">{category.name}</span>
                      {category.description && <div className="vm-cell-muted">{category.description}</div>}
                    </td>
                    <td data-label="Code" className="vm-cell-muted">{category.code}</td>
                    <td data-label="Vendors">{category.vendorCount}</td>
                    <td data-label="Status">
                      <span className={`vm-badge ${category.isActive ? 'vm-status-active' : 'vm-status-inactive'}`}>
                        {category.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td data-label="Created">{formatDate(category.createdAt)}</td>
                    {canManage && (
                      <td data-label="Actions">
                        <div className="vm-cell-actions">
                          <button type="button" className="vm-btn vm-btn-ghost vm-btn-sm" onClick={() => toggleActive(category)}>
                            {category.isActive ? 'Deactivate' : 'Activate'}
                          </button>
                          <button type="button" className="vm-icon-btn" title="Edit category"
                            aria-label={`Edit ${category.name}`} onClick={() => setEditing(category)}>
                            <FiEdit2 />
                          </button>
                          <button type="button" className="vm-icon-btn vm-danger" title="Delete category"
                            aria-label={`Delete ${category.name}`} onClick={() => askDelete(category)}>
                            <FiTrash2 />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {editing && (
        <CategoryForm
          category={editing._id ? editing : null}
          saving={saving}
          onClose={() => setEditing(null)}
          onSubmit={save}
        />
      )}

      {reassigning && (
        <ReassignDialog
          category={reassigning}
          categories={categories}
          busy={busy}
          onClose={() => setReassigning(null)}
          onSubmit={remove}
        />
      )}

      {toDelete && (
        <ConfirmDialog
          title="Delete this category?"
          message={`"${toDelete.name}" is not used by any vendor and will be deleted.`}
          confirmLabel="Delete category"
          busy={busy}
          onConfirm={() => remove()}
          onCancel={() => setToDelete(null)}
        />
      )}
    </div>
  );
};

export default VendorCategories;
