import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Careers from './Careers';
const job = { _id:'abc', title:'E-commerce Executive', department:'E-commerce', location:'Delhi', employmentType:'Full-time', workMode:'Hybrid', experience:'2 years', description:'Manage online operations', responsibilities:'Listings', qualifications:'Degree', skills:'Commerce', deadline:'2026-11-30', createdAt:'2026-11-01' };
const renderPage = () => render(<MemoryRouter><Careers /></MemoryRouter>);
afterEach(() => vi.unstubAllGlobals());
describe('Careers page', () => {
  it('loads published jobs, filters them, and opens details', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ok:true,json:async()=>({jobs:[job],total:1})}));
    renderPage();
    const heading = await screen.findByRole('heading',{name:'E-commerce Executive'});
    const card = heading.closest('article');
    expect(within(card).getByText(/Manage online operations/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Careers Admin' })).toHaveAttribute('href', '/careers/admin');
    fireEvent.click(within(card).getByRole('button',{name:'View Details'}));
    expect(screen.getByRole('dialog',{name:'Job details'})).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button',{name:'Close'}));
    fireEvent.change(screen.getByLabelText('Search job title'),{target:{value:'unmatched'}});
    expect(screen.getByText(/No current openings/)).toBeInTheDocument();
  });
  it('shows scheduled jobs as opening soon and blocks early applications', async () => {
    const scheduled = {...job, opensAt:new Date(Date.now()+86400000).toISOString()};
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ok:true,json:async()=>({jobs:[scheduled],total:1})}));
    renderPage();
    expect(await screen.findByText('Opening soon')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button',{name:/Apply Now/}));
    expect(screen.getByRole('status')).toHaveTextContent(/Applications for E-commerce Executive open on/);
    expect(screen.queryByRole('dialog',{name:'Apply for job'})).not.toBeInTheDocument();
  });
  it('preselects a matching designation and submits the new fields in order', async () => {
    vi.stubGlobal('crypto', { randomUUID: () => '12345678-1234-1234-1234-123456789abc' });
    const matchingJob = { ...job, title: 'Telemarketing Executive' };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ jobs: [matchingJob], total: 1 }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ applicationId: 'application-1' }) });
    vi.stubGlobal('fetch', fetchMock);
    renderPage();
    const card = (await screen.findByRole('heading', { name: 'Telemarketing Executive' })).closest('article');
    fireEvent.click(within(card).getByRole('button', { name: /Apply Now/ }));

    const dialog = screen.getByRole('dialog', { name: 'Apply for job' });
    expect(within(dialog).getByLabelText(/Job Designation/)).toHaveValue('Telemarketing');
    expect(within(dialog).getByLabelText(/Highest Qualification/).tagName).toBe('SELECT');
    expect(within(dialog).getByLabelText(/Stream \/ Subject/).tagName).toBe('INPUT');
    const labels = [...dialog.querySelectorAll('form label')].map(label => label.firstChild.textContent);
    const position = text => labels.findIndex(label => label.startsWith(text));
    expect(position('Highest Qualification')).toBeLessThan(position('Stream / Subject'));
    expect(position('Total Work Experience') + 1).toBe(position('Key Responsibilities'));

    for (const [label, value] of [['Full Name', 'Test Applicant'], ['Email Address', 'test@example.com'], ['Phone Number', '9876543210'], ['Current Location', 'Delhi'], ['Stream / Subject', 'B.Com'], ['Total Work Experience', '2 years'], ['Notice Period', '30 days']]) {
      fireEvent.change(within(dialog).getByLabelText(new RegExp(label.replace('/', '\\/'))), { target: { value } });
    }
    fireEvent.change(within(dialog).getByLabelText(/Highest Qualification/), { target: { value: 'Graduate' } });
    fireEvent.change(within(dialog).getByLabelText(/Key Responsibilities/), { target: { value: 'Managed customer calls' } });
    expect(within(dialog).getByText('22/2000 characters')).toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText(/Resume Upload/), { target: { files: [new File(['%PDF-1.7'], 'resume.pdf', { type: 'application/pdf' })] } });
    fireEvent.click(within(dialog).getByRole('checkbox'));
    fireEvent.submit(dialog.querySelector('form'));

    expect(await screen.findByText(/Application submitted/)).toBeInTheDocument();
    const payload = fetchMock.mock.calls[1][1].body;
    expect(payload.get('jobDesignation')).toBe('Telemarketing');
    expect(payload.get('qualification')).toBe('Graduate');
    expect(payload.get('stream')).toBe('B.Com');
    expect(payload.get('keyResponsibilities')).toBe('Managed customer calls');
  });
  it('shows the empty state when there are no vacancies', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ok:true,json:async()=>({jobs:[],total:0})}));
    renderPage();
    expect(await screen.findByText('No current openings. Please check back later for future opportunities.')).toBeInTheDocument();
  });
});
