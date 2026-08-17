// Vendor profile — the detail view.
//
// A compact identity header with quick actions, then tabbed sections so the
// screen is never overloaded. Each tab loads its own data on first view rather
// than the profile fetching everything up front.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import {
  FiEdit2, FiPhone, FiMail, FiMessageCircle, FiGlobe, FiArchive, FiRotateCcw,
  FiPlus, FiUpload, FiRefreshCw, FiChevronRight, FiArrowLeft, FiStar,
} from 'react-icons/fi';

import { vendorApi } from '../../../utils/vendorApi';
import { useVendorMeta } from './useVendorMeta';
import VendorFormModal from './VendorFormModal';
import { VendorContactsTab, VendorAddressesTab } from './VendorContactsTab';
import VendorProductsTab from './VendorProductsTab';
import VendorDocumentsTab from './VendorDocumentsTab';
import { VendorActivitiesTab, VendorPerformanceTab, VendorAuditTab } from './VendorActivityTabs';
import {
  StatusBadge, PriorityBadge, PerformanceBadge, Modal, ConfirmDialog, Alert,
  ErrorState, EmptyState, notifySuccess, reportError, formatDate, formatDateTime,
  initialsOf, telHref, whatsappHref,
} from './VendorUI';
import '../../../styles/crm/Vendor.css';

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'contacts', label: 'Contacts', countKey: 'contacts' },
  { key: 'addresses', label: 'Addresses' },
  { key: 'products', label: 'Products & Pricing', countKey: 'products' },
  { key: 'documents', label: 'Documents', countKey: 'documents' },
  { key: 'activities', label: 'Activities', countKey: 'activities' },
  { key: 'performance', label: 'Performance', countKey: 'evaluations' },
  { key: 'audit', label: 'Audit History' },
];

