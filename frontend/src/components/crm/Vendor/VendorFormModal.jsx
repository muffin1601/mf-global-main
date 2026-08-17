// Create / edit vendor.
//
// Validation is inline and immediate, but the server re-validates everything —
// this form is a convenience, not a gate. Likely duplicates are surfaced as the
// user types so they can review before submitting rather than being surprised
// by a rejection.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { vendorApi } from '../../../utils/vendorApi';
import { validateVendorForm, validateBankForm, hasErrors, normalizeCode } from '../../../utils/vendorValidation';
import { useDebounced } from './useVendorMeta';
import { Modal, Field, TextInput, Select, TextArea, Alert, notifySuccess, reportError } from './VendorUI';

const blankForm = {
  name: '',
  legalName: '',
  type: '',
  category: '',
  status: 'Pending',
  priority: 'Medium',
  website: '',
  gstin: '',
  pan: '',
  cin: '',
  taxRegistration: '',
  industry: '',
  description: '',
  tags: '',
  owner: '',
  contact_name: '',
  phone: '',
  email: '',
  addr1: '',
  addr2: '',
  city: '',
  state: '',
  pin_code: '',
};

const blankBank = {
  bankName: '',
  accountHolderName: '',
  accountNumber: '',
  ifsc: '',
  branch: '',
  upi: '',
  paymentTerms: '',
  creditPeriodDays: '',
  currency: 'INR',
  preferredPaymentMethod: '',
};

