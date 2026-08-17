// Vendor Settings — module configuration and reference.
//
// Everything shown here is real: the permissions table is the caller's actual
// effective permissions as reported by the server, and the counts come from the
// live category list. Category editing lives on its own page; this screen links
// to it rather than duplicating the editor.

import React from 'react';
import { Link } from 'react-router-dom';
import { FiCheck, FiX, FiDownload, FiExternalLink } from 'react-icons/fi';

import { vendorFiles } from '../../../utils/vendorApi';
import { useVendorMeta } from './useVendorMeta';
import {
  Alert, ErrorState, TableSkeleton, reportError,
} from './VendorUI';
import '../../../styles/crm/Vendor.css';

// Every capability the module defines, with a plain-language description.
const PERMISSIONS = [
  ['vendor.view', 'View vendors, contacts, documents and history'],
  ['vendor.create', 'Create new vendors'],
  ['vendor.edit', 'Edit vendor details, contacts, addresses, pricing and notes'],
  ['vendor.archive', 'Archive and restore vendors, and blacklist them'],
  ['vendor.delete', 'Permanently delete an archived vendor'],
  ['vendor.export', 'Export the vendor list to CSV'],
  ['vendor.import', 'Import vendors from a CSV file'],
  ['vendor.documents', 'Upload, replace and delete vendor documents'],
  ['vendor.performance', 'Record and remove performance evaluations'],
  ['vendor.manage_categories', 'Create, edit and delete vendor categories'],
  ['vendor.view_bank', 'View masked bank and payment details'],
  ['vendor.edit_bank', 'Edit bank and payment details'],
];

const VendorSettings = () => {
  const { meta, loading, error, reload, can } = useVendorMeta();

  const downloadTemplate = async () => {
    try {
      await vendorFiles.importTemplate();
    } catch (err) {
      reportError(err, 'Could not download the template');
    }
  };

  if (error) {
    return (
      <div className="vm-module">
        <section className="vm-card"><ErrorState message={error} onRetry={reload} /></section>
      </div>
    );
  }

  const activeCategories = meta.categories.length;

  return (
    <div className="vm-module">
      {/* --------------------------- Permissions --------------------------- */}
      <section className="vm-card">
        <div className="vm-card-header">
          <div>
            <h2>Your vendor permissions</h2>
            <p className="vm-card-subtitle">
              What your account can do in Vendor Management. These are enforced by the
              server on every request — hidden buttons are a convenience, not the control.
            </p>
          </div>
        </div>

        {loading ? <TableSkeleton rows={6} columns={3} /> : (
          <div className="vm-table-wrapper">
            <table className="vm-table">
              <caption className="vm-sr-only">Effective vendor permissions for the signed-in user</caption>
              <thead>
                <tr>
                  <th scope="col">Permission</th>
                  <th scope="col">What it allows</th>
                  <th scope="col">You have it</th>
                </tr>
              </thead>
              <tbody>
                {PERMISSIONS.map(([key, description]) => (
                  <tr key={key}>
                    <td data-label="Permission"><code className="vm-cell-primary">{key}</code></td>
                    <td data-label="Allows" className="vm-cell-muted">{description}</td>
                    <td data-label="Granted">
                      {can(key) ? (
                        <span className="vm-badge vm-status-active">
                          <FiCheck aria-hidden="true" style={{ verticalAlign: '-2px' }} /> Yes
                        </span>
                      ) : (
                        <span className="vm-badge vm-status-inactive">
                          <FiX aria-hidden="true" style={{ verticalAlign: '-2px' }} /> No
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="vm-hint" style={{ marginTop: '1rem' }}>
          Vendor permissions follow your CRM role. To change what someone can do,
          change their role in User Management.
        </p>
      </section>

      {/* ---------------------------- Categories ---------------------------- */}
      <section className="vm-card">
        <div className="vm-card-header">
          <div>
            <h2>Categories</h2>
            <p className="vm-card-subtitle">
              {loading
                ? 'Loading…'
                : `${activeCategories} active categor${activeCategories === 1 ? 'y' : 'ies'} available when creating a vendor`}
            </p>
          </div>
          <Link to="/crm/vendors/categories" className="vm-btn vm-btn-primary">
            Manage categories <FiExternalLink aria-hidden="true" />
          </Link>
        </div>

        {!loading && activeCategories === 0 && (
          <Alert type="warning">
            No active vendor categories are configured, so vendors cannot be categorised yet.
            Add the categories your business uses — for example Raw Materials, Packaging,
            Logistics or Services.
          </Alert>
        )}

        {!loading && activeCategories > 0 && (
          <div>
            {meta.categories.map((category) => (
              <span className="vm-tag" key={category._id}>{category.name}</span>
            ))}
          </div>
        )}
      </section>

      {/* ------------------------------ Import ------------------------------ */}
      {can('vendor.import') && (
        <section className="vm-card">
          <div className="vm-card-header">
            <div>
              <h2>Data import</h2>
              <p className="vm-card-subtitle">
                Start from the template to make sure your columns match what the importer expects.
                Only a vendor name is required.
              </p>
            </div>
            <button type="button" className="vm-btn vm-btn-ghost" onClick={downloadTemplate}>
              <FiDownload aria-hidden="true" /> Download CSV template
            </button>
          </div>

          <Alert type="info">
            Imports are reviewed before anything is saved: you map the columns, see a
            row-by-row validation result, and confirm. Duplicates are detected on vendor
            name, GSTIN, PAN, email and phone — ignoring case, spacing and punctuation.
          </Alert>
        </section>
      )}

      {/* -------------------------- Workflow values -------------------------- */}
      <section className="vm-card">
        <div className="vm-card-header">
          <div>
            <h2>Workflow values</h2>
            <p className="vm-card-subtitle">
              Fixed lists used across the module. Categories are configurable; these are not,
              because reporting and permissions depend on them.
            </p>
          </div>
        </div>

        {loading ? <TableSkeleton rows={4} columns={2} /> : (
          <dl className="vm-detail-grid">
            {[
              ['Statuses', meta.statuses],
              ['Priorities', meta.priorities],
              ['Vendor types', meta.types],
              ['Address types', meta.addressTypes],
              ['Contact types', meta.contactTypes],
              ['Document types', meta.documentTypes],
              ['Activity types', meta.activityTypes],
              ['Payment methods', meta.paymentMethods],
              ['Currencies', meta.currencies],
            ].map(([label, values]) => (
              <div className="vm-detail" key={label}>
                <dt>{label}</dt>
                <dd>{values.map((value) => <span className="vm-tag" key={value}>{value}</span>)}</dd>
              </div>
            ))}
          </dl>
        )}
      </section>
    </div>
  );
};

export default VendorSettings;