const StatusChangeModal = ({ vendor, statuses, onClose, onSubmit, saving }) => {
  const [status, setStatus] = useState(vendor.status);
  const [reason, setReason] = useState('');

  return (
    <Modal
      title="Change vendor status"
      subtitle={`${vendor.name} · currently ${vendor.status}`}
      size="sm"
      onClose={onClose}
      footer={(
        <>
          <button type="button" className="vm-btn vm-btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button
            type="button"
            className="vm-btn vm-btn-primary"
            onClick={() => onSubmit(status, reason)}
            disabled={saving || status === vendor.status}
          >
            {saving && <span className="vm-spinner" aria-hidden="true" />}
            {saving ? 'Saving…' : 'Update status'}
          </button>
        </>
      )}
    >
      <div className="vm-field">
        <label htmlFor="vm-status-select">New status</label>
        <select id="vm-status-select" className="vm-select" value={status} onChange={(e) => setStatus(e.target.value)}>
          {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="vm-field" style={{ marginTop: '1rem' }}>
        <label htmlFor="vm-status-reason">Reason (optional)</label>
        <textarea
          id="vm-status-reason"
          className="vm-textarea"
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Recorded in the audit history"
        />
      </div>

      {(status === 'Blacklisted' || status === 'Suspended') && (
        <Alert type="warning">
          Marking a vendor as {status.toLowerCase()} signals to the whole team that they should
          not be used for new purchases.
        </Alert>
      )}
    </Modal>
  );
};

const VendorProfile = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { meta, can, loading: metaLoading } = useVendorMeta();

  const [vendor, setVendor] = useState(null);
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('overview');

  const [editing, setEditing] = useState(false);
  const [changingStatus, setChangingStatus] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [confirmText, setConfirmText] = useState('');
  const [busy, setBusy] = useState(false);

  const currentUser = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('user')) || {}; } catch { return {}; }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await vendorApi.get(id);
      setVendor(data.vendor);
      setCounts(data.counts || {});
    } catch (err) {
      setError(err.message);
      if (err.status !== 404) reportError(err, 'Unable to load this vendor');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const runConfirm = async () => {
    if (!confirm) return;
    setBusy(true);
    try {
      await confirm.action();
      notifySuccess(confirm.successTitle, confirm.successMessage);
      setConfirm(null);
      setConfirmText('');
      if (confirm.navigateAway) navigate('/crm/vendors');
      else await load();
    } catch (err) {
      reportError(err, 'Action failed');
    } finally {
      setBusy(false);
    }
  };

  const changeStatus = async (status, reason) => {
    setBusy(true);
    try {
      await vendorApi.setStatus(id, status, reason);
      notifySuccess('Status updated', `${vendor.name} is now ${status}.`);
      setChangingStatus(false);
      await load();
    } catch (err) {
      reportError(err, 'Could not change the status');
    } finally {
      setBusy(false);
    }
  };

  /* ------------------------------ States ------------------------------ */

  if (loading) {
    return (
      <div className="vm-module">
        <section className="vm-card" aria-busy="true">
          <div className="vm-skeleton" style={{ height: 64, width: 320, marginBottom: 20 }} />
          <div className="vm-skeleton" style={{ height: 40, marginBottom: 12 }} />
          <div className="vm-skeleton" style={{ height: 200 }} />
        </section>
      </div>
    );
  }

  if (error || !vendor) {
    return (
      <div className="vm-module">
        <section className="vm-card">
          {error?.includes('not be found') || !vendor ? (
            <EmptyState
              title="Vendor not found"
              message="This vendor may have been deleted, or the link is out of date."
              action={(
                <Link className="vm-btn vm-btn-primary" to="/crm/vendors">
                  Back to all vendors
                </Link>
              )}
            />
          ) : (
            <ErrorState message={error} onRetry={load} />
          )}
        </section>
      </div>
    );
  }

  const primary = (vendor.contacts || []).find((c) => c.isPrimary) || (vendor.contacts || [])[0] || null;
  const canEdit = can('vendor.edit') && !vendor.isArchived;

  const detail = (label, value, isEmpty = false) => (
    <div className="vm-detail">
      <dt>{label}</dt>
      <dd className={isEmpty || !value ? 'vm-nodata' : ''}>{value || 'Not recorded'}</dd>
    </div>
  );

  return (
    <div className="vm-module">
      {/* ----------------------------- Header ----------------------------- */}
      <section className="vm-card">
        <nav aria-label="Breadcrumb" style={{ marginBottom: '1rem', fontSize: '0.85rem', color: '#6b7280' }}>
          <Link to="/crm/vendors" className="vm-link">Vendor Management</Link>
          <FiChevronRight aria-hidden="true" style={{ verticalAlign: '-2px', margin: '0 0.3rem' }} />
          <span>{vendor.name}</span>
        </nav>

        {vendor.isArchived && (
          <Alert type="warning">
            This vendor is archived. Restore it before making changes.
          </Alert>
        )}

        <div className="vm-profile-header">
          <div className="vm-profile-identity">
            <span className="vm-avatar" aria-hidden="true">
              {vendor.logo ? <img src={vendor.logo} alt="" /> : initialsOf(vendor.name)}
            </span>

            <div className="vm-profile-titles">
              <h1>{vendor.name}</h1>
              {vendor.legalName && <p className="vm-card-subtitle">{vendor.legalName}</p>}

              <div className="vm-profile-meta">
                <strong>{vendor.v_code}</strong>
                <StatusBadge status={vendor.status} />
                <PriorityBadge priority={vendor.priority} />
                {vendor.category?.name && <span className="vm-tag">{vendor.category.name}</span>}
                <PerformanceBadge band={vendor.performanceBand} score={vendor.performance?.overallScore} />
              </div>

              <div className="vm-profile-meta">
                {primary ? (
                  <span>
                    {primary.fullName}
                    {primary.designation ? ` · ${primary.designation}` : ''}
                  </span>
                ) : (
                  <span style={{ fontStyle: 'italic' }}>No primary contact recorded</span>
                )}
                <span>·</span>
                <span>
                  Owner: {vendor.owner?.name || vendor.owner?.username || 'Unassigned'}
                </span>
              </div>

              {/* Contact shortcuts, only where the detail actually exists. */}
              <div className="vm-contact-actions">
                {(primary?.phone || vendor.phone) && (
                  <a className="vm-contact-action" href={telHref(primary?.phone || vendor.phone)}>
                    <FiPhone aria-hidden="true" /> Call
                  </a>
                )}
                {(primary?.email || vendor.email) && (
                  <a className="vm-contact-action" href={`mailto:${primary?.email || vendor.email}`}>
                    <FiMail aria-hidden="true" /> Email
                  </a>
                )}
                {(primary?.whatsapp || primary?.phone || vendor.phone) && (
                  <a className="vm-contact-action" target="_blank" rel="noopener noreferrer"
                    href={whatsappHref(primary?.whatsapp || primary?.phone || vendor.phone)}>
                    <FiMessageCircle aria-hidden="true" /> WhatsApp
                  </a>
                )}
                {vendor.website && (
                  <a className="vm-contact-action" href={vendor.website} target="_blank" rel="noopener noreferrer">
                    <FiGlobe aria-hidden="true" /> Website
                  </a>
                )}
              </div>
            </div>
          </div>

          <div className="vm-quick-actions">
            <button type="button" className="vm-btn vm-btn-ghost vm-btn-sm" onClick={() => navigate('/crm/vendors')}>
              <FiArrowLeft aria-hidden="true" /> Back
            </button>
            <button type="button" className="vm-btn vm-btn-ghost vm-btn-sm" onClick={load}>
              <FiRefreshCw aria-hidden="true" /> Refresh
            </button>

            {canEdit && (
              <>
                <button type="button" className="vm-btn vm-btn-primary vm-btn-sm" onClick={() => setEditing(true)}>
                  <FiEdit2 aria-hidden="true" /> Edit
                </button>
                <button type="button" className="vm-btn vm-btn-ghost vm-btn-sm" onClick={() => setChangingStatus(true)}>
                  Change status
                </button>
                <button type="button" className="vm-btn vm-btn-ghost vm-btn-sm" onClick={() => setTab('contacts')}>
                  <FiPlus aria-hidden="true" /> Contact
                </button>
                <button type="button" className="vm-btn vm-btn-ghost vm-btn-sm" onClick={() => setTab('products')}>
                  <FiPlus aria-hidden="true" /> Product
                </button>
                <button type="button" className="vm-btn vm-btn-ghost vm-btn-sm" onClick={() => setTab('activities')}>
                  <FiPlus aria-hidden="true" /> Note
                </button>
              </>
            )}

            {can('vendor.documents') && !vendor.isArchived && (
              <button type="button" className="vm-btn vm-btn-ghost vm-btn-sm" onClick={() => setTab('documents')}>
                <FiUpload aria-hidden="true" /> Document
              </button>
            )}

            {can('vendor.performance') && !vendor.isArchived && (
              <button type="button" className="vm-btn vm-btn-ghost vm-btn-sm" onClick={() => setTab('performance')}>
                <FiStar aria-hidden="true" /> Evaluate
              </button>
            )}

            {can('vendor.archive') && (
              vendor.isArchived ? (
                <button
                  type="button"
                  className="vm-btn vm-btn-success vm-btn-sm"
                  onClick={() => setConfirm({
                    title: 'Restore this vendor?',
                    message: `"${vendor.name}" will return to the active vendor list.`,
                    confirmLabel: 'Restore vendor',
                    tone: 'success',
                    action: () => vendorApi.restore(id),
                    successTitle: 'Vendor restored',
                    successMessage: `"${vendor.name}" is active again.`,
                  })}
                >
                  <FiRotateCcw aria-hidden="true" /> Restore
                </button>
              ) : (
                <button
                  type="button"
                  className="vm-btn vm-btn-warning vm-btn-sm"
                  onClick={() => setConfirm({
                    title: 'Archive this vendor?',
                    message: `"${vendor.name}" (${vendor.v_code}) will be hidden from the active vendor list. Contacts, documents, pricing and history are all kept, and you can restore it at any time.`,
                    confirmLabel: 'Archive vendor',
                    tone: 'warning',
                    action: () => vendorApi.archive(id),
                    successTitle: 'Vendor archived',
                    successMessage: `"${vendor.name}" has been archived.`,
                  })}
                >
                  <FiArchive aria-hidden="true" /> Archive
                </button>
              )
            )}
          </div>
        </div>

        {/* ------------------------------ Tabs ------------------------------ */}
        <div className="vm-tabs" role="tablist" aria-label="Vendor sections">
          {TABS.map((item) => (
            <button
              key={item.key}
              type="button"
              role="tab"
              id={`vm-tab-${item.key}`}
              aria-selected={tab === item.key}
              aria-controls={`vm-panel-${item.key}`}
              className="vm-tab"
              onClick={() => setTab(item.key)}
            >
              {item.label}
              {item.countKey && counts[item.countKey] > 0 && (
                <span className="vm-tab-count">{counts[item.countKey]}</span>
              )}
            </button>
          ))}
        </div>

        <div
          className="vm-tab-panel"
          role="tabpanel"
          id={`vm-panel-${tab}`}
          aria-labelledby={`vm-tab-${tab}`}
          tabIndex={-1}
        >
          {tab === 'overview' && (
            <div>
              <dl className="vm-detail-grid">
                {detail('Vendor code', vendor.v_code)}
                {detail('Legal business name', vendor.legalName)}
                {detail('Vendor type', vendor.type)}
                {detail('Category', vendor.category?.name)}
                {detail('Industry', vendor.industry)}
                {detail('Priority', vendor.priority)}
                {detail('GSTIN', vendor.gstin)}
                {detail('PAN', vendor.pan)}
                {detail('CIN', vendor.cin)}
                {detail('Other tax registration', vendor.taxRegistration)}
                {detail('Website', vendor.website && (
                  <a href={vendor.website} target="_blank" rel="noopener noreferrer" className="vm-link">
                    {vendor.website}
                  </a>
                ))}
                {detail('Assigned owner', vendor.owner?.name || vendor.owner?.username)}
                {detail('Created', `${formatDate(vendor.createdAt)}${vendor.createdBy?.name ? ` by ${vendor.createdBy.name}` : ''}`)}
                {detail('Last updated', `${formatDateTime(vendor.updatedAt)}${vendor.updatedBy?.name ? ` by ${vendor.updatedBy.name}` : ''}`)}
              </dl>

              {vendor.description && (
                <div style={{ marginTop: '1.5rem' }}>
                  <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.95rem' }}>Description</h4>
                  <p style={{ margin: 0, color: '#374151', whiteSpace: 'pre-wrap' }}>{vendor.description}</p>
                </div>
              )}

              {vendor.tags?.length > 0 && (
                <div style={{ marginTop: '1.5rem' }}>
                  <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.95rem' }}>Tags</h4>
                  {vendor.tags.map((tag) => <span className="vm-tag" key={tag}>{tag}</span>)}
                </div>
              )}

              {/* Banking is shown masked, and only to roles that may see it. */}
              <div style={{ marginTop: '1.5rem' }}>
                <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.95rem' }}>Bank &amp; payment</h4>
                {vendor.bank?.restricted ? (
                  <Alert type="info">
                    Bank and payment details are visible to administrators only.
                  </Alert>
                ) : (
                  <dl className="vm-detail-grid">
                    {detail('Bank name', vendor.bank?.bankName)}
                    {detail('Account holder', vendor.bank?.accountHolderName)}
                    {detail('Account number', vendor.bank?.accountNumberMasked)}
                    {detail('IFSC', vendor.bank?.ifsc)}
                    {detail('Branch', vendor.bank?.branch)}
                    {detail('UPI ID', vendor.bank?.upi)}
                    {detail('Payment terms', vendor.bank?.paymentTerms)}
                    {detail('Credit period', vendor.bank?.creditPeriodDays ? `${vendor.bank.creditPeriodDays} days` : '')}
                    {detail('Currency', vendor.bank?.currency)}
                    {detail('Preferred method', vendor.bank?.preferredPaymentMethod)}
                  </dl>
                )}
              </div>
            </div>
          )}

          {tab === 'contacts' && (
            <VendorContactsTab vendorId={id} meta={meta} canEdit={canEdit} onChanged={load} />
          )}

          {tab === 'addresses' && (
            <VendorAddressesTab vendorId={id} meta={meta} canEdit={canEdit} onChanged={load} />
          )}

          {tab === 'products' && (
            <VendorProductsTab vendorId={id} meta={meta} canEdit={canEdit} onChanged={load} />
          )}

          {tab === 'documents' && (
            <VendorDocumentsTab
              vendorId={id}
              meta={meta}
              canManage={can('vendor.documents') && !vendor.isArchived}
              onChanged={load}
            />
          )}

          {tab === 'activities' && (
            <VendorActivitiesTab
              vendorId={id}
              meta={meta}
              canEdit={canEdit}
              currentUserId={currentUser._id}
              isAdmin={currentUser.role === 'admin'}
              onChanged={load}
            />
          )}

          {tab === 'performance' && (
            <VendorPerformanceTab
              vendorId={id}
              canEvaluate={can('vendor.performance') && !vendor.isArchived}
              onChanged={load}
            />
          )}

          {tab === 'audit' && <VendorAuditTab vendorId={id} />}
        </div>
      </section>

      {editing && (
        <VendorFormModal
          vendor={vendor}
          meta={meta}
          metaLoading={metaLoading}
          can={can}
          onClose={() => setEditing(false)}
          onSaved={() => { setEditing(false); load(); }}
        />
      )}

      {changingStatus && (
        <StatusChangeModal
          vendor={vendor}
          statuses={meta.statuses}
          saving={busy}
          onClose={() => setChangingStatus(false)}
          onSubmit={changeStatus}
        />
      )}

      {confirm && (
        <ConfirmDialog
          title={confirm.title}
          message={confirm.message}
          confirmLabel={confirm.confirmLabel}
          tone={confirm.tone}
          busy={busy}
          requireText={confirm.requireText}
          typedText={confirmText}
          onTypedTextChange={setConfirmText}
          onConfirm={runConfirm}
          onCancel={() => { setConfirm(null); setConfirmText(''); }}
        />
      )}
    </div>
  );
};

export default VendorProfile;