const VendorFormModal = ({ vendor, meta, metaLoading, can, onClose, onSaved }) => {
  const isEdit = Boolean(vendor?._id);
  const canEditBank = can('vendor.edit_bank');

  const [form, setForm] = useState(blankForm);
  const [bank, setBank] = useState(blankBank);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');
  const [duplicates, setDuplicates] = useState([]);
  const [duplicatesBlocking, setDuplicatesBlocking] = useState(false);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  // The updatedAt the record carried when it was loaded — sent back as the
  // optimistic-concurrency token so a concurrent edit is detected.
  const loadedAt = useRef(vendor?.updatedAt || null);
  const dupAbort = useRef(null);

  // The list row is a projection, so load the full record before editing —
  // otherwise fields absent from the projection would be blanked on save.
  const [loadingVendor, setLoadingVendor] = useState(isEdit);

  useEffect(() => {
    if (!isEdit) { setLoadingVendor(false); return; }

    let cancelled = false;
    (async () => {
      try {
        const data = await vendorApi.get(vendor._id);
        if (cancelled) return;
        const v = data.vendor;
        loadedAt.current = v.updatedAt;
        setForm({
          ...blankForm,
          ...Object.fromEntries(Object.keys(blankForm).map((k) => [k, v[k] ?? ''])),
          category: v.category?._id || '',
          owner: v.owner?._id || '',
          tags: (v.tags || []).join(', '),
        });
        // Never populate the account number: the server sends only the mask, and
        // the mask is what the user sees and re-submits if they don't change it.
        setBank({
          ...blankBank,
          ...Object.fromEntries(Object.keys(blankBank).map((k) => [k, v.bank?.[k] ?? blankBank[k]])),
          accountNumber: v.bank?.accountNumberMasked || '',
        });
      } catch (err) {
        if (!cancelled) { setServerError(err.message); reportError(err, 'Unable to load this vendor'); }
      } finally {
        if (!cancelled) setLoadingVendor(false);
      }
    })();

    return () => { cancelled = true; };
  }, [isEdit, vendor?._id]);

  /* ------------------------- Live duplicate check ------------------------- */

  const identity = useMemo(() => ({
    name: form.name, gstin: form.gstin, pan: form.pan, email: form.email, phone: form.phone,
  }), [form.name, form.gstin, form.pan, form.email, form.phone]);

  const debouncedIdentity = useDebounced(identity, 600);

  useEffect(() => {
    const { name, gstin, pan, email, phone } = debouncedIdentity;
    if (!name && !gstin && !pan && !email && !phone) {
      setDuplicates([]);
      setDuplicatesBlocking(false);
      return undefined;
    }

    dupAbort.current?.abort();
    const controller = new AbortController();
    dupAbort.current = controller;

    (async () => {
      try {
        const data = await vendorApi.checkDuplicates(
          { ...debouncedIdentity, excludeId: vendor?._id },
          { signal: controller.signal }
        );
        if (controller.signal.aborted) return;
        setDuplicates([...(data.blocking || []), ...(data.warnings || [])]);
        setDuplicatesBlocking((data.blocking || []).length > 0);
      } catch {
        // A failed pre-check is not worth interrupting the user for — the
        // server still enforces uniqueness on submit.
      }
    })();

    return () => controller.abort();
  }, [debouncedIdentity, vendor?._id]);

  /* ------------------------------- Handlers ------------------------------- */

  const validate = useCallback(() => {
    const next = validateVendorForm(form);
    if (canEditBank) {
      Object.entries(validateBankForm(bank)).forEach(([key, message]) => {
        next[`bank.${key}`] = message;
      });
    }
    setErrors(next);
    return next;
  }, [form, bank, canEditBank]);

  // Re-validate as the user edits, but only show a message for fields they
  // have already interacted with — no red text before they have typed.
  useEffect(() => { validate(); }, [validate]);

  const errorFor = (field) => (touched[field] ? errors[field] : '');
  const markTouched = (field) => setTouched((prev) => ({ ...prev, [field]: true }));

  const setField = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));
  const setBankField = (field, value) => setBank((prev) => ({ ...prev, [field]: value }));

  const buildPayload = (confirmDuplicate = false) => {
    const payload = {
      ...form,
      gstin: normalizeCode(form.gstin),
      pan: normalizeCode(form.pan),
      cin: normalizeCode(form.cin),
      category: form.category || null,
      owner: form.owner || null,
      tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
    };

    // Status is changed through the dedicated status action so it is audited
    // as a status change; the create form still sets the initial value.
    if (isEdit) delete payload.status;

    if (canEditBank) {
      payload.bank = {
        ...bank,
        creditPeriodDays: bank.creditPeriodDays === '' ? 0 : Number(bank.creditPeriodDays),
      };
    }

    if (confirmDuplicate) payload.confirmDuplicate = true;
    if (isEdit && loadedAt.current) payload.updatedAt = loadedAt.current;

    return payload;
  };

  const submit = async (confirmDuplicate = false) => {
    const found = validate();
    // Surface every message at once when the user actually tries to submit.
    setTouched(Object.fromEntries(Object.keys(found).map((k) => [k, true])));
    if (hasErrors(found)) {
      setServerError('Please correct the highlighted fields.');
      return;
    }

    setSubmitting(true);
    setServerError('');
    try {
      const payload = buildPayload(confirmDuplicate);
      const result = isEdit
        ? await vendorApi.update(vendor._id, payload)
        : await vendorApi.create(payload);

      notifySuccess(
        isEdit ? 'Vendor updated' : 'Vendor created',
        `"${result.vendor.name}" (${result.vendor.v_code}) has been saved.`
      );
      onSaved(result.vendor);
    } catch (err) {
      if (err.status === 409 && err.data?.requiresConfirmation) {
        setDuplicates(err.data.duplicates || []);
        setDuplicatesBlocking(false);
        setNeedsConfirmation(true);
        setServerError(err.message);
      } else if (err.status === 409 && err.data?.blocking) {
        setDuplicates(err.data.duplicates || []);
        setDuplicatesBlocking(true);
        setServerError(err.message);
      } else if (err.status === 400 && err.errors?.length) {
        setServerError(err.errors.join(' '));
      } else {
        setServerError(err.message);
        reportError(err, isEdit ? 'Could not update the vendor' : 'Could not create the vendor');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const footer = (
    <>
      <button type="button" className="vm-btn vm-btn-ghost" onClick={onClose} disabled={submitting}>
        Cancel
      </button>
      {needsConfirmation ? (
        <button type="button" className="vm-btn vm-btn-warning" onClick={() => submit(true)} disabled={submitting}>
          {submitting && <span className="vm-spinner" aria-hidden="true" />}
          Save anyway
        </button>
      ) : (
        <button
          type="submit"
          form="vm-vendor-form"
          className="vm-btn vm-btn-success"
          disabled={submitting || loadingVendor || duplicatesBlocking}
        >
          {submitting && <span className="vm-spinner" aria-hidden="true" />}
          {submitting ? 'Saving…' : (isEdit ? 'Save changes' : 'Create vendor')}
        </button>
      )}
    </>
  );

  return (
    <Modal
      title={isEdit ? `Edit ${vendor.name}` : 'Add a new vendor'}
      subtitle={isEdit ? vendor.v_code : 'A vendor code is generated automatically.'}
      size="lg"
      onClose={onClose}
      footer={footer}
    >
      {loadingVendor ? (
        <div aria-busy="true">
          <div className="vm-skeleton" style={{ height: 40, marginBottom: 12 }} />
          <div className="vm-skeleton" style={{ height: 40, marginBottom: 12 }} />
          <div className="vm-skeleton" style={{ height: 40 }} />
        </div>
      ) : (
        <form
          id="vm-vendor-form"
          noValidate
          onSubmit={(e) => { e.preventDefault(); submit(false); }}
        >
          {serverError && <Alert type={duplicatesBlocking ? 'error' : 'warning'}>{serverError}</Alert>}

          {duplicates.length > 0 && (
            <Alert type={duplicatesBlocking ? 'error' : 'warning'}>
              <strong>
                {duplicatesBlocking
                  ? 'This matches an existing vendor and cannot be saved:'
                  : 'These existing vendors look similar — please review:'}
              </strong>
              <ul>
                {duplicates.map((dup) => (
                  <li key={dup._id}>
                    <strong>{dup.name}</strong> ({dup.v_code}) — {dup.reason}
                    {dup.isArchived ? ' · archived' : ''}
                  </li>
                ))}
              </ul>
            </Alert>
          )}

          {/* ------------------------ Basic details ------------------------ */}
          <fieldset className="vm-fieldset">
            <legend>Basic details</legend>
            <div className="vm-form-grid">
              <Field label="Vendor name" htmlFor="vm-name" required error={errorFor('name')} wide>
                <TextInput
                  id="vm-name"
                  value={form.name}
                  error={errorFor('name')}
                  onChange={(e) => setField('name', e.target.value)}
                  onBlur={() => markTouched('name')}
                  placeholder="e.g. Acme Supplies Pvt Ltd"
                  autoComplete="organization"
                />
              </Field>

              <Field label="Legal business name" htmlFor="vm-legal" error={errorFor('legalName')}
                hint="If it differs from the trading name">
                <TextInput
                  id="vm-legal"
                  value={form.legalName}
                  error={errorFor('legalName')}
                  onChange={(e) => setField('legalName', e.target.value)}
                  onBlur={() => markTouched('legalName')}
                />
              </Field>

              <Field label="Vendor type" htmlFor="vm-type">
                <Select id="vm-type" value={form.type} onChange={(e) => setField('type', e.target.value)}>
                  <option value="">Select a type</option>
                  {meta.types.map((t) => <option key={t} value={t}>{t}</option>)}
                  {/* A vendor created before this module may hold a type the
                      current list no longer offers. Without this option the
                      select would fall back to blank and silently wipe it. */}
                  {form.type && !meta.types.includes(form.type) && (
                    <option value={form.type}>{form.type} (existing value)</option>
                  )}
                </Select>
              </Field>

              <Field
                label="Category"
                htmlFor="vm-category"
                hint={!metaLoading && meta.categories.length === 0
                  ? 'No categories yet — add them in Vendor Settings'
                  : undefined}
              >
                <Select id="vm-category" value={form.category} onChange={(e) => setField('category', e.target.value)}>
                  <option value="">Uncategorised</option>
                  {meta.categories.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
                </Select>
              </Field>

              {!isEdit && (
                <Field label="Status" htmlFor="vm-status" error={errorFor('status')}>
                  <Select id="vm-status" value={form.status} onChange={(e) => setField('status', e.target.value)}>
                    {meta.statuses.map((s) => <option key={s} value={s}>{s}</option>)}
                  </Select>
                </Field>
              )}

              <Field label="Priority" htmlFor="vm-priority" error={errorFor('priority')}>
                <Select id="vm-priority" value={form.priority} onChange={(e) => setField('priority', e.target.value)}>
                  {meta.priorities.map((p) => <option key={p} value={p}>{p}</option>)}
                </Select>
              </Field>

              <Field label="Assigned owner" htmlFor="vm-owner">
                <Select id="vm-owner" value={form.owner} onChange={(e) => setField('owner', e.target.value)}>
                  <option value="">Unassigned</option>
                  {meta.owners.map((o) => <option key={o._id} value={o._id}>{o.name || o.username}</option>)}
                </Select>
              </Field>

              <Field label="Industry" htmlFor="vm-industry">
                <TextInput id="vm-industry" value={form.industry} onChange={(e) => setField('industry', e.target.value)} placeholder="e.g. Metals & Alloys" />
              </Field>

              <Field label="Website" htmlFor="vm-website" error={errorFor('website')}>
                <TextInput
                  id="vm-website"
                  value={form.website}
                  error={errorFor('website')}
                  onChange={(e) => setField('website', e.target.value)}
                  onBlur={() => markTouched('website')}
                  placeholder="acme.com"
                  inputMode="url"
                />
              </Field>

              <Field label="Tags" htmlFor="vm-tags" hint="Separate with commas" wide>
                <TextInput id="vm-tags" value={form.tags} onChange={(e) => setField('tags', e.target.value)} placeholder="steel, bulk, preferred" />
              </Field>

              <Field label="Description" htmlFor="vm-description" wide>
                <TextArea id="vm-description" value={form.description} onChange={(e) => setField('description', e.target.value)} rows={3} placeholder="What this vendor supplies, and anything worth knowing about them." />
              </Field>
            </div>
          </fieldset>

          {/* -------------------------- Contact -------------------------- */}
          <fieldset className="vm-fieldset">
            <legend>Primary contact</legend>
            <div className="vm-form-grid">
              <Field label="Contact person" htmlFor="vm-contact-name">
                <TextInput id="vm-contact-name" value={form.contact_name} onChange={(e) => setField('contact_name', e.target.value)} autoComplete="name" />
              </Field>

              <Field label="Phone" htmlFor="vm-phone" error={errorFor('phone')}>
                <TextInput
                  id="vm-phone"
                  value={form.phone}
                  error={errorFor('phone')}
                  onChange={(e) => setField('phone', e.target.value)}
                  onBlur={() => markTouched('phone')}
                  placeholder="9876543210"
                  inputMode="tel"
                  autoComplete="tel"
                />
              </Field>

              <Field label="Email" htmlFor="vm-email" error={errorFor('email')}>
                <TextInput
                  id="vm-email"
                  type="email"
                  value={form.email}
                  error={errorFor('email')}
                  onChange={(e) => setField('email', e.target.value)}
                  onBlur={() => markTouched('email')}
                  placeholder="sales@acme.com"
                  autoComplete="email"
                />
              </Field>
            </div>
            <p className="vm-hint" style={{ marginTop: '0.75rem' }}>
              Add further contacts from the vendor profile once the vendor is saved.
            </p>
          </fieldset>

          {/* ------------------------ Registration ------------------------ */}
          <fieldset className="vm-fieldset">
            <legend>Tax &amp; registration</legend>
            <div className="vm-form-grid">
              <Field label="GSTIN" htmlFor="vm-gstin" error={errorFor('gstin')} hint="15 characters">
                <TextInput
                  id="vm-gstin"
                  value={form.gstin}
                  error={errorFor('gstin')}
                  onChange={(e) => setField('gstin', e.target.value.toUpperCase())}
                  onBlur={() => markTouched('gstin')}
                  placeholder="27AAPFU0939F1ZV"
                  maxLength={20}
                />
              </Field>

              <Field label="PAN" htmlFor="vm-pan" error={errorFor('pan')} hint="10 characters">
                <TextInput
                  id="vm-pan"
                  value={form.pan}
                  error={errorFor('pan')}
                  onChange={(e) => setField('pan', e.target.value.toUpperCase())}
                  onBlur={() => markTouched('pan')}
                  placeholder="AAPFU0939F"
                  maxLength={14}
                />
              </Field>

              <Field label="CIN" htmlFor="vm-cin" error={errorFor('cin')} hint="For registered companies">
                <TextInput
                  id="vm-cin"
                  value={form.cin}
                  error={errorFor('cin')}
                  onChange={(e) => setField('cin', e.target.value.toUpperCase())}
                  onBlur={() => markTouched('cin')}
                  maxLength={25}
                />
              </Field>

              <Field label="Other tax registration" htmlFor="vm-tax">
                <TextInput id="vm-tax" value={form.taxRegistration} onChange={(e) => setField('taxRegistration', e.target.value)} />
              </Field>
            </div>
          </fieldset>

          {/* -------------------------- Address -------------------------- */}
          <fieldset className="vm-fieldset">
            <legend>Registered address</legend>
            <div className="vm-form-grid">
              <Field label="Address line 1" htmlFor="vm-addr1" wide>
                <TextInput id="vm-addr1" value={form.addr1} onChange={(e) => setField('addr1', e.target.value)} autoComplete="address-line1" />
              </Field>
              <Field label="Address line 2" htmlFor="vm-addr2" wide>
                <TextInput id="vm-addr2" value={form.addr2} onChange={(e) => setField('addr2', e.target.value)} autoComplete="address-line2" />
              </Field>
              <Field label="City" htmlFor="vm-city">
                <TextInput id="vm-city" value={form.city} onChange={(e) => setField('city', e.target.value)} autoComplete="address-level2" />
              </Field>
              <Field label="State" htmlFor="vm-state">
                <TextInput id="vm-state" value={form.state} onChange={(e) => setField('state', e.target.value)} autoComplete="address-level1" />
              </Field>
              <Field label="PIN code" htmlFor="vm-pin" error={errorFor('pin_code')}>
                <TextInput
                  id="vm-pin"
                  value={form.pin_code}
                  error={errorFor('pin_code')}
                  onChange={(e) => setField('pin_code', e.target.value)}
                  onBlur={() => markTouched('pin_code')}
                  inputMode="numeric"
                  maxLength={10}
                  autoComplete="postal-code"
                />
              </Field>
            </div>
            <p className="vm-hint" style={{ marginTop: '0.75rem' }}>
              Additional billing, shipping and warehouse addresses can be added from the vendor profile.
            </p>
          </fieldset>

          {/* ------------------------ Bank details ------------------------ */}
          {canEditBank ? (
            <fieldset className="vm-fieldset">
              <legend>Bank &amp; payment</legend>
              <Alert type="info">
                Account details are stored securely, shown masked, excluded from exports
                and never written to activity logs.
              </Alert>
              <div className="vm-form-grid">
                <Field label="Bank name" htmlFor="vm-bank-name">
                  <TextInput id="vm-bank-name" value={bank.bankName} onChange={(e) => setBankField('bankName', e.target.value)} />
                </Field>
                <Field label="Account holder name" htmlFor="vm-bank-holder">
                  <TextInput id="vm-bank-holder" value={bank.accountHolderName} onChange={(e) => setBankField('accountHolderName', e.target.value)} />
                </Field>
                <Field
                  label="Account number"
                  htmlFor="vm-bank-account"
                  error={errorFor('bank.accountNumber')}
                  hint={isEdit ? 'Leave the masked value to keep the stored number' : undefined}
                >
                  <TextInput
                    id="vm-bank-account"
                    value={bank.accountNumber}
                    error={errorFor('bank.accountNumber')}
                    onChange={(e) => setBankField('accountNumber', e.target.value)}
                    onBlur={() => markTouched('bank.accountNumber')}
                    inputMode="numeric"
                    autoComplete="off"
                  />
                </Field>
                <Field label="IFSC" htmlFor="vm-bank-ifsc" error={errorFor('bank.ifsc')}>
                  <TextInput
                    id="vm-bank-ifsc"
                    value={bank.ifsc}
                    error={errorFor('bank.ifsc')}
                    onChange={(e) => setBankField('ifsc', e.target.value.toUpperCase())}
                    onBlur={() => markTouched('bank.ifsc')}
                    placeholder="HDFC0001234"
                    maxLength={11}
                  />
                </Field>
                <Field label="Branch" htmlFor="vm-bank-branch">
                  <TextInput id="vm-bank-branch" value={bank.branch} onChange={(e) => setBankField('branch', e.target.value)} />
                </Field>
                <Field label="UPI ID" htmlFor="vm-bank-upi" error={errorFor('bank.upi')}>
                  <TextInput
                    id="vm-bank-upi"
                    value={bank.upi}
                    error={errorFor('bank.upi')}
                    onChange={(e) => setBankField('upi', e.target.value)}
                    onBlur={() => markTouched('bank.upi')}
                    placeholder="acme@okhdfcbank"
                  />
                </Field>
                <Field label="Payment terms" htmlFor="vm-bank-terms">
                  <TextInput id="vm-bank-terms" value={bank.paymentTerms} onChange={(e) => setBankField('paymentTerms', e.target.value)} placeholder="e.g. 50% advance, 50% on delivery" />
                </Field>
                <Field label="Credit period (days)" htmlFor="vm-bank-credit" error={errorFor('bank.creditPeriodDays')}>
                  <TextInput
                    id="vm-bank-credit"
                    type="number"
                    min="0"
                    max="3650"
                    value={bank.creditPeriodDays}
                    error={errorFor('bank.creditPeriodDays')}
                    onChange={(e) => setBankField('creditPeriodDays', e.target.value)}
                    onBlur={() => markTouched('bank.creditPeriodDays')}
                  />
                </Field>
                <Field label="Currency" htmlFor="vm-bank-currency">
                  <Select id="vm-bank-currency" value={bank.currency} onChange={(e) => setBankField('currency', e.target.value)}>
                    {meta.currencies.map((c) => <option key={c} value={c}>{c}</option>)}
                  </Select>
                </Field>
                <Field label="Preferred payment method" htmlFor="vm-bank-method">
                  <Select id="vm-bank-method" value={bank.preferredPaymentMethod} onChange={(e) => setBankField('preferredPaymentMethod', e.target.value)}>
                    <option value="">Not specified</option>
                    {meta.paymentMethods.map((m) => <option key={m} value={m}>{m}</option>)}
                  </Select>
                </Field>
              </div>
            </fieldset>
          ) : (
            <Alert type="info">
              Bank and payment details are managed by an administrator.
            </Alert>
          )}
        </form>
      )}
    </Modal>
  );
};

export default VendorFormModal;
