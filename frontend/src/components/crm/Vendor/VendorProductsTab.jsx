// Products & services supplied by a vendor, with vendor-specific pricing.
//
// Products come from the CRM's existing Product master — this screen links to
// them, it never creates duplicate product records. The commercial terms
// (vendor item code, price, quantity breaks, MOQ, lead time, validity window)
// belong to the vendor↔product link.

import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { FiPlus, FiEdit2, FiTrash2, FiSearch, FiStar } from 'react-icons/fi';

import { vendorApi } from '../../../utils/vendorApi';
import { validateVendorProductForm, hasErrors } from '../../../utils/vendorValidation';
import { useDebounced } from './useVendorMeta';
import {
  Modal, ConfirmDialog, Field, TextInput, Select, TextArea, Alert, EmptyState,
  ErrorState, TableSkeleton, Pagination, notifySuccess, reportError, formatDate, formatMoney,
} from './VendorUI';

const blankItem = {
  product: '',
  vendorItemCode: '',
  purchasePrice: '',
  currency: 'INR',
  moq: 1,
  leadTimeDays: 0,
  taxRate: 0,
  discountPercent: 0,
  effectiveFrom: new Date().toISOString().slice(0, 10),
  effectiveTo: '',
  notes: '',
  isActive: true,
  isPreferred: false,
  priceTiers: [],
};

/* Product picker: searches the existing product catalogue through the CRM's
 * established /products/search endpoint rather than loading every product. */
