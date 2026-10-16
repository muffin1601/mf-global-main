import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import axios from 'axios';
import AddClientModal from './AddClientModal';

vi.mock('axios', () => ({
  default: { get: vi.fn() },
}));

describe('quotation client picker', () => {
  beforeEach(() => {
    axios.get.mockResolvedValue({
      data: {
        data: [{
          _id: 'client-1',
          name: 'Ananya Sharma',
          company: 'North Star',
          contact: '01140000000',
          phone: '9876543210',
        }],
      },
    });
  });

  it('shows the client name and searches through the authenticated server endpoint', async () => {
    render(<AddClientModal isOpen onClose={vi.fn()} onSelect={vi.fn()} />);

    expect(await screen.findByText('Ananya Sharma')).toBeInTheDocument();
    expect(axios.get).toHaveBeenCalledWith(
      'http://test.local/api/overview/quotation-clients',
      expect.objectContaining({ params: { q: '', limit: 10 } })
    );

    fireEvent.change(screen.getByPlaceholderText(/client name/i), {
      target: { value: 'Ananya' },
    });
    await waitFor(() => expect(axios.get).toHaveBeenLastCalledWith(
      'http://test.local/api/overview/quotation-clients',
      expect.objectContaining({ params: { q: 'Ananya', limit: 10 } })
    ), { timeout: 1000 });
  });

  it('returns the complete selected client record', async () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    render(<AddClientModal isOpen onClose={onClose} onSelect={onSelect} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Select' }));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ name: 'Ananya Sharma' }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
