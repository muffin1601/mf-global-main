// Behavioural tests for the create/edit vendor form: inline validation,
// duplicate handling, permission-gated banking, and masked-value round-tripping.

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../../../utils/vendorApi', () => ({
  vendorApi: {
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    checkDuplicates: vi.fn(),
  },
  vendorFiles: {},
  handleExpiredSession: vi.fn(() => false),
  VendorApiError: class extends Error {},
}));

vi.mock('react-toastify', () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
  ToastContainer: () => null,
}));

import VendorFormModal from './VendorFormModal';
import { vendorApi } from '../../../utils/vendorApi';

const META = {
  statuses: ['Active', 'Pending', 'Inactive', 'Suspended', 'Blacklisted'],
  priorities: ['Low', 'Medium', 'High', 'Critical'],
  types: ['Manufacturer', 'Trader'],
  addressTypes: [], contactTypes: [], documentTypes: [], activityTypes: [],
  paymentMethods: ['Bank Transfer', 'UPI'],
  currencies: ['INR', 'USD'],
  categories: [{ _id: 'c1', name: 'Raw Materials' }],
  owners: [{ _id: 'u1', name: 'Asha Rao' }],
  permissions: [],
};

const ADMIN_CAN = (p) => [
  'vendor.view', 'vendor.create', 'vendor.edit', 'vendor.view_bank', 'vendor.edit_bank',
].includes(p);

const STAFF_CAN = (p) => ['vendor.view', 'vendor.create', 'vendor.edit'].includes(p);

const renderForm = (props = {}) => render(
  <VendorFormModal
    vendor={null}
    meta={META}
    metaLoading={false}
    can={ADMIN_CAN}
    onClose={vi.fn()}
    onSaved={vi.fn()}
    {...props}
  />
);

beforeEach(() => {
  vendorApi.checkDuplicates.mockResolvedValue({ blocking: [], warnings: [] });
  vendorApi.create.mockResolvedValue({ vendor: { _id: 'v1', name: 'Acme Supplies', v_code: 'VA001' } });
  vendorApi.update.mockResolvedValue({ vendor: { _id: 'v1', name: 'Acme Supplies', v_code: 'VA001' } });
});

describe('VendorFormModal — creating', () => {
  it('renders as an accessible dialog with the expected sections', async () => {
    renderForm();
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByText('Add a new vendor')).toBeInTheDocument();
    expect(screen.getByText('Basic details')).toBeInTheDocument();
    expect(screen.getByText('Tax & registration')).toBeInTheDocument();
  });

  it('blocks submission and shows inline errors for invalid input', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText(/vendor name/i), 'A');
    await user.type(screen.getByLabelText(/^email/i), 'not-an-email');
    await user.click(screen.getByRole('button', { name: /create vendor/i }));

    expect(await screen.findByText(/Enter at least 2 characters/i)).toBeInTheDocument();
    expect(screen.getByText(/Enter a valid email address/i)).toBeInTheDocument();
    expect(vendorApi.create).not.toHaveBeenCalled();
  });

  it('submits a valid vendor and reports the generated code', async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    renderForm({ onSaved });

    await user.type(screen.getByLabelText(/vendor name/i), 'Acme Supplies');
    await user.click(screen.getByRole('button', { name: /create vendor/i }));

    await waitFor(() => expect(vendorApi.create).toHaveBeenCalled());
    expect(vendorApi.create.mock.calls[0][0].name).toBe('Acme Supplies');
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
  });

  it('splits the tags field into a list before sending', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText(/vendor name/i), 'Acme Supplies');
    await user.type(screen.getByLabelText(/^tags/i), 'steel, bulk , ,preferred');
    await user.click(screen.getByRole('button', { name: /create vendor/i }));

    await waitFor(() => expect(vendorApi.create).toHaveBeenCalled());
    expect(vendorApi.create.mock.calls[0][0].tags).toEqual(['steel', 'bulk', 'preferred']);
  });

  it('normalizes GSTIN and PAN to their canonical form', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText(/vendor name/i), 'Acme Supplies');
    await user.type(screen.getByLabelText(/^gstin/i), '27aapfu0939f1zv');
    await user.type(screen.getByLabelText(/^pan/i), 'aapfu0939f');
    await user.click(screen.getByRole('button', { name: /create vendor/i }));

    await waitFor(() => expect(vendorApi.create).toHaveBeenCalled());
    const payload = vendorApi.create.mock.calls[0][0];
    expect(payload.gstin).toBe('27AAPFU0939F1ZV');
    expect(payload.pan).toBe('AAPFU0939F');
  });
});

