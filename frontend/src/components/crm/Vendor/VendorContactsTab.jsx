// Contacts and addresses tabs on the vendor profile.
//
// Both keep a single canonical record (one primary contact, one default
// address); the server enforces that invariant and the UI reflects it.

import React, { useCallback, useEffect, useState } from 'react';
import {
  FiPlus, FiEdit2, FiTrash2, FiStar, FiPhone, FiMail, FiMessageCircle, FiMapPin,
} from 'react-icons/fi';

import { vendorApi } from '../../../utils/vendorApi';
import { validateContactForm, validateAddressForm, hasErrors } from '../../../utils/vendorValidation';
import {
  Modal, ConfirmDialog, Field, TextInput, Select, TextArea, EmptyState,
  ErrorState, ListSkeleton, notifySuccess, reportError, telHref, whatsappHref,
} from './VendorUI';

/* =============================== CONTACTS =============================== */

const blankContact = {
  fullName: '', designation: '', department: '', email: '', phone: '',
  whatsapp: '', altPhone: '', contactType: 'General', notes: '', isPrimary: false, isActive: true,
};

const ContactForm = ({ contact, meta, onClose, onSubmit, saving }) => {
  const [form, setForm] = useState({ ...blankContact, ...(contact || {}) });
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});

  const set = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));
  const errorFor = (field) => (touched[field] ? errors[field] : '');

  useEffect(() => { setErrors(validateContactForm(form)); }, [form]);

  const handleSubmit = (event) => {
    event.preventDefault();
    const found = validateContactForm(form);
    setErrors(found);
    setTouched(Object.fromEntries(Object.keys(found).map((k) => [k, true])));
    if (hasErrors(found)) return;
    onSubmit(form);
  };

  return (
    <Modal
      title={contact ? `Edit ${contact.fullName}` : 'Add a contact'}
      onClose={onClose}
      footer={(
        <>
          <button type="button" className="vm-btn vm-btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="submit" form="vm-contact-form" className="vm-btn vm-btn-success" disabled={saving}>
            {saving && <span className="vm-spinner" aria-hidden="true" />}
            {saving ? 'Saving…' : 'Save contact'}
          </button>
        </>
      )}
    >
      <form id="vm-contact-form" noValidate onSubmit={handleSubmit}>
        <div className="vm-form-grid">
          <Field label="Full name" htmlFor="vm-c-name" required error={errorFor('fullName')} wide>
            <TextInput id="vm-c-name" value={form.fullName} error={errorFor('fullName')}
              onChange={(e) => set('fullName', e.target.value)}
              onBlur={() => setTouched((p) => ({ ...p, fullName: true }))} autoComplete="name" />
          </Field>

          <Field label="Designation" htmlFor="vm-c-designation">
            <TextInput id="vm-c-designation" value={form.designation} onChange={(e) => set('designation', e.target.value)} placeholder="e.g. Sales Manager" />
          </Field>

          <Field label="Department" htmlFor="vm-c-department">
            <TextInput id="vm-c-department" value={form.department} onChange={(e) => set('department', e.target.value)} />
          </Field>

          <Field label="Email" htmlFor="vm-c-email" error={errorFor('email')}>
            <TextInput id="vm-c-email" type="email" value={form.email} error={errorFor('email')}
              onChange={(e) => set('email', e.target.value)}
              onBlur={() => setTouched((p) => ({ ...p, email: true }))} autoComplete="email" />
          </Field>

          <Field label="Phone" htmlFor="vm-c-phone" error={errorFor('phone')}>
            <TextInput id="vm-c-phone" value={form.phone} error={errorFor('phone')}
              onChange={(e) => set('phone', e.target.value)}
              onBlur={() => setTouched((p) => ({ ...p, phone: true }))} inputMode="tel" autoComplete="tel" />
          </Field>

          <Field label="WhatsApp" htmlFor="vm-c-whatsapp" error={errorFor('whatsapp')}>
            <TextInput id="vm-c-whatsapp" value={form.whatsapp} error={errorFor('whatsapp')}
              onChange={(e) => set('whatsapp', e.target.value)}
              onBlur={() => setTouched((p) => ({ ...p, whatsapp: true }))} inputMode="tel" />
          </Field>

          <Field label="Alternate phone" htmlFor="vm-c-alt" error={errorFor('altPhone')}>
            <TextInput id="vm-c-alt" value={form.altPhone} error={errorFor('altPhone')}
              onChange={(e) => set('altPhone', e.target.value)}
              onBlur={() => setTouched((p) => ({ ...p, altPhone: true }))} inputMode="tel" />
          </Field>

          <Field label="Contact type" htmlFor="vm-c-type">
            <Select id="vm-c-type" value={form.contactType} onChange={(e) => set('contactType', e.target.value)}>
              {meta.contactTypes.map((t) => <option key={t} value={t}>{t}</option>)}
            </Select>
          </Field>

          <Field label="Notes" htmlFor="vm-c-notes" wide>
            <TextArea id="vm-c-notes" value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={2} />
          </Field>
        </div>

        <div style={{ display: 'flex', gap: '1.5rem', marginTop: '1rem', flexWrap: 'wrap' }}>
          <label className="vm-checkbox">
            <input type="checkbox" checked={form.isPrimary} onChange={(e) => set('isPrimary', e.target.checked)} />
            Primary contact
          </label>
          <label className="vm-checkbox">
            <input type="checkbox" checked={form.isActive} onChange={(e) => set('isActive', e.target.checked)} />
            Active
          </label>
        </div>

        {form.isPrimary && (
          <p className="vm-hint" style={{ marginTop: '0.75rem' }}>
            Making this the primary contact will unset the current one — a vendor has exactly one.
          </p>
        )}
      </form>
    </Modal>
  );
};

