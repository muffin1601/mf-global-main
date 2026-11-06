import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, BriefcaseBusiness, GraduationCap, Sparkles, UsersRound, Lightbulb, HeartHandshake } from 'lucide-react';
import Navbar from '../../components/main/Navbar';
import Footer from '../../components/main/Footer';
import useMarketingMeta from './useMarketingMeta';
import '../../styles/main/MarketingSite.css';
import './Careers.css';
import { RichTextDisplay } from './CareerRichText';

const base = `${(import.meta.env.VITE_API_URL || '/api').replace(/\/+$/, '')}/careers`;
const jobDesignations = ['Telemarketing', 'Telesales', 'Digital Marketing Sr. Executive', 'Account Executive', 'Content Writer', 'Graphics Designing', 'E-Commerce Sales Executive', 'Sales Executive', 'Sales Sr Executive', 'Sales Manager', 'Sales Support Coordinator'];
const qualifications = ['Diploma', '12th', 'Graduate', 'Post Graduate'];
const normalizeDesignation = value => String(value || '').toLowerCase().replace(/[.]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const designationForJob = title => {
  const normalized = normalizeDesignation(title);
  const aliases = { 'telemarketing executive': 'Telemarketing', 'telesales executive': 'Telesales' };
  return aliases[normalized] || jobDesignations.find(value => normalizeDesignation(value) === normalized) || '';
};
const empty = { fullName: '', email: '', phone: '', location: '', jobDesignation: '', qualification: '', stream: '', experience: '', keyResponsibilities: '', currentCompany: '', designation: '', expectedSalary: '', noticePeriod: '', coverLetter: '', comments: '', consent: false };
const date = value => value ? new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }) : '';
const openingSoon = job => job.opensAt && new Date(job.opensAt) > new Date();
const shortDate = value => new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });
const windowLabel = job => job.opensAt ? `${shortDate(job.opensAt)} \u2013 ${date(job.deadline)}` : `Until ${date(job.deadline)}`;
const benefits = [
  { icon: <GraduationCap />, title: 'Career growth', text: 'Take on meaningful responsibilities and build skills through hands-on experience.' },
  { icon: <Sparkles />, title: 'Professional development', text: 'Grow your expertise while contributing to work that matters to our customers.' },
  { icon: <UsersRound />, title: 'Collaborative environment', text: 'Work alongside teammates who value communication, respect, and shared goals.' },
  { icon: <Lightbulb />, title: 'Learning opportunities', text: 'Stay curious, exchange ideas, and keep learning as our work evolves.' },
  { icon: <HeartHandshake />, title: 'Innovation & excellence', text: 'Bring fresh thinking to the details that make great customer experiences.' },
];

