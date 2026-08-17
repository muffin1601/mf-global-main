// Vendor list — the module's main screen.
//
// Search, filtering, sorting and paging are all resolved SERVER-side: the
// browser only ever holds one page of rows, so the screen stays responsive with
// thousands of vendors. Typing is debounced and in-flight requests are aborted
// when the query changes, so a fast typist never sees stale results land.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FiSearch, FiFilter, FiRefreshCw, FiDownload, FiUpload, FiPlus, FiColumns,
  FiEdit2, FiArchive, FiEye, FiRotateCcw, FiTrash2, FiX, FiChevronUp, FiChevronDown,
} from 'react-icons/fi';

import { vendorApi, vendorFiles } from '../../../utils/vendorApi';
import { useVendorMeta, useDebounced } from './useVendorMeta';
import VendorSummaryCards from './VendorSummaryCards';
import VendorFormModal from './VendorFormModal';
import VendorImportModal from './VendorImportModal';
import {
  StatusBadge, PerformanceBadge, Pagination, EmptyState, ErrorState, TableSkeleton,
  ConfirmDialog, notifySuccess, reportError, formatDate,
} from './VendorUI';
import '../../../styles/crm/Vendor.css';

// Column definitions drive both the header and the body, so toggling
// visibility can never desynchronise the two.
const COLUMNS = [
  { key: 'name', label: 'Vendor', sortable: true, always: true },
  { key: 'v_code', label: 'Vendor Code', sortable: true },
  { key: 'category', label: 'Category' },
  { key: 'primaryContact', label: 'Primary Contact' },
  { key: 'phone', label: 'Phone' },
  { key: 'email', label: 'Email' },
  { key: 'status', label: 'Status', sortable: true },
  { key: 'owner', label: 'Assigned To' },
  { key: 'productCount', label: 'Products' },
  { key: 'performance', label: 'Performance', sortable: true },
  { key: 'lastActivityAt', label: 'Last Activity', sortable: true },
  { key: 'createdAt', label: 'Created', sortable: true },
];

const DEFAULT_VISIBLE = [
  'name', 'v_code', 'category', 'primaryContact', 'phone', 'status', 'owner',
  'productCount', 'createdAt',
];

const STORAGE_KEY = 'vm.visibleColumns';

const EMPTY_FILTERS = {
  status: '',
  category: '',
  owner: '',
  priority: '',
  type: '',
  createdFrom: '',
  createdTo: '',
  archived: '',
};

// Preset views used by the sidebar's Active/Pending/Inactive entries.
const PRESET_STATUS = { active: 'Active', pending: 'Pending', inactive: 'Inactive' };