export const VendorContactsTab = ({ vendorId, meta, canEdit, onChanged }) => {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null); // {} for new, contact for edit
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await vendorApi.contacts(vendorId);
      setContacts(data.contacts || []);
    } catch (err) {
      setError(err.message);
      reportError(err, 'Unable to load contacts');
    } finally {
      setLoading(false);
    }
  }, [vendorId]);

  useEffect(() => { load(); }, [load]);

  const save = async (form) => {
    setSaving(true);
    try {
      if (editing?._id) await vendorApi.updateContact(vendorId, editing._id, form);
      else await vendorApi.addContact(vendorId, form);
      notifySuccess('Contact saved', `${form.fullName} has been saved.`);
      setEditing(null);
      await load();
      onChanged?.();
    } catch (err) {
      reportError(err, 'Could not save the contact');
    } finally {
      setSaving(false);
    }
  };

  const makePrimary = async (contact) => {
    try {
      await vendorApi.setPrimaryContact(vendorId, contact._id);
      notifySuccess('Primary contact updated', `${contact.fullName} is now the primary contact.`);
      await load();
      onChanged?.();
    } catch (err) {
      reportError(err, 'Could not update the primary contact');
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await vendorApi.deleteContact(vendorId, toDelete._id);
      notifySuccess('Contact deleted', `${toDelete.fullName} has been removed.`);
      setToDelete(null);
      await load();
      onChanged?.();
    } catch (err) {
      reportError(err, 'Could not delete the contact');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <ListSkeleton rows={3} />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div>
      <div className="vm-card-header">
        <div>
          <h3>Contacts</h3>
          <p className="vm-card-subtitle">{contacts.length} contact{contacts.length === 1 ? '' : 's'}</p>
        </div>
        {canEdit && (
          <button type="button" className="vm-btn vm-btn-success vm-btn-sm" onClick={() => setEditing({})}>
            <FiPlus aria-hidden="true" /> Add contact
          </button>
        )}
      </div>

      {contacts.length === 0 ? (
        <EmptyState
          title="No contacts yet"
          message="Add the people you deal with at this vendor so the team knows who to call."
          action={canEdit && (
            <button type="button" className="vm-btn vm-btn-success" onClick={() => setEditing({})}>
              <FiPlus aria-hidden="true" /> Add contact
            </button>
          )}
        />
      ) : (
        <div className="vm-panel-list">
          {contacts.map((contact) => (
            <div className="vm-panel-item" key={contact._id}>
              <div className="vm-panel-item-body">
                <div className="vm-panel-item-title">
                  {contact.fullName}
                  {contact.isPrimary && <span className="vm-badge vm-status-active">Primary</span>}
                  {!contact.isActive && <span className="vm-badge vm-status-inactive">Inactive</span>}
                  <span className="vm-tag">{contact.contactType}</span>
                </div>
                <div className="vm-panel-item-meta">
                  {[contact.designation, contact.department].filter(Boolean).join(' · ') || 'No designation recorded'}
                  {contact.email ? ` · ${contact.email}` : ''}
                  {contact.phone ? ` · ${contact.phone}` : ''}
                </div>
                {contact.notes && <div className="vm-panel-item-meta">{contact.notes}</div>}

                {/* Direct actions — only rendered when the underlying detail exists. */}
                <div className="vm-contact-actions">
                  {contact.phone && (
                    <a className="vm-contact-action" href={telHref(contact.phone)}>
                      <FiPhone aria-hidden="true" /> Call
                    </a>
                  )}
                  {contact.email && (
                    <a className="vm-contact-action" href={`mailto:${contact.email}`}>
                      <FiMail aria-hidden="true" /> Email
                    </a>
                  )}
                  {(contact.whatsapp || contact.phone) && (
                    <a
                      className="vm-contact-action"
                      href={whatsappHref(contact.whatsapp || contact.phone)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <FiMessageCircle aria-hidden="true" /> WhatsApp
                    </a>
                  )}
                </div>
              </div>

              {canEdit && (
                <div className="vm-panel-item-actions">
                  {!contact.isPrimary && (
                    <button type="button" className="vm-icon-btn" title="Set as primary contact"
                      aria-label={`Set ${contact.fullName} as primary contact`} onClick={() => makePrimary(contact)}>
                      <FiStar />
                    </button>
                  )}
                  <button type="button" className="vm-icon-btn" title="Edit contact"
                    aria-label={`Edit ${contact.fullName}`} onClick={() => setEditing(contact)}>
                    <FiEdit2 />
                  </button>
                  <button type="button" className="vm-icon-btn vm-danger" title="Delete contact"
                    aria-label={`Delete ${contact.fullName}`} onClick={() => setToDelete(contact)}>
                    <FiTrash2 />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {editing && (
        <ContactForm
          contact={editing._id ? editing : null}
          meta={meta}
          saving={saving}
          onClose={() => setEditing(null)}
          onSubmit={save}
        />
      )}

      {toDelete && (
        <ConfirmDialog
          title="Delete this contact?"
          message={`"${toDelete.fullName}" will be removed from this vendor. ${toDelete.isPrimary ? 'Another contact will automatically become the primary contact.' : ''}`}
          confirmLabel="Delete contact"
          busy={busy}
          onConfirm={remove}
          onCancel={() => setToDelete(null)}
        />
      )}
    </div>
  );
};

/* =============================== ADDRESSES =============================== */

const blankAddress = {
  addressType: 'Registered Office', line1: '', line2: '', landmark: '',
  city: '', state: '', country: 'India', pincode: '', isDefault: false,
};

const AddressForm = ({ address, meta, onClose, onSubmit, saving }) => {
  const [form, setForm] = useState({ ...blankAddress, ...(address || {}) });
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});

  const set = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));
  const errorFor = (field) => (touched[field] ? errors[field] : '');

  useEffect(() => { setErrors(validateAddressForm(form)); }, [form]);

  const handleSubmit = (event) => {
    event.preventDefault();
    const found = validateAddressForm(form);
    setErrors(found);
    setTouched(Object.fromEntries(Object.keys(found).map((k) => [k, true])));
    if (hasErrors(found)) return;
    onSubmit(form);
  };

  return (
    <Modal
      title={address ? 'Edit address' : 'Add an address'}
      onClose={onClose}
      footer={(
        <>
          <button type="button" className="vm-btn vm-btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="submit" form="vm-address-form" className="vm-btn vm-btn-success" disabled={saving}>
            {saving && <span className="vm-spinner" aria-hidden="true" />}
            {saving ? 'Saving…' : 'Save address'}
          </button>
        </>
      )}
    >
      <form id="vm-address-form" noValidate onSubmit={handleSubmit}>
        <div className="vm-form-grid">
          <Field label="Address type" htmlFor="vm-a-type">
            <Select id="vm-a-type" value={form.addressType} onChange={(e) => set('addressType', e.target.value)}>
              {meta.addressTypes.map((t) => <option key={t} value={t}>{t}</option>)}
            </Select>
          </Field>

          <Field label="Address line 1" htmlFor="vm-a-line1" required error={errorFor('line1')} wide>
            <TextInput id="vm-a-line1" value={form.line1} error={errorFor('line1')}
              onChange={(e) => set('line1', e.target.value)}
              onBlur={() => setTouched((p) => ({ ...p, line1: true }))} autoComplete="address-line1" />
          </Field>

          <Field label="Address line 2" htmlFor="vm-a-line2" wide>
            <TextInput id="vm-a-line2" value={form.line2} onChange={(e) => set('line2', e.target.value)} autoComplete="address-line2" />
          </Field>

          <Field label="Landmark" htmlFor="vm-a-landmark">
            <TextInput id="vm-a-landmark" value={form.landmark} onChange={(e) => set('landmark', e.target.value)} />
          </Field>

          <Field label="City" htmlFor="vm-a-city">
            <TextInput id="vm-a-city" value={form.city} onChange={(e) => set('city', e.target.value)} autoComplete="address-level2" />
          </Field>

          <Field label="State" htmlFor="vm-a-state">
            <TextInput id="vm-a-state" value={form.state} onChange={(e) => set('state', e.target.value)} autoComplete="address-level1" />
          </Field>

          <Field label="Country" htmlFor="vm-a-country">
            <TextInput id="vm-a-country" value={form.country} onChange={(e) => set('country', e.target.value)} autoComplete="country-name" />
          </Field>

          <Field label="PIN / postal code" htmlFor="vm-a-pincode" error={errorFor('pincode')}>
            <TextInput id="vm-a-pincode" value={form.pincode} error={errorFor('pincode')}
              onChange={(e) => set('pincode', e.target.value)}
              onBlur={() => setTouched((p) => ({ ...p, pincode: true }))} autoComplete="postal-code" />
          </Field>
        </div>

        <label className="vm-checkbox" style={{ marginTop: '1rem' }}>
          <input type="checkbox" checked={form.isDefault} onChange={(e) => set('isDefault', e.target.checked)} />
          Use as the default address
        </label>
      </form>
    </Modal>
  );
};

export const VendorAddressesTab = ({ vendorId, meta, canEdit, onChanged }) => {
  const [addresses, setAddresses] = useState([]);
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
      const data = await vendorApi.addresses(vendorId);
      setAddresses(data.addresses || []);
    } catch (err) {
      setError(err.message);
      reportError(err, 'Unable to load addresses');
    } finally {
      setLoading(false);
    }
  }, [vendorId]);

  useEffect(() => { load(); }, [load]);

  const save = async (form) => {
    setSaving(true);
    try {
      if (editing?._id) await vendorApi.updateAddress(vendorId, editing._id, form);
      else await vendorApi.addAddress(vendorId, form);
      notifySuccess('Address saved', 'The address has been saved.');
      setEditing(null);
      await load();
      onChanged?.();
    } catch (err) {
      reportError(err, 'Could not save the address');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await vendorApi.deleteAddress(vendorId, toDelete._id);
      notifySuccess('Address deleted', 'The address has been removed.');
      setToDelete(null);
      await load();
      onChanged?.();
    } catch (err) {
      reportError(err, 'Could not delete the address');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <ListSkeleton rows={2} />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div>
      <div className="vm-card-header">
        <div>
          <h3>Addresses</h3>
          <p className="vm-card-subtitle">{addresses.length} address{addresses.length === 1 ? '' : 'es'}</p>
        </div>
        {canEdit && (
          <button type="button" className="vm-btn vm-btn-success vm-btn-sm" onClick={() => setEditing({})}>
            <FiPlus aria-hidden="true" /> Add address
          </button>
        )}
      </div>

      {addresses.length === 0 ? (
        <EmptyState
          title="No addresses yet"
          message="Add registered, billing, shipping or warehouse addresses for this vendor."
          action={canEdit && (
            <button type="button" className="vm-btn vm-btn-success" onClick={() => setEditing({})}>
              <FiPlus aria-hidden="true" /> Add address
            </button>
          )}
        />
      ) : (
        <div className="vm-panel-list">
          {addresses.map((address) => (
            <div className="vm-panel-item" key={address._id}>
              <div className="vm-panel-item-body">
                <div className="vm-panel-item-title">
                  <FiMapPin aria-hidden="true" />
                  {address.addressType}
                  {address.isDefault && <span className="vm-badge vm-status-active">Default</span>}
                </div>
                <div className="vm-panel-item-meta">
                  {[address.line1, address.line2, address.landmark].filter(Boolean).join(', ')}
                </div>
                <div className="vm-panel-item-meta">
                  {[address.city, address.state, address.pincode, address.country].filter(Boolean).join(', ')}
                </div>
              </div>

              {canEdit && (
                <div className="vm-panel-item-actions">
                  <button type="button" className="vm-icon-btn" title="Edit address"
                    aria-label={`Edit ${address.addressType} address`} onClick={() => setEditing(address)}>
                    <FiEdit2 />
                  </button>
                  <button type="button" className="vm-icon-btn vm-danger" title="Delete address"
                    aria-label={`Delete ${address.addressType} address`} onClick={() => setToDelete(address)}>
                    <FiTrash2 />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {editing && (
        <AddressForm
          address={editing._id ? editing : null}
          meta={meta}
          saving={saving}
          onClose={() => setEditing(null)}
          onSubmit={save}
        />
      )}

      {toDelete && (
        <ConfirmDialog
          title="Delete this address?"
          message={`The ${toDelete.addressType.toLowerCase()} address will be removed from this vendor.`}
          confirmLabel="Delete address"
          busy={busy}
          onConfirm={remove}
          onCancel={() => setToDelete(null)}
        />
      )}
    </div>
  );
};

export default VendorContactsTab;