const ProductPicker = ({ value, valueLabel, onSelect, error, disabled }) => {
  const [term, setTerm] = useState('');
  const debounced = useDebounced(term, 350);
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!debounced.trim()) { setResults([]); return undefined; }

    const controller = new AbortController();
    setSearching(true);
    axios
      .get(`${import.meta.env.VITE_API_URL}/products/search`, {
        params: { query: debounced },
        signal: controller.signal,
      })
      .then((res) => {
        const list = res.data?.products || res.data || [];
        setResults(Array.isArray(list) ? list.slice(0, 20) : []);
      })
      .catch(() => { /* a failed lookup just shows no results */ })
      .finally(() => setSearching(false));

    return () => controller.abort();
  }, [debounced]);

  if (value && !open) {
    return (
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        <TextInput id="vm-p-product" value={valueLabel} readOnly disabled />
        {!disabled && (
          <button type="button" className="vm-btn vm-btn-ghost vm-btn-sm" onClick={() => setOpen(true)}>
            Change
          </button>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="vm-search">
        <FiSearch aria-hidden="true" />
        <TextInput
          id="vm-p-product"
          value={term}
          error={error}
          placeholder="Search products by name or code"
          onChange={(e) => setTerm(e.target.value)}
          autoComplete="off"
        />
      </div>

      {searching && <p className="vm-hint" style={{ marginTop: '0.4rem' }}>Searching…</p>}

      {!searching && debounced && results.length === 0 && (
        <p className="vm-hint" style={{ marginTop: '0.4rem' }}>
          No products match &ldquo;{debounced}&rdquo;. Products are managed in Product Management.
        </p>
      )}

      {results.length > 0 && (
        <div className="vm-menu-panel" style={{ position: 'static', marginTop: '0.4rem', width: '100%' }}>
          {results.map((product) => (
            <button
              key={product._id}
              type="button"
              className="vm-btn vm-btn-ghost vm-btn-sm"
              style={{ width: '100%', justifyContent: 'flex-start', marginBottom: '0.25rem' }}
              onClick={() => {
                onSelect(product);
                setOpen(false);
                setTerm('');
                setResults([]);
              }}
            >
              {product.p_name} {product.p_code ? `· ${product.p_code}` : ''}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const ItemForm = ({ item, meta, onClose, onSubmit, saving }) => {
  const [form, setForm] = useState(() => {
    if (!item) return { ...blankItem };
    return {
      ...blankItem,
      ...item,
      product: item.product?._id || item.product || '',
      effectiveFrom: item.effectiveFrom ? String(item.effectiveFrom).slice(0, 10) : '',
      effectiveTo: item.effectiveTo ? String(item.effectiveTo).slice(0, 10) : '',
      priceTiers: item.priceTiers || [],
    };
  });
  const [productLabel, setProductLabel] = useState(
    item?.product?.p_name ? `${item.product.p_name}${item.product.p_code ? ` · ${item.product.p_code}` : ''}` : ''
  );
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});

  const set = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));
  const errorFor = (field) => (touched[field] ? errors[field] : '');

  useEffect(() => { setErrors(validateVendorProductForm(form)); }, [form]);

  const setTier = (index, field, value) => setForm((prev) => ({
    ...prev,
    priceTiers: prev.priceTiers.map((t, i) => (i === index ? { ...t, [field]: value } : t)),
  }));

  const addTier = () => setForm((prev) => ({
    ...prev,
    priceTiers: [...prev.priceTiers, { minQty: '', maxQty: '', unitPrice: '', discountPercent: 0 }],
  }));

  const removeTier = (index) => setForm((prev) => ({
    ...prev,
    priceTiers: prev.priceTiers.filter((_, i) => i !== index),
  }));

  const handleSubmit = (event) => {
    event.preventDefault();
    const found = validateVendorProductForm(form);
    setErrors(found);
    setTouched(Object.fromEntries(Object.keys(found).map((k) => [k, true])));
    if (hasErrors(found)) return;

    onSubmit({
      ...form,
      purchasePrice: Number(form.purchasePrice),
      moq: Number(form.moq) || 0,
      leadTimeDays: Number(form.leadTimeDays) || 0,
      taxRate: Number(form.taxRate) || 0,
      discountPercent: Number(form.discountPercent) || 0,
      effectiveTo: form.effectiveTo || null,
      priceTiers: form.priceTiers.map((t) => ({
        minQty: Number(t.minQty),
        maxQty: t.maxQty === '' || t.maxQty === null ? null : Number(t.maxQty),
        unitPrice: Number(t.unitPrice),
        discountPercent: Number(t.discountPercent) || 0,
      })),
    });
  };

  return (
    <Modal
      title={item ? 'Edit pricing record' : 'Add a product to this vendor'}
      subtitle="Vendor-specific commercial terms. The product itself stays in Product Management."
      size="lg"
      onClose={onClose}
      footer={(
        <>
          <button type="button" className="vm-btn vm-btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="submit" form="vm-item-form" className="vm-btn vm-btn-success" disabled={saving}>
            {saving && <span className="vm-spinner" aria-hidden="true" />}
            {saving ? 'Saving…' : 'Save'}
          </button>
        </>
      )}
    >
      <form id="vm-item-form" noValidate onSubmit={handleSubmit}>
        <fieldset className="vm-fieldset">
          <legend>Product</legend>
          <Field label="Product" htmlFor="vm-p-product" required error={errorFor('product')} wide>
            <ProductPicker
              value={form.product}
              valueLabel={productLabel}
              error={errorFor('product')}
              disabled={Boolean(item)}
              onSelect={(product) => {
                set('product', product._id);
                setProductLabel(`${product.p_name}${product.p_code ? ` · ${product.p_code}` : ''}`);
                setTouched((p) => ({ ...p, product: true }));
              }}
            />
          </Field>
          {item && (
            <p className="vm-hint" style={{ marginTop: '0.5rem' }}>
              The product cannot be changed on an existing record. Delete it and add a new one instead.
            </p>
          )}

          <div className="vm-form-grid" style={{ marginTop: '1rem' }}>
            <Field label="Vendor's item code" htmlFor="vm-p-code" hint="How the vendor refers to it">
              <TextInput id="vm-p-code" value={form.vendorItemCode} onChange={(e) => set('vendorItemCode', e.target.value)} />
            </Field>
          </div>
        </fieldset>

        <fieldset className="vm-fieldset">
          <legend>Commercial terms</legend>
          <div className="vm-form-grid">
            <Field label="Purchase price" htmlFor="vm-p-price" required error={errorFor('purchasePrice')}>
              <TextInput id="vm-p-price" type="number" min="0" step="0.01" value={form.purchasePrice}
                error={errorFor('purchasePrice')}
                onChange={(e) => set('purchasePrice', e.target.value)}
                onBlur={() => setTouched((p) => ({ ...p, purchasePrice: true }))} />
            </Field>

            <Field label="Currency" htmlFor="vm-p-currency">
              <Select id="vm-p-currency" value={form.currency} onChange={(e) => set('currency', e.target.value)}>
                {meta.currencies.map((c) => <option key={c} value={c}>{c}</option>)}
              </Select>
            </Field>

            <Field label="Minimum order quantity" htmlFor="vm-p-moq" error={errorFor('moq')}>
              <TextInput id="vm-p-moq" type="number" min="0" value={form.moq} error={errorFor('moq')}
                onChange={(e) => set('moq', e.target.value)}
                onBlur={() => setTouched((p) => ({ ...p, moq: true }))} />
            </Field>

            <Field label="Lead time (days)" htmlFor="vm-p-lead" error={errorFor('leadTimeDays')}>
              <TextInput id="vm-p-lead" type="number" min="0" value={form.leadTimeDays} error={errorFor('leadTimeDays')}
                onChange={(e) => set('leadTimeDays', e.target.value)}
                onBlur={() => setTouched((p) => ({ ...p, leadTimeDays: true }))} />
            </Field>

            <Field label="Tax rate (%)" htmlFor="vm-p-tax" error={errorFor('taxRate')}>
              <TextInput id="vm-p-tax" type="number" min="0" max="100" step="0.01" value={form.taxRate} error={errorFor('taxRate')}
                onChange={(e) => set('taxRate', e.target.value)}
                onBlur={() => setTouched((p) => ({ ...p, taxRate: true }))} />
            </Field>

            <Field label="Discount (%)" htmlFor="vm-p-discount" error={errorFor('discountPercent')}>
              <TextInput id="vm-p-discount" type="number" min="0" max="100" step="0.01" value={form.discountPercent}
                error={errorFor('discountPercent')}
                onChange={(e) => set('discountPercent', e.target.value)}
                onBlur={() => setTouched((p) => ({ ...p, discountPercent: true }))} />
            </Field>

            <Field label="Effective from" htmlFor="vm-p-from">
              <TextInput id="vm-p-from" type="date" value={form.effectiveFrom} onChange={(e) => set('effectiveFrom', e.target.value)} />
            </Field>

            <Field label="Effective until" htmlFor="vm-p-to" error={errorFor('effectiveTo')}
              hint="Leave blank for an open-ended price">
              <TextInput id="vm-p-to" type="date" value={form.effectiveTo} error={errorFor('effectiveTo')}
                onChange={(e) => set('effectiveTo', e.target.value)}
                onBlur={() => setTouched((p) => ({ ...p, effectiveTo: true }))} />
            </Field>

            <Field label="Notes" htmlFor="vm-p-notes" wide>
              <TextArea id="vm-p-notes" rows={2} value={form.notes} onChange={(e) => set('notes', e.target.value)} />
            </Field>
          </div>

          <div style={{ display: 'flex', gap: '1.5rem', marginTop: '1rem', flexWrap: 'wrap' }}>
            <label className="vm-checkbox">
              <input type="checkbox" checked={form.isActive} onChange={(e) => set('isActive', e.target.checked)} />
              Active
            </label>
            <label className="vm-checkbox">
              <input type="checkbox" checked={form.isPreferred} onChange={(e) => set('isPreferred', e.target.checked)} />
              Preferred source for this product
            </label>
          </div>
        </fieldset>

        {/* --------------------- Quantity price breaks --------------------- */}
        <fieldset className="vm-fieldset">
          <legend>Quantity price breaks</legend>
          <p className="vm-hint" style={{ marginBottom: '0.85rem' }}>
            Optional. Leave the maximum blank on the last tier to mean &ldquo;and above&rdquo;.
            Ranges must not overlap.
          </p>

          {errors.priceTiers && <Alert type="error">{errors.priceTiers}</Alert>}

          {form.priceTiers.map((tier, index) => (
            <div className="vm-form-grid" key={index} style={{ marginBottom: '0.75rem', alignItems: 'end' }}>
              <Field label="Min qty" htmlFor={`vm-tier-min-${index}`}>
                <TextInput id={`vm-tier-min-${index}`} type="number" min="0" value={tier.minQty}
                  onChange={(e) => setTier(index, 'minQty', e.target.value)} />
              </Field>
              <Field label="Max qty" htmlFor={`vm-tier-max-${index}`}>
                <TextInput id={`vm-tier-max-${index}`} type="number" min="0" value={tier.maxQty ?? ''}
                  placeholder="and above"
                  onChange={(e) => setTier(index, 'maxQty', e.target.value)} />
              </Field>
              <Field label="Unit price" htmlFor={`vm-tier-price-${index}`}>
                <TextInput id={`vm-tier-price-${index}`} type="number" min="0" step="0.01" value={tier.unitPrice}
                  onChange={(e) => setTier(index, 'unitPrice', e.target.value)} />
              </Field>
              <Field label="Discount (%)" htmlFor={`vm-tier-disc-${index}`}>
                <TextInput id={`vm-tier-disc-${index}`} type="number" min="0" max="100" value={tier.discountPercent ?? 0}
                  onChange={(e) => setTier(index, 'discountPercent', e.target.value)} />
              </Field>
              <div className="vm-field">
                <span className="vm-sr-only">Remove tier {index + 1}</span>
                <button type="button" className="vm-btn vm-btn-ghost vm-btn-sm" onClick={() => removeTier(index)}>
                  Remove
                </button>
              </div>
            </div>
          ))}

          <button type="button" className="vm-btn vm-btn-ghost vm-btn-sm" onClick={addTier}>
            <FiPlus aria-hidden="true" /> Add price break
          </button>
        </fieldset>
      </form>
    </Modal>
  );
};

const VendorProductsTab = ({ vendorId, meta, canEdit, onChanged }) => {
  const [items, setItems] = useState([]);
  const [pageInfo, setPageInfo] = useState({ total: 0, page: 1, pages: 1 });
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await vendorApi.products(vendorId, { page, limit });
      setItems(data.items || []);
      setPageInfo({ total: data.total || 0, page: data.page || 1, pages: data.pages || 1 });
    } catch (err) {
      setError(err.message);
      reportError(err, 'Unable to load products');
    } finally {
      setLoading(false);
    }
  }, [vendorId, page, limit]);

  useEffect(() => { load(); }, [load]);

  const save = async (form) => {
    setSaving(true);
    try {
      if (editing?._id) await vendorApi.updateProduct(vendorId, editing._id, form);
      else await vendorApi.addProduct(vendorId, form);
      notifySuccess('Saved', 'The vendor pricing record has been saved.');
      setEditing(null);
      await load();
      onChanged?.();
    } catch (err) {
      reportError(err, 'Could not save the record');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await vendorApi.deleteProduct(vendorId, toDelete._id);
      notifySuccess('Removed', 'The product has been removed from this vendor.');
      setToDelete(null);
      await load();
      onChanged?.();
    } catch (err) {
      reportError(err, 'Could not remove the product');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="vm-card-header">
        <div>
          <h3>Products &amp; services</h3>
          <p className="vm-card-subtitle">
            {loading ? 'Loading…' : `${pageInfo.total} record${pageInfo.total === 1 ? '' : 's'}`}
          </p>
        </div>
        {canEdit && (
          <button type="button" className="vm-btn vm-btn-success vm-btn-sm" onClick={() => setEditing({})}>
            <FiPlus aria-hidden="true" /> Add product
          </button>
        )}
      </div>

      {loading && <TableSkeleton rows={4} columns={7} />}
      {!loading && error && <ErrorState message={error} onRetry={load} />}

      {!loading && !error && items.length === 0 && (
        <EmptyState
          title="No products linked yet"
          message="Link the products this vendor supplies to record their pricing, MOQ and lead times."
          action={canEdit && (
            <button type="button" className="vm-btn vm-btn-success" onClick={() => setEditing({})}>
              <FiPlus aria-hidden="true" /> Add product
            </button>
          )}
        />
      )}

      {!loading && !error && items.length > 0 && (
        <>
          <div className="vm-table-wrapper">
            <table className="vm-table">
              <caption className="vm-sr-only">Products supplied by this vendor</caption>
              <thead>
                <tr>
                  <th scope="col">Product</th>
                  <th scope="col">Vendor code</th>
                  <th scope="col">Price</th>
                  <th scope="col">MOQ</th>
                  <th scope="col">Lead time</th>
                  <th scope="col">Valid</th>
                  <th scope="col">Status</th>
                  {canEdit && <th scope="col">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item._id}>
                    <td data-label="Product">
                      <span className="vm-cell-primary">
                        {item.isPreferred && <FiStar aria-label="Preferred source" style={{ color: '#f59e0b', marginRight: 4 }} />}
                        {item.product?.p_name || 'Product no longer available'}
                      </span>
                      {item.product?.p_code && <div className="vm-cell-muted">{item.product.p_code}</div>}
                      {item.priceTiers?.length > 0 && (
                        <div className="vm-cell-muted">{item.priceTiers.length} price break{item.priceTiers.length === 1 ? '' : 's'}</div>
                      )}
                    </td>
                    <td data-label="Vendor code">{item.vendorItemCode || '—'}</td>
                    <td data-label="Price">{formatMoney(item.purchasePrice, item.currency)}</td>
                    <td data-label="MOQ">{item.moq ?? '—'}</td>
                    <td data-label="Lead time">{item.leadTimeDays ? `${item.leadTimeDays} days` : '—'}</td>
                    <td data-label="Valid">
                      {formatDate(item.effectiveFrom)}
                      {item.effectiveTo ? ` – ${formatDate(item.effectiveTo)}` : ' onwards'}
                    </td>
                    <td data-label="Status">
                      <span className={`vm-badge ${item.isActive ? 'vm-status-active' : 'vm-status-inactive'}`}>
                        {item.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    {canEdit && (
                      <td data-label="Actions">
                        <div className="vm-cell-actions">
                          <button type="button" className="vm-icon-btn" title="Edit pricing"
                            aria-label={`Edit pricing for ${item.product?.p_name || 'this product'}`}
                            onClick={() => setEditing(item)}>
                            <FiEdit2 />
                          </button>
                          <button type="button" className="vm-icon-btn vm-danger" title="Remove product"
                            aria-label={`Remove ${item.product?.p_name || 'this product'} from the vendor`}
                            onClick={() => setToDelete(item)}>
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

          <Pagination
            page={pageInfo.page}
            pages={pageInfo.pages}
            total={pageInfo.total}
            limit={limit}
            onPageChange={setPage}
            onLimitChange={(n) => { setLimit(n); setPage(1); }}
          />
        </>
      )}

      {editing && (
        <ItemForm
          item={editing._id ? editing : null}
          meta={meta}
          saving={saving}
          onClose={() => setEditing(null)}
          onSubmit={save}
        />
      )}

      {toDelete && (
        <ConfirmDialog
          title="Remove this product from the vendor?"
          message={`"${toDelete.product?.p_name || 'This product'}" will no longer be listed as supplied by this vendor. The product itself stays in Product Management and is not affected.`}
          confirmLabel="Remove product"
          busy={busy}
          onConfirm={remove}
          onCancel={() => setToDelete(null)}
        />
      )}
    </div>
  );
};

export default VendorProductsTab;
