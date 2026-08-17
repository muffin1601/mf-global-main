// Activities timeline, performance evaluations and audit history tabs.

import React, { useCallback, useEffect, useState } from 'react';
import {
  FiPlus, FiEdit2, FiTrash2, FiCheckCircle, FiMessageSquare, FiPhone, FiMail,
  FiCalendar, FiClock, FiCheckSquare, FiBell,
} from 'react-icons/fi';

import { vendorApi } from '../../../utils/vendorApi';
import { validateActivityForm, validateEvaluationForm, hasErrors } from '../../../utils/vendorValidation';
import {
  Modal, ConfirmDialog, Field, TextInput, Select, TextArea, Alert, EmptyState,
  ErrorState, ListSkeleton, TableSkeleton, Pagination, StarRating, PerformanceBadge,
  notifySuccess, reportError, formatDate, formatDateTime, formatRelative,
} from './VendorUI';

/* =============================== ACTIVITIES =============================== */

const ACTIVITY_ICONS = {
  Note: FiMessageSquare,
  Call: FiPhone,
  Email: FiMail,
  Meeting: FiCalendar,
  'Follow-up': FiClock,
  Task: FiCheckSquare,
  Reminder: FiBell,
  Comment: FiMessageSquare,
};

// Types where a due date is meaningful.
const SCHEDULABLE = new Set(['Follow-up', 'Task', 'Reminder']);

const ActivityForm = ({ activity, meta, onClose, onSubmit, saving }) => {
  const [form, setForm] = useState(() => ({
    activityType: 'Note',
    subject: '',
    body: '',
    ...(activity || {}),
    // Normalised after the spread so an ISO timestamp becomes a date input value.
    dueDate: activity?.dueDate ? String(activity.dueDate).slice(0, 10) : '',
  }));
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});

  const set = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));
  const errorFor = (field) => (touched[field] ? errors[field] : '');

  useEffect(() => { setErrors(validateActivityForm(form)); }, [form]);

  const handleSubmit = (event) => {
    event.preventDefault();
    const found = validateActivityForm(form);
    setErrors(found);
    setTouched(Object.fromEntries(Object.keys(found).map((k) => [k, true])));
    if (hasErrors(found)) return;
    onSubmit({ ...form, dueDate: form.dueDate || null });
  };

  return (
    <Modal
      title={activity ? 'Edit activity' : 'Log an activity'}
      onClose={onClose}
      footer={(
        <>
          <button type="button" className="vm-btn vm-btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="submit" form="vm-activity-form" className="vm-btn vm-btn-success" disabled={saving}>
            {saving && <span className="vm-spinner" aria-hidden="true" />}
            {saving ? 'Saving…' : 'Save'}
          </button>
        </>
      )}
    >
      <form id="vm-activity-form" noValidate onSubmit={handleSubmit}>
        <div className="vm-form-grid">
          <Field label="Type" htmlFor="vm-act-type">
            <Select id="vm-act-type" value={form.activityType} onChange={(e) => set('activityType', e.target.value)}>
              {meta.activityTypes.map((t) => <option key={t} value={t}>{t}</option>)}
            </Select>
          </Field>

          {SCHEDULABLE.has(form.activityType) && (
            <Field label="Due date" htmlFor="vm-act-due">
              <TextInput id="vm-act-due" type="date" value={form.dueDate} onChange={(e) => set('dueDate', e.target.value)} />
            </Field>
          )}

          <Field label="Subject" htmlFor="vm-act-subject" wide>
            <TextInput id="vm-act-subject" value={form.subject} onChange={(e) => set('subject', e.target.value)}
              placeholder="A short summary" />
          </Field>

          <Field label="Details" htmlFor="vm-act-body" required error={errorFor('body')} wide>
            <TextArea id="vm-act-body" rows={5} value={form.body} error={errorFor('body')}
              onChange={(e) => set('body', e.target.value)}
              onBlur={() => setTouched((p) => ({ ...p, body: true }))}
              placeholder="What happened, what was agreed, what happens next…" />
          </Field>
        </div>
      </form>
    </Modal>
  );
};