describe('VendorFormModal — duplicate handling', () => {
  it('warns about a similar vendor while typing, without blocking', async () => {
    const user = userEvent.setup();
    vendorApi.checkDuplicates.mockResolvedValue({
      blocking: [],
      warnings: [{ _id: 'v9', name: 'ABC Pvt Ltd', v_code: 'VA009', reason: 'Matches an existing vendor on vendor name' }],
    });

    renderForm();
    await user.type(screen.getByLabelText(/vendor name/i), 'abc pvt ltd');

    expect(await screen.findByText(/look similar/i)).toBeInTheDocument();
    expect(screen.getByText('ABC Pvt Ltd')).toBeInTheDocument();
    // A warning must not disable the submit button — the user decides.
    expect(screen.getByRole('button', { name: /create vendor/i })).toBeEnabled();
  });

  it('disables submission when the server reports a blocking GSTIN match', async () => {
    const user = userEvent.setup();
    vendorApi.checkDuplicates.mockResolvedValue({
      blocking: [{ _id: 'v9', name: 'Existing Ltd', v_code: 'VE001', reason: 'Matches an existing vendor on GSTIN' }],
      warnings: [],
    });

    renderForm();
    await user.type(screen.getByLabelText(/vendor name/i), 'Acme Supplies');

    expect(await screen.findByText(/cannot be saved/i)).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /create vendor/i })).toBeDisabled();
    });
  });

  it('offers "Save anyway" after the server asks for confirmation', async () => {
    const user = userEvent.setup();
    vendorApi.create.mockRejectedValueOnce(Object.assign(new Error('Possible duplicate.'), {
      status: 409,
      data: {
        requiresConfirmation: true,
        duplicates: [{ _id: 'v9', name: 'ABC Pvt Ltd', v_code: 'VA009', reason: 'Matches on vendor name' }],
      },
    }));

    renderForm();
    await user.type(screen.getByLabelText(/vendor name/i), 'ABC Pvt Ltd');
    await user.click(screen.getByRole('button', { name: /create vendor/i }));

    const saveAnyway = await screen.findByRole('button', { name: /save anyway/i });

    vendorApi.create.mockResolvedValueOnce({ vendor: { _id: 'v2', name: 'ABC Pvt Ltd', v_code: 'VA010' } });
    await user.click(saveAnyway);

    await waitFor(() => {
      const last = vendorApi.create.mock.calls.at(-1)[0];
      expect(last.confirmDuplicate).toBe(true);
    });
  });
});

describe('VendorFormModal — bank details and permissions', () => {
  it('shows the banking section to a user who may edit it', async () => {
    renderForm();
    expect(await screen.findByText('Bank & payment')).toBeInTheDocument();
    expect(screen.getByLabelText(/account number/i)).toBeInTheDocument();
  });

  it('hides the banking section from a user who may not', async () => {
    renderForm({ can: STAFF_CAN });
    expect(await screen.findByText(/managed by an administrator/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/account number/i)).not.toBeInTheDocument();
  });

  it('omits the bank block entirely from the payload when not permitted', async () => {
    const user = userEvent.setup();
    renderForm({ can: STAFF_CAN });

    await user.type(screen.getByLabelText(/vendor name/i), 'Acme Supplies');
    await user.click(screen.getByRole('button', { name: /create vendor/i }));

    await waitFor(() => expect(vendorApi.create).toHaveBeenCalled());
    expect(vendorApi.create.mock.calls[0][0].bank).toBeUndefined();
  });

  it('requires an IFSC alongside a newly entered account number', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText(/vendor name/i), 'Acme Supplies');
    await user.type(screen.getByLabelText(/account number/i), '123456789012');
    await user.click(screen.getByRole('button', { name: /create vendor/i }));

    expect(await screen.findByText(/IFSC is required/i)).toBeInTheDocument();
    expect(vendorApi.create).not.toHaveBeenCalled();
  });
});

