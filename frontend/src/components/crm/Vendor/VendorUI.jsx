// Shared presentational building blocks for the Vendor Management module.
// Keeping these in one place means every vendor screen gets the same modal
// behaviour, the same empty/loading/error states and the same badge styling.

import React, { useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { FiAlertCircle, FiAlertTriangle, FiInbox, FiInfo, FiCheckCircle } from 'react-icons/fi';
import { toast } from 'react-toastify';
import CustomToast from '../CustomToast';
import { handleExpiredSession } from '../../../utils/vendorApi';

/* ------------------------------ Notifications ------------------------------
 * Thin wrappers over the CRM's existing react-toastify + CustomToast setup, so
 * vendor feedback looks identical to the rest of the app. */

export const notifySuccess = (title, message) =>
  toast(<CustomToast type="success" title={title} message={message} />);

export const notifyError = (title, message) =>
  toast(<CustomToast type="error" title={title} message={message} />);

export const notifyWarning = (title, message) =>
  toast(<CustomToast type="warning" title={title} message={message} />);

// Single place every screen funnels a failed request through: an expired
// session bounces to login, everything else surfaces a readable toast.
export const reportError = (error, fallbackTitle = 'Something went wrong') => {
  if (handleExpiredSession(error)) return;
  notifyError(fallbackTitle, error?.message || 'Please try again.');
};

/* --------------------------------- Badges --------------------------------- */

const slug = (value) => String(value || '').toLowerCase().replace(/[^a-z]+/g, '-');

export const StatusBadge = ({ status }) => (
  <span className={`vm-badge vm-status-${slug(status) || 'inactive'}`}>{status || '—'}</span>
);

export const PriorityBadge = ({ priority }) => (
  <span className={`vm-badge vm-priority-${slug(priority) || 'medium'}`}>{priority || '—'}</span>
);

// "No data" is a first-class state: a vendor that has never been evaluated is
// shown as such rather than being given a zero score.
export const PerformanceBadge = ({ band, score }) => (
  <span className={`vm-badge vm-band-${slug(band) || 'nodata'}`}>
    {band === 'No data' || score == null ? 'No data' : `${band} · ${Number(score).toFixed(1)}`}
  </span>
);

export const ExpiryBadge = ({ state, days }) => {
  const labels = {
    expired: days === undefined ? 'Expired' : `Expired ${Math.abs(days)}d ago`,
    expiring: `Expires in ${days}d`,
    valid: 'Valid',
    none: 'No expiry',
  };
  return <span className={`vm-badge vm-expiry-${state || 'none'}`}>{labels[state] || 'No expiry'}</span>;
};

/* --------------------------------- Alerts --------------------------------- */

const ALERT_ICONS = {
  error: FiAlertCircle,
  warning: FiAlertTriangle,
  info: FiInfo,
  success: FiCheckCircle,
};

export const Alert = ({ type = 'info', children }) => {
  const Icon = ALERT_ICONS[type] || FiInfo;
  return (
    <div className={`vm-alert vm-alert-${type}`} role={type === 'error' ? 'alert' : 'status'}>
      <Icon aria-hidden="true" />
      <div>{children}</div>
    </div>
  );
};

/* ---------------------------------- Modal ----------------------------------
 * One modal implementation for the whole module: rendered in a portal (so it is
 * never clipped by a scrolling ancestor), closes on Escape and on overlay
 * click, restores focus to the trigger, and traps Tab inside itself. */

export const Modal = ({ title, subtitle, size = '', onClose, footer, children, labelledBy }) => {
  const dialogRef = useRef(null);
  const previouslyFocused = useRef(null);
  const titleId = labelledBy || `vm-modal-title-${String(title || '').replace(/\W+/g, '-').toLowerCase()}`;

  useEffect(() => {
    previouslyFocused.current = document.activeElement;

    // Stop the page behind the modal from scrolling with it.
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';

    // Move focus into the dialog so keyboard users start inside it.
    const firstField = dialogRef.current?.querySelector(
      'input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled])'
    );
    firstField?.focus();

    return () => {
      document.body.style.overflow = overflow;
      previouslyFocused.current?.focus?.();
    };
  }, []);

  const onKeyDown = useCallback((event) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== 'Tab') return;

    const focusable = dialogRef.current?.querySelectorAll(
      'a[href], button:not([disabled]), input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    if (!focusable?.length) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }, [onClose]);

  return createPortal(
    <div
      className="vm-modal-overlay"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className={`vm-modal ${size ? `vm-modal-${size}` : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        ref={dialogRef}
        onKeyDown={onKeyDown}
      >
        <div className="vm-modal-header">
          <div>
            <h3 id={titleId}>{title}</h3>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button type="button" className="vm-modal-close" onClick={onClose} aria-label="Close dialog">
            ×
          </button>
        </div>
        <div className="vm-modal-body">{children}</div>
        {footer && <div className="vm-modal-footer">{footer}</div>}
      </div>
    </div>,
    document.body
  );
};

/* ------------------------------ Confirm dialog ------------------------------
 * Used for anything destructive. `requireText` forces the user to type an exact
 * value (the vendor code) before the action can be confirmed. */

export const ConfirmDialog = ({
  title,
  message,
  confirmLabel = 'Confirm',
  tone = 'danger',
  busy = false,
  requireText = '',
  typedText = '',
  onTypedTextChange,
  onConfirm,
  onCancel,
  children,
}) => {
  const confirmDisabled = busy
    || (requireText && typedText.trim().toUpperCase() !== requireText.toUpperCase());

  return (
    <Modal
      title={title}
      size="sm"
      onClose={onCancel}
      footer={(
        <>
          <button type="button" className="vm-btn vm-btn-ghost" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className={`vm-btn vm-btn-${tone}`}
            onClick={onConfirm}
            disabled={confirmDisabled}
          >
            {busy && <span className="vm-spinner" aria-hidden="true" />}
            {busy ? 'Working…' : confirmLabel}
          </button>
        </>
      )}
    >
      <p style={{ margin: 0, color: '#374151', fontSize: '0.93rem' }}>{message}</p>
      {children}
      {requireText && (
        <div className="vm-field" style={{ marginTop: '1rem' }}>
          <label htmlFor="vm-confirm-text">
            Type <strong>{requireText}</strong> to confirm
          </label>
          <input
            id="vm-confirm-text"
            className="vm-input"
            value={typedText}
            onChange={(e) => onTypedTextChange(e.target.value)}
            placeholder={requireText}
            autoComplete="off"
          />
        </div>
      )}
    </Modal>
  );
};

/* ------------------------------ Form controls ------------------------------ */

export const Field = ({ label, htmlFor, error, hint, required, wide, children }) => (
  <div className={`vm-field ${wide ? 'vm-field-wide' : ''}`}>
    <label htmlFor={htmlFor}>
      {label}
      {required && <span className="vm-required" aria-hidden="true">*</span>}
    </label>
    {children}
    {error && (
      <span className="vm-error-text" id={`${htmlFor}-error`} role="alert">
        <FiAlertCircle aria-hidden="true" /> {error}
      </span>
    )}
    {!error && hint && <span className="vm-hint">{hint}</span>}
  </div>
);

// A text input wired to its label, error text and aria-invalid state.
export const TextInput = ({ id, error, ...props }) => (
  <input
    id={id}
    className="vm-input"
    aria-invalid={error ? 'true' : undefined}
    aria-describedby={error ? `${id}-error` : undefined}
    {...props}
  />
);

export const Select = ({ id, error, children, ...props }) => (
  <select
    id={id}
    className="vm-select"
    aria-invalid={error ? 'true' : undefined}
    aria-describedby={error ? `${id}-error` : undefined}
    {...props}
  >
    {children}
  </select>
);

export const TextArea = ({ id, error, ...props }) => (
  <textarea
    id={id}
    className="vm-textarea"
    aria-invalid={error ? 'true' : undefined}
    aria-describedby={error ? `${id}-error` : undefined}
    {...props}
  />
);

/* -------------------------------- States -------------------------------- */

export const EmptyState = ({ title, message, action }) => (
  <div className="vm-empty">
    <FiInbox className="vm-empty-icon" aria-hidden="true" />
    <h4>{title}</h4>
    {message && <p>{message}</p>}
    {action}
  </div>
);

export const ErrorState = ({ message, onRetry }) => (
  <div className="vm-error-state" role="alert">
    <FiAlertCircle className="vm-empty-icon" aria-hidden="true" />
    <h4>Unable to load this information</h4>
    <p>{message || 'Please try again.'}</p>
    {onRetry && (
      <button type="button" className="vm-btn vm-btn-ghost" onClick={onRetry}>
        Try again
      </button>
    )}
  </div>
);

export const TableSkeleton = ({ rows = 5, columns = 6 }) => (
  <div className="vm-table-wrapper" aria-busy="true" aria-live="polite">
    <span className="vm-sr-only">Loading…</span>
    {Array.from({ length: rows }).map((_, rowIndex) => (
      <div className="vm-skeleton-row" key={rowIndex}>
        {Array.from({ length: columns }).map((__, colIndex) => (
          <span className="vm-skeleton" key={colIndex} />
        ))}
      </div>
    ))}
  </div>
);

export const CardSkeleton = ({ count = 4 }) => (
  <div className="vm-summary-grid" aria-busy="true">
    {Array.from({ length: count }).map((_, i) => (
      <div className="vm-skeleton vm-skeleton-card" key={i} />
    ))}
  </div>
);

export const ListSkeleton = ({ rows = 3 }) => (
  <div className="vm-panel-list" aria-busy="true">
    {Array.from({ length: rows }).map((_, i) => (
      <div className="vm-skeleton" style={{ height: 76, borderRadius: 14 }} key={i} />
    ))}
  </div>
);

/* ------------------------------- Pagination ------------------------------- */

export const Pagination = ({ page, pages, total, limit, onPageChange, onLimitChange }) => {
  if (!total) return null;

  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  // A short sliding window of page numbers — never render hundreds of buttons.
  const windowSize = 5;
  let start = Math.max(1, page - Math.floor(windowSize / 2));
  const end = Math.min(pages, start + windowSize - 1);
  start = Math.max(1, end - windowSize + 1);
  const numbers = Array.from({ length: end - start + 1 }, (_, i) => start + i);

  return (
    <div className="vm-pagination">
      <span>
        Showing <strong>{from}</strong>–<strong>{to}</strong> of <strong>{total}</strong>
      </span>

      <div className="vm-pagination-controls">
        <label className="vm-sr-only" htmlFor="vm-page-size">Rows per page</label>
        <select
          id="vm-page-size"
          className="vm-select"
          style={{ width: 'auto' }}
          value={limit}
          onChange={(e) => onLimitChange(Number(e.target.value))}
        >
          {[10, 25, 50, 100].map((n) => (
            <option key={n} value={n}>{n} / page</option>
          ))}
        </select>

        <button
          type="button"
          className="vm-page-btn"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
        >
          Prev
        </button>

        {start > 1 && <span aria-hidden="true">…</span>}
        {numbers.map((n) => (
          <button
            key={n}
            type="button"
            className="vm-page-btn"
            aria-current={n === page ? 'page' : undefined}
            aria-label={`Page ${n}`}
            onClick={() => onPageChange(n)}
          >
            {n}
          </button>
        ))}
        {end < pages && <span aria-hidden="true">…</span>}

        <button
          type="button"
          className="vm-page-btn"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= pages}
          aria-label="Next page"
        >
          Next
        </button>
      </div>
    </div>
  );
};

/* -------------------------------- Helpers -------------------------------- */

export const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

export const formatDateTime = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
};

// Relative time for the activity timeline ("3 days ago").
export const formatRelative = (value) => {
  if (!value) return '';
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return '';
  const seconds = Math.round((Date.now() - then) / 1000);
  if (seconds < 60) return 'just now';
  const units = [
    ['minute', 60], ['hour', 3600], ['day', 86400], ['week', 604800],
    ['month', 2592000], ['year', 31536000],
  ];
  let label = 'year';
  let divisor = 31536000;
  for (let i = 0; i < units.length; i += 1) {
    const [unit, unitSeconds] = units[i];
    const next = units[i + 1];
    if (!next || seconds < next[1]) { label = unit; divisor = unitSeconds; break; }
  }
  const count = Math.floor(seconds / divisor);
  return `${count} ${label}${count === 1 ? '' : 's'} ago`;
};

export const formatMoney = (value, currency = 'INR') => {
  if (value === null || value === undefined || value === '') return '—';
  const number = Number(value);
  if (!Number.isFinite(number)) return '—';
  try {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 2 })
      .format(number);
  } catch {
    return `${currency} ${number.toLocaleString('en-IN')}`;
  }
};

export const formatBytes = (bytes) => {
  if (!bytes) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) { value /= 1024; unit += 1; }
  return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
};

export const initialsOf = (name) => String(name || '?')
  .trim()
  .split(/\s+/)
  .slice(0, 2)
  .map((part) => part[0]?.toUpperCase() || '')
  .join('') || '?';

// Digits only, so tel:/wa.me links work regardless of how the number was typed.
export const telHref = (phone) => `tel:${String(phone || '').replace(/[^\d+]/g, '')}`;
export const whatsappHref = (phone) => {
  const digits = String(phone || '').replace(/\D/g, '');
  const withCountry = digits.length === 10 ? `91${digits}` : digits;
  return `https://wa.me/${withCountry}`;
};

/* ------------------------------ Star rating ------------------------------ */

export const StarRating = ({ value, onChange, name, readOnly = false, describedBy }) => (
  <span className="vm-rating" role={readOnly ? 'img' : 'group'} aria-label={readOnly ? `${value || 0} out of 5` : undefined}>
    {[1, 2, 3, 4, 5].map((star) => (
      <button
        key={star}
        type="button"
        className={Number(value) >= star ? 'vm-filled' : ''}
        aria-pressed={Number(value) >= star}
        aria-label={`${star} star${star === 1 ? '' : 's'}`}
        aria-describedby={describedBy}
        disabled={readOnly}
        onClick={() => !readOnly && onChange?.(star, name)}
      >
        ★
      </button>
    ))}
    {value ? <span className="vm-rating-value">{Number(value).toFixed(1)}</span> : null}
  </span>
);
