// Behavioural tests for the vendor list screen.
//
// The API client is mocked so these tests assert what the component *does* —
// which requests it issues, what it renders for each state, and which controls
// it exposes for a given permission set — without needing a live backend.

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../../utils/vendorApi', () => ({
  vendorApi: {
    meta: vi.fn(),
    summary: vi.fn(),
    list: vi.fn(),
    archive: vi.fn(),
    bulkStatus: vi.fn(),
  },
  vendorFiles: { exportCsv: vi.fn() },
  handleExpiredSession: vi.fn(() => false),
  VendorApiError: class extends Error {},
}));

vi.mock('react-toastify', () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
  ToastContainer: () => null,
}));

import VendorList from './VendorList';
import { vendorApi } from '../../../utils/vendorApi';

const ADMIN_PERMISSIONS = [
  'vendor.view', 'vendor.create', 'vendor.edit', 'vendor.archive', 'vendor.delete',
  'vendor.export', 'vendor.import', 'vendor.documents', 'vendor.performance',
  'vendor.manage_categories', 'vendor.view_bank', 'vendor.edit_bank',
];

const STAFF_PERMISSIONS = ['vendor.view', 'vendor.create', 'vendor.edit', 'vendor.export', 'vendor.documents'];

const metaResponse = (permissions = ADMIN_PERMISSIONS) => ({
  statuses: ['Active', 'Pending', 'Inactive', 'Suspended', 'Blacklisted'],
  priorities: ['Low', 'Medium', 'High', 'Critical'],
  types: ['Manufacturer', 'Trader'],
  addressTypes: [], contactTypes: [], documentTypes: [], activityTypes: [],
  paymentMethods: [], currencies: ['INR'],
  categories: [{ _id: 'c1', name: 'Raw Materials' }],
  owners: [{ _id: 'u1', name: 'Asha Rao' }],
  permissions,
});

const summaryResponse = (overrides = {}) => ({
  summary: {
    total: 2,
    archived: 0,
    byStatus: { Active: 1, Pending: 1, Inactive: 0, Suspended: 0, Blacklisted: 0 },
    addedLast30Days: 2,
    vendorsWithExpiringDocuments: 0,
    requiringReview: 1,
    averageRating: null,
    ratedVendors: 0,
    averageLeadTimeDays: null,
    topRated: [],
    ...overrides,
  },
});

const vendorRow = (overrides = {}) => ({
  _id: 'v1',
  v_code: 'VA001',
  name: 'Alpha Steel Works',
  status: 'Active',
  category: { _id: 'c1', name: 'Raw Materials' },
  owner: { _id: 'u1', name: 'Asha Rao' },
  primaryContact: { fullName: 'Asha Rao', email: 'a@t.test', phone: '9811111111' },
  productCount: 3,
  performance: { overallScore: null },
  performanceBand: 'No data',
  isArchived: false,
  createdAt: '2026-01-05T00:00:00.000Z',
  ...overrides,
});

const listResponse = (vendors = [vendorRow()], overrides = {}) => ({
  vendors, total: vendors.length, page: 1, pages: 1, limit: 25, ...overrides,
});

const renderList = (props = {}) => render(
  <MemoryRouter>
    <VendorList {...props} />
  </MemoryRouter>
);

beforeEach(() => {
  localStorage.setItem('user', JSON.stringify({ _id: 'u1', name: 'Admin', role: 'admin' }));
  vendorApi.meta.mockResolvedValue(metaResponse());
  vendorApi.summary.mockResolvedValue(summaryResponse());
  vendorApi.list.mockResolvedValue(listResponse());
});

describe('VendorList — loading and data', () => {
  it('shows a skeleton while loading, then the vendor rows', async () => {
    let resolveList;
    vendorApi.list.mockReturnValue(new Promise((resolve) => { resolveList = resolve; }));

    renderList();
    expect(document.querySelector('[aria-busy="true"]')).toBeTruthy();

    resolveList(listResponse());
    expect(await screen.findByText('Alpha Steel Works')).toBeInTheDocument();
    expect(screen.getByText('VA001')).toBeInTheDocument();
  });

  it('renders "No data" rather than a fabricated rating in the summary', async () => {
    renderList();
    // averageRating is null, so the card must not show a number.
    await waitFor(() => expect(screen.getAllByText('No data').length).toBeGreaterThan(0));
  });

  it('requests only one page from the server, never the whole collection', async () => {
    renderList();
    await waitFor(() => expect(vendorApi.list).toHaveBeenCalled());
    const query = vendorApi.list.mock.calls[0][0];
    expect(query.page).toBe(1);
    expect(query.limit).toBe(25);
  });
});