export const VendorActivitiesTab = ({ vendorId, meta, canEdit, currentUserId, isAdmin, onChanged }) => {
  const [activities, setActivities] = useState([]);
  const [pageInfo, setPageInfo] = useState({ total: 0, page: 1, pages: 1 });
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [typeFilter, setTypeFilter] = useState('');
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
      const data = await vendorApi.activities(vendorId, { page, limit, type: typeFilter || undefined });
      setActivities(data.activities || []);
      setPageInfo({ total: data.total || 0, page: data.page || 1, pages: data.pages || 1 });
    } catch (err) {
      setError(err.message);
      reportError(err, 'Unable to load the activity timeline');
    } finally {
      setLoading(false);
    }
  }, [vendorId, page, limit, typeFilter]);

  useEffect(() => { load(); }, [load]);

  const save = async (form) => {
    setSaving(true);
    try {
      if (editing?._id) await vendorApi.updateActivity(vendorId, editing._id, form);
      else await vendorApi.addActivity(vendorId, form);
      notifySuccess('Activity saved', 'The timeline has been updated.');
      setEditing(null);
      setPage(1);
      await load();
      onChanged?.();
    } catch (err) {
      reportError(err, 'Could not save the activity');
    } finally {
      setSaving(false);
    }
  };

  const toggleComplete = async (activity) => {
    try {
      await vendorApi.updateActivity(vendorId, activity._id, { completed: !activity.completedAt });
      await load();
    } catch (err) {
      reportError(err, 'Could not update the activity');
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await vendorApi.deleteActivity(vendorId, toDelete._id);
      notifySuccess('Activity deleted', 'The entry has been removed from the timeline.');
      setToDelete(null);
      await load();
      onChanged?.();
    } catch (err) {
      reportError(err, 'Could not delete the activity');
    } finally {
      setBusy(false);
    }
  };

  // Only the author (or an admin) may edit an entry — the server enforces this
  // too; hiding the buttons just avoids offering an action that would fail.
  const canModify = (activity) => isAdmin || String(activity.createdBy) === String(currentUserId);

  return (
    <div>
      <div className="vm-card-header">
        <div>
          <h3>Activity timeline</h3>
          <p className="vm-card-subtitle">
            {loading ? 'Loading…' : `${pageInfo.total} entr${pageInfo.total === 1 ? 'y' : 'ies'}`}
          </p>
        </div>

        <div className="vm-quick-actions">
          <label className="vm-sr-only" htmlFor="vm-act-filter">Filter by activity type</label>
          <select id="vm-act-filter" className="vm-select" style={{ width: 'auto' }}
            value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}>
            <option value="">All types</option>
            {meta.activityTypes.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>

          {canEdit && (
            <button type="button" className="vm-btn vm-btn-success vm-btn-sm" onClick={() => setEditing({})}>
              <FiPlus aria-hidden="true" /> Log activity
            </button>
          )}
        </div>
      </div>

      {loading && <ListSkeleton rows={4} />}
      {!loading && error && <ErrorState message={error} onRetry={load} />}

      {!loading && !error && activities.length === 0 && (
        typeFilter ? (
          <EmptyState
            title="No matching activities"
            message="No entries of this type have been logged for this vendor."
            action={(
              <button type="button" className="vm-btn vm-btn-ghost" onClick={() => setTypeFilter('')}>
                Show all types
              </button>
            )}
          />
        ) : (
          <EmptyState
            title="Nothing logged yet"
            message="Record calls, emails, meetings and follow-ups so the whole team can see the history."
            action={canEdit && (
              <button type="button" className="vm-btn vm-btn-success" onClick={() => setEditing({})}>
                <FiPlus aria-hidden="true" /> Log activity
              </button>
            )}
          />
        )
      )}

      {!loading && !error && activities.length > 0 && (
        <>
          <div className="vm-timeline">
            {activities.map((activity) => {
              const Icon = ACTIVITY_ICONS[activity.activityType] || FiMessageSquare;
              const overdue = activity.dueDate && !activity.completedAt
                && new Date(activity.dueDate) < new Date();

              return (
                <div className="vm-timeline-item" key={activity._id}>
                  <span className="vm-timeline-dot" aria-hidden="true"><Icon /></span>

                  <div className="vm-timeline-body">
                    <div className="vm-timeline-head">
                      <strong>{activity.subject || activity.activityType}</strong>
                      <span className="vm-tag">{activity.activityType}</span>
                      {activity.completedAt && <span className="vm-badge vm-status-active">Completed</span>}
                      {overdue && <span className="vm-badge vm-status-blacklisted">Overdue</span>}
                      <span className="vm-timeline-time">
                        {activity.createdByName || 'Someone'} · {formatRelative(activity.createdAt)}
                      </span>
                    </div>

                    <p className="vm-timeline-text">{activity.body}</p>

                    {activity.dueDate && (
                      <p className="vm-cell-muted" style={{ marginTop: '0.3rem' }}>
                        Due {formatDate(activity.dueDate)}
                      </p>
                    )}

                    {canEdit && canModify(activity) && (
                      <div className="vm-contact-actions">
                        {SCHEDULABLE.has(activity.activityType) && (
                          <button type="button" className="vm-contact-action" onClick={() => toggleComplete(activity)}>
                            <FiCheckCircle aria-hidden="true" />
                            {activity.completedAt ? 'Reopen' : 'Mark complete'}
                          </button>
                        )}
                        <button type="button" className="vm-contact-action" onClick={() => setEditing(activity)}>
                          <FiEdit2 aria-hidden="true" /> Edit
                        </button>
                        <button type="button" className="vm-contact-action" onClick={() => setToDelete(activity)}>
                          <FiTrash2 aria-hidden="true" /> Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
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
        <ActivityForm
          activity={editing._id ? editing : null}
          meta={meta}
          saving={saving}
          onClose={() => setEditing(null)}
          onSubmit={save}
        />
      )}

      {toDelete && (
        <ConfirmDialog
          title="Delete this activity?"
          message="This entry will be removed from the vendor's timeline. This cannot be undone."
          confirmLabel="Delete entry"
          busy={busy}
          onConfirm={remove}
          onCancel={() => setToDelete(null)}
        />
      )}
    </div>
  );
};

/* ============================== PERFORMANCE ============================== */

const CRITERIA = [
  { key: 'quality', label: 'Product quality' },
  { key: 'delivery', label: 'Delivery reliability' },
  { key: 'leadTime', label: 'Lead time' },
  { key: 'pricing', label: 'Pricing competitiveness' },
  { key: 'responsiveness', label: 'Response time' },
  { key: 'compliance', label: 'Compliance' },
];

const EvaluationForm = ({ onClose, onSubmit, saving }) => {
  const [form, setForm] = useState({
    quality: 0, delivery: 0, leadTime: 0, pricing: 0, responsiveness: 0, compliance: 0,
    evaluationDate: new Date().toISOString().slice(0, 10),
    periodLabel: '',
    comments: '',
  });
  const [errors, setErrors] = useState({});
  const [submitted, setSubmitted] = useState(false);

  const set = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  useEffect(() => { setErrors(validateEvaluationForm(form)); }, [form]);

  // The mean is shown live so the reviewer sees the score they are producing.
  const scored = CRITERIA.map((c) => Number(form[c.key])).filter((n) => n >= 1);
  const preview = scored.length === CRITERIA.length
    ? Math.round((scored.reduce((a, b) => a + b, 0) / scored.length) * 100) / 100
    : null;

  const handleSubmit = (event) => {
    event.preventDefault();
    setSubmitted(true);
    const found = validateEvaluationForm(form);
    setErrors(found);
    if (hasErrors(found)) return;
    onSubmit(form);
  };

  return (
    <Modal
      title="Record an evaluation"
      subtitle="Rate each criterion from 1 (poor) to 5 (excellent)."
      onClose={onClose}
      footer={(
        <>
          <button type="button" className="vm-btn vm-btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="submit" form="vm-eval-form" className="vm-btn vm-btn-success" disabled={saving}>
            {saving && <span className="vm-spinner" aria-hidden="true" />}
            {saving ? 'Saving…' : 'Save evaluation'}
          </button>
        </>
      )}
    >
      <form id="vm-eval-form" noValidate onSubmit={handleSubmit}>
        {CRITERIA.map((criterion) => (
          <div className="vm-panel-item" key={criterion.key} style={{ marginBottom: '0.6rem' }}>
            <div className="vm-panel-item-body">
              <div className="vm-panel-item-title" id={`vm-eval-${criterion.key}-label`}>{criterion.label}</div>
              {submitted && errors[criterion.key] && (
                <span className="vm-error-text" role="alert">{errors[criterion.key]}</span>
              )}
            </div>
            <StarRating
              value={form[criterion.key]}
              name={criterion.key}
              describedBy={`vm-eval-${criterion.key}-label`}
              onChange={(value, name) => set(name, value)}
            />
          </div>
        ))}

        <div className="vm-form-grid" style={{ marginTop: '1.25rem' }}>
          <Field label="Evaluation date" htmlFor="vm-eval-date">
            <TextInput id="vm-eval-date" type="date" value={form.evaluationDate} onChange={(e) => set('evaluationDate', e.target.value)} />
          </Field>

          <Field label="Period" htmlFor="vm-eval-period" hint="e.g. Q1 2026">
            <TextInput id="vm-eval-period" value={form.periodLabel} onChange={(e) => set('periodLabel', e.target.value)} />
          </Field>

          <Field label="Comments" htmlFor="vm-eval-comments" wide>
            <TextArea id="vm-eval-comments" rows={3} value={form.comments} onChange={(e) => set('comments', e.target.value)}
              placeholder="What went well, and what needs to improve." />
          </Field>
        </div>

        {preview !== null && (
          <Alert type="info">
            Overall score for this evaluation: <strong>{preview.toFixed(2)} / 5</strong>
          </Alert>
        )}
      </form>
    </Modal>
  );
};

export const VendorPerformanceTab = ({ vendorId, canEvaluate, onChanged }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await vendorApi.evaluations(vendorId, { limit: 50 }));
    } catch (err) {
      setError(err.message);
      reportError(err, 'Unable to load performance data');
    } finally {
      setLoading(false);
    }
  }, [vendorId]);

  useEffect(() => { load(); }, [load]);

  const save = async (form) => {
    setSaving(true);
    try {
      await vendorApi.addEvaluation(vendorId, form);
      notifySuccess('Evaluation recorded', 'The vendor score has been updated.');
      setAdding(false);
      await load();
      onChanged?.();
    } catch (err) {
      reportError(err, 'Could not save the evaluation');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await vendorApi.deleteEvaluation(vendorId, toDelete._id);
      notifySuccess('Evaluation deleted', 'The vendor score has been recalculated.');
      setToDelete(null);
      await load();
      onChanged?.();
    } catch (err) {
      reportError(err, 'Could not delete the evaluation');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <ListSkeleton rows={3} />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  const performance = data?.performance || {};
  const evaluations = data?.evaluations || [];
  const neverEvaluated = !performance.evaluationCount;

  return (
    <div>
      <div className="vm-card-header">
        <div>
          <h3>Performance</h3>
          <p className="vm-card-subtitle">
            {neverEvaluated
              ? 'This vendor has not been evaluated yet'
              : `${performance.evaluationCount} evaluation${performance.evaluationCount === 1 ? '' : 's'} · last on ${formatDate(performance.lastEvaluatedAt)}`}
          </p>
        </div>
        {canEvaluate && (
          <button type="button" className="vm-btn vm-btn-success vm-btn-sm" onClick={() => setAdding(true)}>
            <FiPlus aria-hidden="true" /> Record evaluation
          </button>
        )}
      </div>

      {/* An unevaluated vendor is shown as "No data" — never as a zero score. */}
      {neverEvaluated ? (
        <EmptyState
          title="No performance data yet"
          message="Record an evaluation to start tracking quality, delivery, pricing and compliance for this vendor."
          action={canEvaluate && (
            <button type="button" className="vm-btn vm-btn-success" onClick={() => setAdding(true)}>
              <FiPlus aria-hidden="true" /> Record evaluation
            </button>
          )}
        />
      ) : (
        <>
          <div className="vm-summary-grid" style={{ marginBottom: '1.5rem' }}>
            <div className="vm-summary-card">
              <span className="vm-summary-body">
                <span className="vm-summary-value">{Number(performance.overallScore).toFixed(2)}</span>
                <span className="vm-summary-label">
                  Overall score <PerformanceBadge band={data.performanceBand} score={performance.overallScore} />
                </span>
              </span>
            </div>
            {CRITERIA.map((criterion) => (
              <div className="vm-summary-card" key={criterion.key}>
                <span className="vm-summary-body" style={{ width: '100%' }}>
                  <span className="vm-summary-value" style={{ fontSize: '1.25rem' }}>
                    {performance[criterion.key] == null ? '—' : Number(performance[criterion.key]).toFixed(1)}
                  </span>
                  <span className="vm-summary-label">{criterion.label}</span>
                  <span className="vm-score-bar" style={{ marginTop: 6, display: 'block' }}>
                    <span style={{ width: `${((performance[criterion.key] || 0) / 5) * 100}%` }} />
                  </span>
                </span>
              </div>
            ))}
          </div>

          <div className="vm-table-wrapper">
            <table className="vm-table">
              <caption className="vm-sr-only">Recorded evaluations</caption>
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Period</th>
                  <th scope="col">Score</th>
                  <th scope="col">Evaluated by</th>
                  <th scope="col">Comments</th>
                  {canEvaluate && <th scope="col">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {evaluations.map((evaluation) => (
                  <tr key={evaluation._id}>
                    <td data-label="Date">{formatDate(evaluation.evaluationDate)}</td>
                    <td data-label="Period">{evaluation.periodLabel || '—'}</td>
                    <td data-label="Score">
                      <StarRating value={evaluation.overallScore} readOnly />
                    </td>
                    <td data-label="Evaluated by">{evaluation.evaluatedByName || '—'}</td>
                    <td data-label="Comments" className="vm-cell-muted">{evaluation.comments || '—'}</td>
                    {canEvaluate && (
                      <td data-label="Actions">
                        <button type="button" className="vm-icon-btn vm-danger" title="Delete evaluation"
                          aria-label={`Delete the evaluation from ${formatDate(evaluation.evaluationDate)}`}
                          onClick={() => setToDelete(evaluation)}>
                          <FiTrash2 />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {adding && <EvaluationForm saving={saving} onClose={() => setAdding(false)} onSubmit={save} />}

      {toDelete && (
        <ConfirmDialog
          title="Delete this evaluation?"
          message="The vendor's overall score will be recalculated from the remaining evaluations. If this is the only one, the vendor returns to having no performance data."
          confirmLabel="Delete evaluation"
          busy={busy}
          onConfirm={remove}
          onCancel={() => setToDelete(null)}
        />
      )}
    </div>
  );
};

/* ============================== AUDIT HISTORY ============================== */

export const VendorAuditTab = ({ vendorId }) => {
  const [entries, setEntries] = useState([]);
  const [pageInfo, setPageInfo] = useState({ total: 0, page: 1, pages: 1 });
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await vendorApi.audit(vendorId, { page, limit });
      setEntries(data.entries || []);
      setPageInfo({ total: data.total || 0, page: data.page || 1, pages: data.pages || 1 });
    } catch (err) {
      setError(err.message);
      reportError(err, 'Unable to load the audit history');
    } finally {
      setLoading(false);
    }
  }, [vendorId, page, limit]);

  useEffect(() => { load(); }, [load]);

  // Render a change summary readably. Banking values are already redacted
  // server-side, so nothing sensitive can appear here.
  const describe = (details = {}) => {
    if (details.changes && Object.keys(details.changes).length) {
      return Object.entries(details.changes)
        .map(([field, change]) => `${field}: ${change.from ?? '(empty)'} → ${change.to ?? '(empty)'}`)
        .join(' · ');
    }
    const parts = [];
    if (details.from && details.to) parts.push(`${details.from} → ${details.to}`);
    ['document', 'contactName', 'addressType', 'product', 'activityType', 'reason', 'overallScore']
      .forEach((key) => { if (details[key]) parts.push(`${details[key]}`); });
    return parts.join(' · ') || '—';
  };

  if (loading) return <TableSkeleton rows={5} columns={4} />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div>
      <div className="vm-card-header">
        <div>
          <h3>Audit history</h3>
          <p className="vm-card-subtitle">
            {pageInfo.total} recorded event{pageInfo.total === 1 ? '' : 's'}
          </p>
        </div>
      </div>

      {entries.length === 0 ? (
        <EmptyState
          title="No audit entries yet"
          message="Changes to this vendor will be recorded here as they happen."
        />
      ) : (
        <>
          <div className="vm-table-wrapper">
            <table className="vm-table">
              <caption className="vm-sr-only">Audit history for this vendor</caption>
              <thead>
                <tr>
                  <th scope="col">When</th>
                  <th scope="col">Action</th>
                  <th scope="col">By</th>
                  <th scope="col">Details</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry._id}>
                    <td data-label="When">{formatDateTime(entry.timestamp)}</td>
                    <td data-label="Action"><span className="vm-cell-primary">{entry.action}</span></td>
                    <td data-label="By">
                      {entry.name || entry.userId || '—'}
                      {entry.role && <div className="vm-cell-muted">{entry.role}</div>}
                    </td>
                    <td data-label="Details" className="vm-cell-muted">{describe(entry.details)}</td>
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
    </div>
  );
};

export default VendorActivitiesTab;
