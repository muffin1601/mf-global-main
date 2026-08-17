// Vendor performance leaderboard.
//
// Ranks only vendors that have actually been evaluated. Vendors with no
// evaluations are reported as a separate count rather than being ranked last
// with an implied zero — "not measured" is not the same as "scored badly".

import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiRefreshCw, FiStar } from 'react-icons/fi';

import { vendorApi } from '../../../utils/vendorApi';
import {
  StatusBadge, PerformanceBadge, Pagination, EmptyState, ErrorState,
  TableSkeleton, StarRating, Alert, reportError, formatDate,
} from './VendorUI';
import '../../../styles/crm/Vendor.css';

const CRITERIA = [
  { key: 'quality', label: 'Quality' },
  { key: 'delivery', label: 'Delivery' },
  { key: 'leadTime', label: 'Lead time' },
  { key: 'pricing', label: 'Pricing' },
  { key: 'responsiveness', label: 'Response' },
  { key: 'compliance', label: 'Compliance' },
];

const VendorPerformanceBoard = () => {
  const navigate = useNavigate();

  const [vendors, setVendors] = useState([]);
  const [unevaluated, setUnevaluated] = useState(0);
  const [pageInfo, setPageInfo] = useState({ total: 0, page: 1, pages: 1 });
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await vendorApi.leaderboard({ page, limit });
      setVendors(data.vendors || []);
      setUnevaluated(data.unevaluated || 0);
      setPageInfo({ total: data.total || 0, page: data.page || 1, pages: data.pages || 1 });
    } catch (err) {
      setError(err.message);
      reportError(err, 'Unable to load vendor performance');
    } finally {
      setLoading(false);
    }
  }, [page, limit]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="vm-module">
      <section className="vm-card">
        <div className="vm-card-header">
          <div>
            <h2>Vendor performance</h2>
            <p className="vm-card-subtitle">
              {loading
                ? 'Loading…'
                : `${pageInfo.total} evaluated vendor${pageInfo.total === 1 ? '' : 's'}, ranked by overall score`}
            </p>
          </div>
          <button type="button" className="vm-btn vm-btn-ghost" onClick={load} disabled={loading}>
            <FiRefreshCw aria-hidden="true" /> Refresh
          </button>
        </div>

        {!loading && unevaluated > 0 && (
          <Alert type="info">
            {unevaluated} active vendor{unevaluated === 1 ? ' has' : 's have'} no evaluations yet and
            {unevaluated === 1 ? ' is' : ' are'} not ranked here. Open a vendor and use
            <strong> Record evaluation</strong> to start scoring them.
          </Alert>
        )}

        {loading && <TableSkeleton rows={6} columns={6} />}
        {!loading && error && <ErrorState message={error} onRetry={load} />}

        {!loading && !error && vendors.length === 0 && (
          <EmptyState
            title="No vendors have been evaluated yet"
            message="Once you record evaluations, vendors will be ranked here by quality, delivery, pricing and compliance."
          />
        )}

        {!loading && !error && vendors.length > 0 && (
          <>
            <div className="vm-table-wrapper">
              <table className="vm-table">
                <caption className="vm-sr-only">Vendors ranked by overall performance score</caption>
                <thead>
                  <tr>
                    <th scope="col">#</th>
                    <th scope="col">Vendor</th>
                    <th scope="col">Category</th>
                    <th scope="col">Status</th>
                    <th scope="col">Overall</th>
                    {CRITERIA.map((c) => <th scope="col" key={c.key}>{c.label}</th>)}
                    <th scope="col">Evaluations</th>
                    <th scope="col">Last evaluated</th>
                  </tr>
                </thead>
                <tbody>
                  {vendors.map((vendor, index) => (
                    <tr key={vendor._id}>
                      <td data-label="Rank">{(pageInfo.page - 1) * limit + index + 1}</td>
                      <td data-label="Vendor">
                        <button
                          type="button"
                          className="vm-link"
                          onClick={() => navigate(`/crm/vendors/${vendor._id}`)}
                        >
                          {vendor.name}
                        </button>
                        <div className="vm-cell-muted">{vendor.v_code}</div>
                      </td>
                      <td data-label="Category">{vendor.category?.name || '—'}</td>
                      <td data-label="Status"><StatusBadge status={vendor.status} /></td>
                      <td data-label="Overall">
                        <StarRating value={vendor.performance?.overallScore} readOnly />
                        <div style={{ marginTop: 4 }}>
                          <PerformanceBadge band={vendor.performanceBand} score={vendor.performance?.overallScore} />
                        </div>
                      </td>
                      {CRITERIA.map((criterion) => (
                        <td data-label={criterion.label} key={criterion.key}>
                          {vendor.performance?.[criterion.key] == null
                            ? '—'
                            : Number(vendor.performance[criterion.key]).toFixed(1)}
                        </td>
                      ))}
                      <td data-label="Evaluations">
                        <FiStar aria-hidden="true" style={{ verticalAlign: '-2px', marginRight: 4, color: '#f59e0b' }} />
                        {vendor.performance?.evaluationCount ?? 0}
                      </td>
                      <td data-label="Last evaluated">{formatDate(vendor.performance?.lastEvaluatedAt)}</td>
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
      </section>
    </div>
  );
};

export default VendorPerformanceBoard;