describe('VendorFormModal — editing', () => {
  const existing = {
    _id: 'v1',
    name: 'Acme Supplies',
    v_code: 'VA001',
    updatedAt: '2026-02-01T10:00:00.000Z',
    industry: 'Metals',
    tags: ['steel'],
    category: { _id: 'c1', name: 'Raw Materials' },
    owner: { _id: 'u1', name: 'Asha Rao' },
    bank: { bankName: 'HDFC', ifsc: 'HDFC0001234', accountNumberMasked: '********9012', currency: 'INR' },
  };

  beforeEach(() => {
    vendorApi.get.mockResolvedValue({ vendor: existing, counts: {}, permissions: [] });
  });

  it('loads the full record rather than trusting the list projection', async () => {
    renderForm({ vendor: { _id: 'v1', name: 'Acme Supplies' } });
    await waitFor(() => expect(vendorApi.get).toHaveBeenCalledWith('v1'));
    expect(await screen.findByDisplayValue('Acme Supplies')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Metals')).toBeInTheDocument();
  });

  it('shows only the masked account number, never the real one', async () => {
    renderForm({ vendor: { _id: 'v1', name: 'Acme Supplies' } });
    const field = await screen.findByLabelText(/account number/i);
    expect(field).toHaveValue('********9012');
    expect(document.body.textContent).not.toContain('123456789012');
  });

  it('round-trips the mask unchanged so the stored number is preserved', async () => {
    const user = userEvent.setup();
    renderForm({ vendor: { _id: 'v1', name: 'Acme Supplies' } });
    await screen.findByDisplayValue('Acme Supplies');

    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => expect(vendorApi.update).toHaveBeenCalled());
    // The server treats a masked value as "leave it alone".
    expect(vendorApi.update.mock.calls[0][1].bank.accountNumber).toBe('********9012');
  });

  it('sends the loaded updatedAt as a concurrency token', async () => {
    const user = userEvent.setup();
    renderForm({ vendor: { _id: 'v1', name: 'Acme Supplies' } });
    await screen.findByDisplayValue('Acme Supplies');

    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => expect(vendorApi.update).toHaveBeenCalled());
    expect(vendorApi.update.mock.calls[0][1].updatedAt).toBe('2026-02-01T10:00:00.000Z');
  });

  it('surfaces a concurrent-edit conflict to the user', async () => {
    const user = userEvent.setup();
    vendorApi.update.mockRejectedValue(Object.assign(
      new Error('This vendor was changed by someone else. Reload and try again.'),
      { status: 409, data: {} }
    ));

    renderForm({ vendor: { _id: 'v1', name: 'Acme Supplies' } });
    await screen.findByDisplayValue('Acme Supplies');
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    expect(await screen.findByText(/changed by someone else/i)).toBeInTheDocument();
  });

  it('does not send status on edit — that is a separate audited action', async () => {
    const user = userEvent.setup();
    renderForm({ vendor: { _id: 'v1', name: 'Acme Supplies' } });
    await screen.findByDisplayValue('Acme Supplies');

    expect(screen.queryByLabelText(/^status/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /save changes/i }));
    await waitFor(() => expect(vendorApi.update).toHaveBeenCalled());
    expect(vendorApi.update.mock.calls[0][1].status).toBeUndefined();
  });
});