const VendorList = ({ preset = 'all' }) => {
  const navigate = useNavigate();
  const { meta, can, loading: metaLoading, reload: reloadMeta } = useVendorMeta();

  const [rows, setRows] = useState([]);
  const [pageInfo, setPageInfo] = useState({ total: 0, page: 1, pages: 1, limit: 25 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [searchInput, setSearchInput] = useState('');
  const search = useDebounced(searchInput, 400);

  const [filters, setFilters] = useState({
    ...EMPTY_FILTERS,
    status: PRESET_STATUS[preset] || '',
  });
  const [showFilters, setShowFilters] = useState(false);
  const [sort, setSort] = useState({ sortBy: 'createdAt', sortDir: 'desc' });
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);

  const [selected, setSelected] = useState(() => new Set());
  const [visibleColumns, setVisibleColumns] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      return Array.isArray(saved) && saved.length ? saved : DEFAULT_VISIBLE;
    } catch {
      return DEFAULT_VISIBLE;
    }
  });
  const [showColumns, setShowColumns] = useState(false);

  const [formVendor, setFormVendor] = useState(null); // {} = create, {…} = edit
  const [showImport, setShowImport] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [confirmText, setConfirmText] = useState('');
  const [busy, setBusy] = useState(false);
  const [bulkStatus, setBulkStatus] = useState('');
  const [summaryToken, setSummaryToken] = useState(0);
  const [exporting, setExporting] = useState(false);

  const abortRef = useRef(null);
  const columnsMenuRef = useRef(null);

  // The preset comes from the route, so switching sidebar entries re-filters.
  useEffect(() => {
    setFilters((prev) => ({ ...prev, status: PRESET_STATUS[preset] || '' }));
    setPage(1);
  }, [preset]);

  const query = useMemo(() => ({
    ...filters,
    search,
    ...sort,
    page,
    limit,
  }), [filters, search, sort, page, limit]);

  const load = useCallback(async () => {
    // Cancel the previous request so an older, slower response cannot overwrite
    // the results of the newer one.
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError('');
    try {
      const data = await vendorApi.list(query, { signal: controller.signal });
      setRows(data.vendors || []);
      setPageInfo({
        total: data.total || 0,
        page: data.page || 1,
        pages: data.pages || 1,
        limit: data.limit || limit,
      });
    } catch (err) {
      if (err?.cancelled) return;
      setError(err.message);
      reportError(err, 'Unable to load vendors');
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
    // `limit` is only a fallback for the response shape; `query` already carries it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  useEffect(() => {
    load();
    return () => abortRef.current?.abort();
  }, [load]);

  // Clear the selection whenever the visible set changes — otherwise a bulk
  // action could apply to rows the user can no longer see.
  useEffect(() => { setSelected(new Set()); }, [query]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(visibleColumns));
  }, [visibleColumns]);

  // Close the column menu on an outside click or Escape.
  useEffect(() => {
    if (!showColumns) return undefined;
    const onDown = (e) => {
      if (columnsMenuRef.current && !columnsMenuRef.current.contains(e.target)) setShowColumns(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setShowColumns(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [showColumns]);

  const shownColumns = useMemo(
    () => COLUMNS.filter((c) => c.always || visibleColumns.includes(c.key)),
    [visibleColumns]
  );

  const activeFilterChips = useMemo(() => {
    const chips = [];
    const labelFor = {
      status: 'Status', priority: 'Priority', type: 'Type',
      createdFrom: 'Created from', createdTo: 'Created to',
    };
    Object.entries(filters).forEach(([key, value]) => {
      if (!value) return;
      if (key === 'category') {
        const found = meta.categories.find((c) => c._id === value);
        chips.push({ key, label: `Category: ${found?.name || 'Selected'}` });
        return;
      }
      if (key === 'owner') {
        const found = meta.owners.find((o) => o._id === value);
        chips.push({ key, label: `Owner: ${value === 'unassigned' ? 'Unassigned' : found?.name || 'Selected'}` });
        return;
      }
      if (key === 'archived') {
        chips.push({ key, label: 'Archived only' });
        return;
      }
      chips.push({ key, label: `${labelFor[key] || key}: ${value}` });
    });
    if (search) chips.push({ key: '__search', label: `Search: ${search}` });
    return chips;
  }, [filters, search, meta.categories, meta.owners]);

  const setFilter = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const clearFilters = () => {
    setFilters({ ...EMPTY_FILTERS, status: PRESET_STATUS[preset] || '' });
    setSearchInput('');
    setPage(1);
  };

  const toggleSort = (key) => {
    setSort((prev) => ({
      sortBy: key,
      sortDir: prev.sortBy === key && prev.sortDir === 'desc' ? 'asc' : 'desc',
    }));
    setPage(1);
  };

  const toggleRow = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const allOnPageSelected = rows.length > 0 && rows.every((r) => selected.has(r._id));

  const toggleAllOnPage = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) rows.forEach((r) => next.delete(r._id));
      else rows.forEach((r) => next.add(r._id));
      return next;
    });
  };

  const refreshAll = () => {
    load();
    setSummaryToken((n) => n + 1);
  };

  /* ------------------------------ Actions ------------------------------ */

  const handleExport = async () => {
    setExporting(true);
    try {
      await vendorFiles.exportCsv({ ...filters, search, ...sort });
      notifySuccess('Export ready', 'The vendor list has been downloaded as a CSV file.');
    } catch (err) {
      reportError(err, 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  const runConfirm = async () => {
    if (!confirm) return;
    setBusy(true);
    try {
      await confirm.action();
      notifySuccess(confirm.successTitle, confirm.successMessage);
      setConfirm(null);
      setConfirmText('');
      setSelected(new Set());
      refreshAll();
    } catch (err) {
      reportError(err, confirm.errorTitle || 'Action failed');
    } finally {
      setBusy(false);
    }
  };

  const askArchive = (vendor) => setConfirm({
    title: 'Archive this vendor?',
    message: `"${vendor.name}" (${vendor.v_code}) will be hidden from the active vendor list. Its contacts, documents, pricing and history are all kept, and you can restore it at any time.`,
    confirmLabel: 'Archive vendor',
    tone: 'warning',
    action: () => vendorApi.archive(vendor._id),
    successTitle: 'Vendor archived',
    successMessage: `"${vendor.name}" has been archived.`,
  });

  const askRestore = (vendor) => setConfirm({
    title: 'Restore this vendor?',
    message: `"${vendor.name}" (${vendor.v_code}) will return to the active vendor list.`,
    confirmLabel: 'Restore vendor',
    tone: 'success',
    action: () => vendorApi.restore(vendor._id),
    successTitle: 'Vendor restored',
    successMessage: `"${vendor.name}" is active again.`,
  });

  const askDelete = (vendor) => setConfirm({
    title: 'Permanently delete this vendor?',
    message: `This cannot be undone. "${vendor.name}" (${vendor.v_code}) will be deleted along with its contacts, addresses, documents, pricing records, evaluations and notes. The audit history is preserved.`,
    confirmLabel: 'Delete permanently',
    tone: 'danger',
    requireText: vendor.v_code,
    action: () => vendorApi.remove(vendor._id, vendor.v_code),
    successTitle: 'Vendor deleted',
    successMessage: `"${vendor.name}" has been permanently deleted.`,
  });

  const askBulkArchive = (restore = false) => setConfirm({
    title: restore ? `Restore ${selected.size} vendors?` : `Archive ${selected.size} vendors?`,
    message: restore
      ? `${selected.size} vendors will return to the active list.`
      : `${selected.size} vendors will be hidden from the active list. Nothing is deleted and you can restore them later.`,
    confirmLabel: restore ? 'Restore vendors' : 'Archive vendors',
    tone: restore ? 'success' : 'warning',
    action: () => vendorApi.bulkArchive([...selected], restore),
    successTitle: restore ? 'Vendors restored' : 'Vendors archived',
    successMessage: `${selected.size} vendors updated.`,
  });

  const applyBulkStatus = async () => {
    if (!bulkStatus || !selected.size) return;
    setBusy(true);
    try {
      const result = await vendorApi.bulkStatus([...selected], bulkStatus);
      notifySuccess('Status updated', `${result.updated} vendor${result.updated === 1 ? '' : 's'} set to ${bulkStatus}.`);
      setBulkStatus('');
      setSelected(new Set());
      refreshAll();
    } catch (err) {
      reportError(err, 'Bulk update failed');
    } finally {
      setBusy(false);
    }
  };

  /* ------------------------------ Rendering ------------------------------ */

  const renderCell = (vendor, key) => {
    switch (key) {
      case 'name':
        return (
          <button
            type="button"
            className="vm-link vm-truncate"
            onClick={() => navigate(`/crm/vendors/${vendor._id}`)}
            title={vendor.name}
          >
            {vendor.name}
          </button>
        );
      case 'v_code':
        return <span className="vm-cell-muted">{vendor.v_code || '—'}</span>;
      case 'category':
        return vendor.category?.name || '—';
      case 'primaryContact':
        return vendor.primaryContact?.fullName
          ? <span className="vm-truncate" title={vendor.primaryContact.fullName}>{vendor.primaryContact.fullName}</span>
          : <span className="vm-cell-muted">—</span>;
      case 'phone':
        return vendor.primaryContact?.phone || vendor.phone || '—';
      case 'email':
        return (
          <span className="vm-truncate" title={vendor.primaryContact?.email || vendor.email || ''}>
            {vendor.primaryContact?.email || vendor.email || '—'}
          </span>
        );
      case 'status':
        return <StatusBadge status={vendor.status} />;
      case 'owner':
        return vendor.owner?.name || vendor.owner?.username || <span className="vm-cell-muted">Unassigned</span>;
      case 'productCount':
        return vendor.productCount ?? 0;
      case 'performance':
        return (
          <PerformanceBadge
            band={vendor.performanceBand}
            score={vendor.performance?.overallScore}
          />
        );
      case 'lastActivityAt':
        return formatDate(vendor.lastActivityAt);
      case 'createdAt':
        return formatDate(vendor.createdAt);
      default:
        return '—';
    }
  };

  const isArchivedView = filters.archived === 'true';
  const hasAnyFilter = activeFilterChips.length > 0;

  const heading = {
    all: 'All Vendors',
    active: 'Active Vendors',
    pending: 'Pending Vendors',
    inactive: 'Inactive Vendors',
  }[preset] || 'All Vendors';

  return (
    <div className="vm-module">
      <VendorSummaryCards
        onFilterStatus={(status) => setFilter('status', status)}
        activeStatus={filters.status}
        refreshToken={summaryToken}
      />

      <section className="vm-card">
        <div className="vm-card-header">
          <div>
            <h2>{heading}</h2>
            <p className="vm-card-subtitle">
              {loading ? 'Loading…' : `${pageInfo.total} vendor${pageInfo.total === 1 ? '' : 's'}`}
              {isArchivedView ? ' · showing archived' : ''}
            </p>
          </div>

          <div className="vm-quick-actions">
            <button type="button" className="vm-btn vm-btn-ghost" onClick={refreshAll} disabled={loading}>
              <FiRefreshCw aria-hidden="true" /> Refresh
            </button>

            {can('vendor.export') && (
              <button type="button" className="vm-btn vm-btn-ghost" onClick={handleExport} disabled={exporting || !pageInfo.total}>
                {exporting ? <span className="vm-spinner vm-spinner-dark" aria-hidden="true" /> : <FiDownload aria-hidden="true" />}
                Export
              </button>
            )}

            {can('vendor.import') && (
              <button type="button" className="vm-btn vm-btn-ghost" onClick={() => setShowImport(true)}>
                <FiUpload aria-hidden="true" /> Import
              </button>
            )}

            {can('vendor.create') && (
              <button type="button" className="vm-btn vm-btn-success" onClick={() => setFormVendor({})}>
                <FiPlus aria-hidden="true" /> Add Vendor
              </button>
            )}
          </div>
        </div>

        {/* ---------------------------- Toolbar ---------------------------- */}
        <div className="vm-toolbar">
          <div className="vm-search">
            <FiSearch aria-hidden="true" />
            <label className="vm-sr-only" htmlFor="vm-search-input">Search vendors</label>
            <input
              id="vm-search-input"
              type="search"
              className="vm-input"
              placeholder="Search by name, code, GSTIN, PAN, email or phone"
              value={searchInput}
              onChange={(e) => { setSearchInput(e.target.value); setPage(1); }}
            />
          </div>

          <button
            type="button"
            className="vm-btn vm-btn-ghost"
            onClick={() => setShowFilters((v) => !v)}
            aria-expanded={showFilters}
          >
            <FiFilter aria-hidden="true" /> Filters
          </button>

          <div className="vm-menu" ref={columnsMenuRef}>
            <button
              type="button"
              className="vm-btn vm-btn-ghost"
              onClick={() => setShowColumns((v) => !v)}
              aria-expanded={showColumns}
              aria-haspopup="true"
            >
              <FiColumns aria-hidden="true" /> Columns
            </button>
            {showColumns && (
              <div className="vm-menu-panel">
                {COLUMNS.map((column) => (
                  <label key={column.key}>
                    <input
                      type="checkbox"
                      checked={column.always || visibleColumns.includes(column.key)}
                      disabled={column.always}
                      onChange={() => setVisibleColumns((prev) => (
                        prev.includes(column.key)
                          ? prev.filter((k) => k !== column.key)
                          : [...prev, column.key]
                      ))}
                    />
                    {column.label}
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ---------------------------- Filters ---------------------------- */}
        {showFilters && (
          <div className="vm-filters">
            <div className="vm-field">
              <label htmlFor="vm-filter-status">Status</label>
              <select id="vm-filter-status" className="vm-select" value={filters.status} onChange={(e) => setFilter('status', e.target.value)}>
                <option value="">All statuses</option>
                {meta.statuses.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div className="vm-field">
              <label htmlFor="vm-filter-category">Category</label>
              <select id="vm-filter-category" className="vm-select" value={filters.category} onChange={(e) => setFilter('category', e.target.value)}>
                <option value="">All categories</option>
                {meta.categories.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
              </select>
            </div>

            <div className="vm-field">
              <label htmlFor="vm-filter-owner">Assigned to</label>
              <select id="vm-filter-owner" className="vm-select" value={filters.owner} onChange={(e) => setFilter('owner', e.target.value)}>
                <option value="">Anyone</option>
                <option value="unassigned">Unassigned</option>
                {meta.owners.map((o) => <option key={o._id} value={o._id}>{o.name || o.username}</option>)}
              </select>
            </div>

            <div className="vm-field">
              <label htmlFor="vm-filter-priority">Priority</label>
              <select id="vm-filter-priority" className="vm-select" value={filters.priority} onChange={(e) => setFilter('priority', e.target.value)}>
                <option value="">Any priority</option>
                {meta.priorities.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>

            <div className="vm-field">
              <label htmlFor="vm-filter-type">Vendor type</label>
              <select id="vm-filter-type" className="vm-select" value={filters.type} onChange={(e) => setFilter('type', e.target.value)}>
                <option value="">Any type</option>
                {meta.types.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <div className="vm-field">
              <label htmlFor="vm-filter-from">Created from</label>
              <input id="vm-filter-from" type="date" className="vm-input" value={filters.createdFrom} onChange={(e) => setFilter('createdFrom', e.target.value)} />
            </div>

            <div className="vm-field">
              <label htmlFor="vm-filter-to">Created to</label>
              <input id="vm-filter-to" type="date" className="vm-input" value={filters.createdTo} onChange={(e) => setFilter('createdTo', e.target.value)} />
            </div>

            <div className="vm-field">
              <label htmlFor="vm-filter-archived">Archived</label>
              <select id="vm-filter-archived" className="vm-select" value={filters.archived} onChange={(e) => setFilter('archived', e.target.value)}>
                <option value="">Active records</option>
                <option value="true">Archived records</option>
              </select>
            </div>
          </div>
        )}

        {hasAnyFilter && (
          <div className="vm-active-filters">
            {activeFilterChips.map((chip) => (
              <span className="vm-chip" key={chip.key}>
                {chip.label}
                <button
                  type="button"
                  aria-label={`Remove filter ${chip.label}`}
                  onClick={() => (chip.key === '__search' ? setSearchInput('') : setFilter(chip.key, ''))}
                >
                  <FiX />
                </button>
              </span>
            ))}
            <button type="button" className="vm-btn vm-btn-ghost vm-btn-sm" onClick={clearFilters}>
              Clear all
            </button>
          </div>
        )}

        {/* --------------------------- Bulk bar --------------------------- */}
        {selected.size > 0 && (
          <div className="vm-bulk-bar">
            <strong>{selected.size} selected</strong>

            {can('vendor.edit') && (
              <>
                <label className="vm-sr-only" htmlFor="vm-bulk-status">Set status for selected vendors</label>
                <select
                  id="vm-bulk-status"
                  className="vm-select"
                  style={{ width: 'auto' }}
                  value={bulkStatus}
                  onChange={(e) => setBulkStatus(e.target.value)}
                >
                  <option value="">Change status to…</option>
                  {meta.statuses.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <button type="button" className="vm-btn vm-btn-primary vm-btn-sm" onClick={applyBulkStatus} disabled={!bulkStatus || busy}>
                  Apply
                </button>
              </>
            )}

            {can('vendor.archive') && (
              <button
                type="button"
                className="vm-btn vm-btn-warning vm-btn-sm"
                onClick={() => askBulkArchive(isArchivedView)}
              >
                {isArchivedView ? <FiRotateCcw aria-hidden="true" /> : <FiArchive aria-hidden="true" />}
                {isArchivedView ? 'Restore' : 'Archive'}
              </button>
            )}

            <button type="button" className="vm-btn vm-btn-ghost vm-btn-sm" onClick={() => setSelected(new Set())}>
              Clear selection
            </button>
          </div>
        )}

        {/* ----------------------------- Table ----------------------------- */}
        {loading && <TableSkeleton rows={6} columns={shownColumns.length + 2} />}

        {!loading && error && <ErrorState message={error} onRetry={load} />}

        {!loading && !error && rows.length === 0 && (
          hasAnyFilter ? (
            <EmptyState
              title="No vendors match your current filters."
              message="Try a different search term, or clear the filters to see everything."
              action={(
                <button type="button" className="vm-btn vm-btn-ghost" onClick={clearFilters}>
                  Clear filters
                </button>
              )}
            />
          ) : (
            <EmptyState
              title="No vendors found"
              message="Add your first vendor to start managing suppliers."
              action={can('vendor.create') && (
                <button type="button" className="vm-btn vm-btn-success" onClick={() => setFormVendor({})}>
                  <FiPlus aria-hidden="true" /> Add Vendor
                </button>
              )}
            />
          )
        )}

        {!loading && !error && rows.length > 0 && (
          <>
            <div className="vm-table-wrapper">
              <table className="vm-table">
                <caption className="vm-sr-only">
                  Vendors, page {pageInfo.page} of {pageInfo.pages}
                </caption>
                <thead>
                  <tr>
                    <th className="vm-checkbox-cell">
                      <input
                        type="checkbox"
                        checked={allOnPageSelected}
                        onChange={toggleAllOnPage}
                        aria-label="Select all vendors on this page"
                      />
                    </th>
                    {shownColumns.map((column) => (
                      <th key={column.key} scope="col"
                        aria-sort={sort.sortBy === column.key
                          ? (sort.sortDir === 'asc' ? 'ascending' : 'descending')
                          : undefined}
                      >
                        {column.sortable ? (
                          <button type="button" onClick={() => toggleSort(column.key)}>
                            {column.label}
                            {sort.sortBy === column.key && (
                              sort.sortDir === 'asc' ? <FiChevronUp aria-hidden="true" /> : <FiChevronDown aria-hidden="true" />
                            )}
                          </button>
                        ) : column.label}
                      </th>
                    ))}
                    <th scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((vendor) => (
                    <tr key={vendor._id} aria-selected={selected.has(vendor._id)}>
                      <td className="vm-checkbox-cell" data-label="">
                        <input
                          type="checkbox"
                          checked={selected.has(vendor._id)}
                          onChange={() => toggleRow(vendor._id)}
                          aria-label={`Select ${vendor.name}`}
                        />
                      </td>
                      {shownColumns.map((column) => (
                        <td key={column.key} data-label={column.label}>
                          {renderCell(vendor, column.key)}
                        </td>
                      ))}
                      <td data-label="Actions">
                        <div className="vm-cell-actions">
                          <button
                            type="button"
                            className="vm-icon-btn"
                            title={`View ${vendor.name}`}
                            aria-label={`View ${vendor.name}`}
                            onClick={() => navigate(`/crm/vendors/${vendor._id}`)}
                          >
                            <FiEye />
                          </button>

                          {can('vendor.edit') && (
                            <button
                              type="button"
                              className="vm-icon-btn"
                              title={`Edit ${vendor.name}`}
                              aria-label={`Edit ${vendor.name}`}
                              onClick={() => setFormVendor(vendor)}
                            >
                              <FiEdit2 />
                            </button>
                          )}

                          {can('vendor.archive') && (
                            vendor.isArchived ? (
                              <button
                                type="button"
                                className="vm-icon-btn"
                                title={`Restore ${vendor.name}`}
                                aria-label={`Restore ${vendor.name}`}
                                onClick={() => askRestore(vendor)}
                              >
                                <FiRotateCcw />
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="vm-icon-btn"
                                title={`Archive ${vendor.name}`}
                                aria-label={`Archive ${vendor.name}`}
                                onClick={() => askArchive(vendor)}
                              >
                                <FiArchive />
                              </button>
                            )
                          )}

                          {/* Permanent deletion is only offered where it is
                              actually permitted: an archived record, admin. */}
                          {can('vendor.delete') && vendor.isArchived && (
                            <button
                              type="button"
                              className="vm-icon-btn vm-danger"
                              title={`Delete ${vendor.name} permanently`}
                              aria-label={`Delete ${vendor.name} permanently`}
                              onClick={() => askDelete(vendor)}
                            >
                              <FiTrash2 />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Pagination
              page={pageInfo.page}
              pages={pageInfo.pages}
              total={pageInfo.total}
              limit={pageInfo.limit}
              onPageChange={setPage}
              onLimitChange={(n) => { setLimit(n); setPage(1); }}
            />
          </>
        )}
      </section>

      {formVendor && (
        <VendorFormModal
          vendor={formVendor._id ? formVendor : null}
          meta={meta}
          metaLoading={metaLoading}
          can={can}
          onClose={() => setFormVendor(null)}
          onSaved={() => { setFormVendor(null); refreshAll(); }}
        />
      )}

      {showImport && (
        <VendorImportModal
          onClose={() => setShowImport(false)}
          onImported={() => { refreshAll(); reloadMeta(); }}
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

export default VendorList;