export default function Careers() {
  useMarketingMeta('Careers | MF Global Services', 'Explore current opportunities and apply online.');
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState('');
  const [location, setLocation] = useState('');
  const [employmentType, setEmploymentType] = useState('');
  const [selected, setSelected] = useState(null);
  const [details, setDetails] = useState(null);
  const [form, setForm] = useState(empty);
  const [resume, setResume] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState('');
  const submissionKey = useRef('');
  useEffect(() => {
    let mounted = true;
    (async () => {
      const all = []; let page = 1; let pages = 1;
      while (page <= pages) {
        const response = await fetch(`${base}/jobs?limit=100&page=${page}`, { cache: 'no-store' });
        if (!response.ok) throw new Error('Unable to load vacancies.');
        const data = await response.json();
        all.push(...(data.jobs || [])); pages = data.pages || 0; page++;
      }
      if (mounted) setJobs(all.sort((a, b) => (a.displayOrder ?? 1000) - (b.displayOrder ?? 1000)));
    })().catch(err => { if (mounted) setError(err.message); }).finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);
  const filtered = jobs.filter(job => (!search || job.title.toLowerCase().includes(search.toLowerCase())) && (!department || job.department === department) && (!location || job.location === location) && (!employmentType || job.employmentType === employmentType));
  const openApplication = job => { setDetails(null); if (openingSoon(job)) { setNotice(`Applications for ${job.title} open on ${date(job.opensAt)}.`); document.getElementById('open-positions')?.scrollIntoView?.({ behavior: 'smooth' }); return; } setSelected(job); setNotice(''); setForm({ ...empty, jobDesignation: designationForJob(job.title) }); setResume(null); submissionKey.current = crypto.randomUUID(); };
  const submit = async event => {
    event.preventDefault();
    if (submitting || !selected) return;
    if (!resume || resume.size > 5 * 1024 * 1024 || !/\.(pdf|doc|docx)$/i.test(resume.name)) { setNotice('Attach a PDF, DOC, or DOCX resume of up to 5 MB.'); return; }
    const payload = new FormData();
    for (const [key, value] of Object.entries(form)) payload.append(key, String(value));
    payload.append('jobId', selected._id);
    payload.append('submissionKey', submissionKey.current);
    payload.append('resume', resume);
    setSubmitting(true); setNotice('');
    try {
      const response = await fetch(`${base}/apply`, { method: 'POST', body: payload });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Application failed.');
      setSelected(null); setNotice(`Application submitted. Your ID is ${result.applicationId}.`);
    } catch (err) { setNotice(err.message); }
    finally { setSubmitting(false); }
  };
  return <div className="marketing-site careers-page"><Navbar /><main>
    <section className="careers-hero" aria-labelledby="careers-title"><div className="careers-hero-image" role="img" aria-label="A welcoming workplace" /><div className="careers-hero-content"><p className="marketing-eyebrow">Make your next move</p><h1 id="careers-title">Build Your Career With Us</h1><p>Join our team and become part of an organization focused on innovation, growth, customer satisfaction, and excellence.</p><a className="marketing-button" href="#open-positions">Explore Open Positions <ArrowRight size={18} /></a></div><div className="careers-illustration" aria-hidden="true"><div className="illustration-topline"><span>GROW TOGETHER</span><Sparkles size={18} /></div><div className="illustration-people"><span className="illustration-person person-one"><UsersRound /></span><span className="illustration-person person-two"><Lightbulb /></span><span className="illustration-person person-three"><HeartHandshake /></span></div><div className="illustration-caption"><span className="illustration-caption-icon"><BriefcaseBusiness /></span><span><strong>Ideas become impact</strong><small>Bring your best to the team</small></span></div></div><div className="careers-hero-note"><BriefcaseBusiness /><span>New opportunities<br /><strong>Explore our openings</strong></span></div></section>
    <section className="careers-benefits marketing-section" aria-labelledby="benefits-title"><div className="marketing-section-heading"><p className="marketing-eyebrow">A place to grow</p><h2 id="benefits-title">Why work with us?</h2><p>Bring your perspective, build your capabilities, and do your best work with a team committed to moving forward together.</p></div><div className="benefit-grid">{benefits.map(benefit => <article className="benefit-card" key={benefit.title}><span className="benefit-icon">{benefit.icon}</span><h3>{benefit.title}</h3><p>{benefit.text}</p></article>)}</div></section>
    <section className="careers-openings marketing-section" id="open-positions"><div className="marketing-section-heading"><p className="marketing-eyebrow">Join our team</p><h2>Current job openings</h2><p>Explore the available opportunities and apply during the application window.</p></div>
      <div className="career-filters"><input aria-label="Search job title" placeholder="Search job title" value={search} onChange={e => setSearch(e.target.value)} /><select aria-label="Department" value={department} onChange={e => setDepartment(e.target.value)}><option value="">All departments</option>{[...new Set(jobs.map(j => j.department))].map(v => <option key={v}>{v}</option>)}</select><select aria-label="Location" value={location} onChange={e => setLocation(e.target.value)}><option value="">All locations</option>{[...new Set(jobs.map(j => j.location))].map(v => <option key={v}>{v}</option>)}</select><select aria-label="Employment type" value={employmentType} onChange={e => setEmploymentType(e.target.value)}><option value="">All types</option>{[...new Set(jobs.map(j => j.employmentType))].map(v => <option key={v}>{v}</option>)}</select></div>
      {loading ? <p>Loading openings…</p> : error ? <p role="alert">{error}</p> : filtered.length ? <div className="job-grid">{filtered.map(job => <article className="job-card" key={job._id}>
        <div className="job-card-topline"><span className={`job-badge${openingSoon(job) ? ' opening-soon' : ''}`}><span aria-hidden="true" /> {openingSoon(job) ? 'Opening soon' : 'Hiring'}</span><span className="job-type">{job.employmentType}</span></div>
        <h3>{job.title}</h3><p className="job-department">{job.department}</p>
        <div className="job-description"><RichTextDisplay value={job.description.slice(0, 220)} /></div>
        <div className="job-responsibilities"><h4>What you?ll do</h4><RichTextDisplay value={job.responsibilities} /></div>
        <div className="job-date"><span>Applications</span><strong>{windowLabel(job)}</strong></div>
        <div className="career-actions"><button type="button" onClick={() => setDetails(job)}>View Details</button><button className="marketing-button job-apply-button" type="button" onClick={() => openApplication(job)}>Apply Now <ArrowRight size={18} /></button></div>
      </article>)}</div> : <p>No current openings. Please check back later for future opportunities.</p>}
    </section>
    {notice && <p className="career-notice" role="status">{notice}</p>}
    {details && <div className="career-modal-backdrop" onClick={() => setDetails(null)}><div className="career-modal" role="dialog" aria-modal="true" aria-label="Job details" onClick={e => e.stopPropagation()}><button className="career-close" onClick={() => setDetails(null)} aria-label="Close">×</button><h2>{details.title}</h2><p>{details.department} · {details.location} · {details.employmentType} · {details.workMode}</p>{['description','responsibilities','qualifications','skills','benefits'].map(key => details[key] && <section key={key}><h3>{key[0].toUpperCase() + key.slice(1)}</h3><RichTextDisplay value={details[key]} /></section>)}<p>Apply by {date(details.deadline)}</p><button className="marketing-button" onClick={() => openApplication(details)}>Apply Now</button></div></div>}
    {selected && <div className="career-modal-backdrop" onClick={() => setSelected(null)}><div className="career-modal" role="dialog" aria-modal="true" aria-label="Apply for job" onClick={e => e.stopPropagation()}>
      <button className="career-close" onClick={() => setSelected(null)} aria-label="Close">&times;</button>
      <h2>Apply for {selected.title}</h2>
      <form onSubmit={submit} className="career-apply-form">
        {[
          ['fullName', 'Full Name', 'text', true],
          ['email', 'Email Address', 'email', true],
          ['phone', 'Phone Number', 'tel', true],
          ['location', 'Current Location', 'text', true],
        ].map(([key, label, type, required]) => <label key={key}>{label}{required && ' *'}<input type={type} required={required} maxLength={key === 'email' ? 254 : key === 'phone' ? 30 : 120} value={form[key]} onChange={e => setForm(current => ({ ...current, [key]: e.target.value }))} /></label>)}
        <label>Job Designation *<select required value={form.jobDesignation} onChange={e => setForm(current => ({ ...current, jobDesignation: e.target.value }))}><option value="">Select Job Designation</option>{jobDesignations.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
        <label>Highest Qualification *<select required value={form.qualification} onChange={e => setForm(current => ({ ...current, qualification: e.target.value }))}><option value="">Select Qualification</option>{qualifications.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
        <label>Stream / Subject<input type="text" maxLength={160} placeholder="e.g., 12th Commerce, B.A. English, BBA, B.Com, Diploma in IT" value={form.stream} onChange={e => setForm(current => ({ ...current, stream: e.target.value }))} /></label>
        <label>Total Work Experience *<input type="text" required maxLength={80} value={form.experience} onChange={e => setForm(current => ({ ...current, experience: e.target.value }))} /></label>
        <label>Key Responsibilities &ndash; Previous Company<textarea maxLength={2000} rows={5} placeholder="Describe your key responsibilities, daily tasks, and major duties in your previous company..." value={form.keyResponsibilities} onChange={e => setForm(current => ({ ...current, keyResponsibilities: e.target.value }))} /><span className="career-field-hint">Optional for freshers</span><span className="career-char-count" aria-live="polite">{form.keyResponsibilities.length}/2000 characters</span></label>
        {[
          ['currentCompany', 'Current Company'],
          ['designation', 'Current Designation'],
          ['expectedSalary', 'Expected Salary'],
          ['noticePeriod', 'Notice Period'],
        ].map(([key, label]) => <label key={key}>{label}{key === 'noticePeriod' && ' *'}<input type="text" required={key === 'noticePeriod'} maxLength={key === 'expectedSalary' || key === 'noticePeriod' ? 100 : 120} value={form[key]} onChange={e => setForm(current => ({ ...current, [key]: e.target.value }))} /></label>)}
        <label>Resume Upload (PDF, DOC, DOCX; up to 5 MB) *<input required type="file" accept=".pdf,.doc,.docx" onChange={e => setResume(e.target.files?.[0] || null)} /></label>
        <label>Cover Letter<textarea maxLength={3000} rows={4} value={form.coverLetter} onChange={e => setForm(current => ({ ...current, coverLetter: e.target.value }))} /></label>
        <label>Additional Comments<textarea maxLength={3000} rows={4} value={form.comments} onChange={e => setForm(current => ({ ...current, comments: e.target.value }))} /></label>
        <label className="career-consent"><input type="checkbox" required checked={form.consent} onChange={e => setForm(current => ({ ...current, consent: e.target.checked }))} /> I consent to the processing of my personal information for recruitment. *</label>
        {notice && <p role="alert">{notice}</p>}
        <button className="marketing-button" disabled={submitting}>{submitting ? 'Submitting\u2026' : 'Submit Application'}</button>
      </form>
    </div></div>}

  </main><Footer /></div>;
}