describe('VendorList — empty and error states', () => {
  it('invites the user to add their first vendor when there are none', async () => {
    vendorApi.list.mockResolvedValue(listResponse([], { total: 0 }));
    renderList();

    expect(await screen.findByText('No vendors found')).toBeInTheDocument();
    expect(screen.getByText(/Add your first vendor/i)).toBeInTheDocument();
  });

  it('distinguishes "no results for these filters" from "no vendors at all"', async () => {
    const user = userEvent.setup();
    renderList();
    await screen.findByText('Alpha Steel Works');

    vendorApi.list.mockResolvedValue(listResponse([], { total: 0 }));
    await user.type(screen.getByLabelText(/search vendors/i), 'zzzz');

    expect(await screen.findByText(/No vendors match your current filters/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /clear filters/i })).toBeInTheDocument();
  });

  it('shows a recoverable error state, not a blank screen', async () => {
    vendorApi.list.mockRejectedValue(Object.assign(new Error('Cannot reach the server.'), { status: 0 }));
    renderList();

    expect(await screen.findByText(/Unable to load this information/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('retries the request when the user clicks Try again', async () => {
    const user = userEvent.setup();
    vendorApi.list.mockRejectedValueOnce(Object.assign(new Error('boom'), { status: 500 }));
    renderList();

    await screen.findByRole('button', { name: /try again/i });
    vendorApi.list.mockResolvedValue(listResponse());
    await user.click(screen.getByRole('button', { name: /try again/i }));

    expect(await screen.findByText('Alpha Steel Works')).toBeInTheDocument();
  });
});

describe('VendorList — search and filters', () => {
  it('debounces the search box into a single server request', async () => {
    const user = userEvent.setup();
    renderList();
    await screen.findByText('Alpha Steel Works');

    const initialCalls = vendorApi.list.mock.calls.length;
    await user.type(screen.getByLabelText(/search vendors/i), 'alpha');

    await waitFor(() => {
      const searched = vendorApi.list.mock.calls.slice(initialCalls)
        .filter(([q]) => q.search === 'alpha');
      expect(searched.length).toBe(1);
    });
  });

  it('sends the chosen status filter to the server and shows a removable chip', async () => {
    const user = userEvent.setup();
    renderList();
    await screen.findByText('Alpha Steel Works');

    await user.click(screen.getByRole('button', { name: /filters/i }));
    await user.selectOptions(screen.getByLabelText('Status'), 'Pending');

    await waitFor(() => {
      expect(vendorApi.list).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'Pending' }),
        expect.anything()
      );
    });

    const chip = await screen.findByText('Status: Pending');
    expect(chip).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /remove filter status: pending/i }));
    await waitFor(() => {
      expect(vendorApi.list).toHaveBeenLastCalledWith(
        expect.objectContaining({ status: '' }),
        expect.anything()
      );
    });
  });

  it('applies the route preset as the initial status filter', async () => {
    renderList({ preset: 'pending' });
    await waitFor(() => {
      expect(vendorApi.list).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'Pending' }),
        expect.anything()
      );
    });
    expect(screen.getByRole('heading', { name: 'Pending Vendors' })).toBeInTheDocument();
  });

  it('toggles the sort direction and asks the server to re-sort', async () => {
    const user = userEvent.setup();
    renderList();
    await screen.findByText('Alpha Steel Works');

    await user.click(screen.getByRole('button', { name: /^Vendor$/ }));

    await waitFor(() => {
      expect(vendorApi.list).toHaveBeenLastCalledWith(
        expect.objectContaining({ sortBy: 'name', sortDir: 'desc' }),
        expect.anything()
      );
    });
  });
});

