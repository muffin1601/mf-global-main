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
  it('shows the empty state when there are no vacancies', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ok:true,json:async()=>({jobs:[],total:0})}));
    renderPage();
    expect(await screen.findByText('No current openings. Please check back later for future opportunities.')).toBeInTheDocument();
  });
});
