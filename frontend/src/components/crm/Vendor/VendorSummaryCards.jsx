// Dashboard summary cards for Vendor Management.
//
// Every figure comes from /vendors/summary, which derives it from real records.
// Metrics with no underlying data render "No data" rather than a zero that
// would read as a real measurement.

import React, { useCallback, useEffect, useState } from 'react';
import {
  FiUsers, FiCheckCircle, FiClock, FiSlash, FiFileText, FiUserPlus, FiAlertTriangle, FiStar, FiTruck,
} from 'react-icons/fi';
import { vendorApi } from '../../../utils/vendorApi';
import { CardSkeleton, ErrorState, reportError } from './VendorUI';

const Card = ({ icon, color, value, label, onClick, active, hint }) => {
  const Icon = icon;
  const isNoData = value === null || value === undefined;
  const body = (
    <>
      <span className="vm-summary-icon" style={{ background: color }} aria-hidden="true">
        <Icon />
      </span>
      <span className="vm-summary-body">
        <span className={`vm-summary-value ${isNoData ? 'vm-nodata' : ''}`}>
          {isNoData ? 'No data' : value}
        </span>
        <span className="vm-summary-label">{label}</span>
      </span>
    </>
  );

  if (!onClick) {
    return <div className="vm-summary-card" title={hint}>{body}</div>;
  }

  return (
    <button
      type="button"
      className="vm-summary-card"
      onClick={onClick}
      aria-pressed={active ? 'true' : 'false'}
      title={hint || `Filter the list by ${label}`}
    >
      {body}
    </button>
  );
};

const VendorSummaryCards = ({ onFilterStatus, activeStatus, refreshToken = 0 }) => {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await vendorApi.summary();
      setSummary(data.summary);
    } catch (err) {
      setError(err.message);
      reportError(err, 'Unable to load the vendor summary');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load, refreshToken]);

  if (loading) return <CardSkeleton count={6} />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!summary) return null;

  const byStatus = summary.byStatus || {};

  return (
    <div className="vm-summary-grid">
      <Card
        icon={FiUsers}
        color="#2563eb"
        value={summary.total}
        label="Total Vendors"
        onClick={() => onFilterStatus('')}
        active={!activeStatus}
      />
      <Card
        icon={FiCheckCircle}
        color="#10b981"
        value={byStatus.Active ?? 0}
        label="Active"
        onClick={() => onFilterStatus('Active')}
        active={activeStatus === 'Active'}
      />
      <Card
        icon={FiClock}
        color="#f59e0b"
        value={byStatus.Pending ?? 0}
        label="Pending"
        onClick={() => onFilterStatus('Pending')}
        active={activeStatus === 'Pending'}
      />
      <Card
        icon={FiSlash}
        color="#6b7280"
        value={byStatus.Inactive ?? 0}
        label="Inactive"
        onClick={() => onFilterStatus('Inactive')}
        active={activeStatus === 'Inactive'}
      />
      <Card
        icon={FiFileText}
        color="#dc2626"
        value={summary.vendorsWithExpiringDocuments}
        label="Expiring Documents (30d)"
        hint="Vendors with a document expiring within 30 days, or already expired"
      />
      <Card
        icon={FiUserPlus}
        color="#8b5cf6"
        value={summary.addedLast30Days}
        label="Added (last 30 days)"
      />
      <Card
        icon={FiAlertTriangle}
        color="#ea580c"
        value={summary.requiringReview}
        label="Requiring Review"
        hint="Pending vendors, plus active vendors that have never been evaluated"
      />
      {/* Rendered as "No data" until at least one evaluation exists. */}
      <Card
        icon={FiStar}
        color="#0ea5e9"
        value={summary.averageRating}
        label={summary.ratedVendors ? `Average Rating (${summary.ratedVendors} rated)` : 'Average Rating'}
        hint="Mean of recorded vendor evaluations"
      />
      <Card
        icon={FiTruck}
        color="#14b8a6"
        value={summary.averageLeadTimeDays === null ? null : `${summary.averageLeadTimeDays}d`}
        label="Average Lead Time"
        hint="Mean lead time across active vendor pricing records"
      />
    </div>
  );
};

export default VendorSummaryCards;