describe('VendorList — permissions', () => {
  it('offers create, import, export and archive to an administrator', async () => {
    renderList();
    await screen.findByText('Alpha Steel Works');

    expect(screen.getByRole('button', { name: /add vendor/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^import$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^export$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /archive alpha steel works/i })).toBeInTheDocument();
  });

  it('hides import and archive from a user without those permissions', async () => {
    vendorApi.meta.mockResolvedValue(metaResponse(STAFF_PERMISSIONS));
    renderList();
    await screen.findByText('Alpha Steel Works');

    expect(screen.getByRole('button', { name: /add vendor/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^export$/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^import$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /archive alpha steel works/i })).not.toBeInTheDocument();
  });

  it('only offers permanent deletion for an archived vendor', async () => {
    vendorApi.list.mockResolvedValue(listResponse([vendorRow({ isArchived: false })]));
    const { unmount } = renderList();
    await screen.findByText('Alpha Steel Works');
    expect(screen.queryByRole('button', { name: /delete .* permanently/i })).not.toBeInTheDocument();
    unmount();

    vendorApi.list.mockResolvedValue(listResponse([vendorRow({ isArchived: true })]));
    renderList();
    await screen.findByText('Alpha Steel Works');
    expect(screen.getByRole('button', { name: /delete .* permanently/i })).toBeInTheDocument();
  });
});

describe('VendorList — destructive actions', () => {
  it('requires confirmation before archiving, and names the vendor', async () => {
    const user = userEvent.setup();
    vendorApi.archive.mockResolvedValue({ success: true });
    renderList();
    await screen.findByText('Alpha Steel Works');

    await user.click(screen.getByRole('button', { name: /archive alpha steel works/i }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/Archive this vendor\?/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/Alpha Steel Works/)).toBeInTheDocument();
    expect(vendorApi.archive).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole('button', { name: /archive vendor/i }));
    await waitFor(() => expect(vendorApi.archive).toHaveBeenCalledWith('v1'));
  });

  it('cancels without calling the API', async () => {
    const user = userEvent.setup();
    renderList();
    await screen.findByText('Alpha Steel Works');

    await user.click(screen.getByRole('button', { name: /archive alpha steel works/i }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /^cancel$/i }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(vendorApi.archive).not.toHaveBeenCalled();
  });

  it('demands the vendor code before permanent deletion is enabled', async () => {
    const user = userEvent.setup();
    vendorApi.list.mockResolvedValue(listResponse([vendorRow({ isArchived: true })]));
    renderList();
    await screen.findByText('Alpha Steel Works');

    await user.click(screen.getByRole('button', { name: /delete .* permanently/i }));
    const dialog = await screen.findByRole('dialog');

    const confirmButton = within(dialog).getByRole('button', { name: /delete permanently/i });
    expect(confirmButton).toBeDisabled();

    await user.type(within(dialog).getByLabelText(/type .* to confirm/i), 'VA001');
    expect(confirmButton).toBeEnabled();
  });
});

describe('VendorList — bulk selection', () => {
  it('reveals bulk actions once rows are selected and applies a status change', async () => {
    const user = userEvent.setup();
    vendorApi.bulkStatus.mockResolvedValue({ updated: 1 });
    renderList();
    await screen.findByText('Alpha Steel Works');

    await user.click(screen.getByLabelText('Select Alpha Steel Works'));
    expect(await screen.findByText('1 selected')).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText(/set status for selected vendors/i), 'Inactive');
    await user.click(screen.getByRole('button', { name: /^apply$/i }));

    await waitFor(() => expect(vendorApi.bulkStatus).toHaveBeenCalledWith(['v1'], 'Inactive'));
  });

  it('clears the selection when the filters change', async () => {
    const user = userEvent.setup();
    renderList();
    await screen.findByText('Alpha Steel Works');

    await user.click(screen.getByLabelText('Select Alpha Steel Works'));
    expect(await screen.findByText('1 selected')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /filters/i }));
    await user.selectOptions(screen.getByLabelText('Status'), 'Active');

    await waitFor(() => expect(screen.queryByText('1 selected')).not.toBeInTheDocument());
  });
});

describe('VendorList — responsive markup', () => {
  it('labels every cell so the table can collapse into cards on small screens', async () => {
    renderList();
    await screen.findByText('Alpha Steel Works');

    // The mobile layout renders td::before from data-label; without it the
    // stacked card view would lose its column headings.
    const cells = document.querySelectorAll('.vm-table tbody td');
    expect(cells.length).toBeGreaterThan(0);
    cells.forEach((cell) => {
      expect(cell.getAttribute('data-label')).not.toBeNull();
    });
  });
});
