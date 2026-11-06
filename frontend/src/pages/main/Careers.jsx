import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, BriefcaseBusiness, CalendarDays, GraduationCap, MapPin, Search, UsersRound, Lightbulb } from 'lucide-react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Autoplay, Pagination } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/pagination';
import Navbar from '../../components/main/Navbar';
import Footer from '../../components/main/Footer';
import useMarketingMeta from './useMarketingMeta';
import '../../styles/main/MarketingSite.css';
import './Careers.css';
import { RichTextDisplay } from './CareerRichText';

const base = `${(import.meta.env.VITE_API_URL || '/api').replace(/\/+$/, '')}/careers`;
const jobDesignations = ['Telemarketing', 'Telesales', 'Digital Marketing Sr. Executive', 'Account Executive', 'Content Writer', 'Graphics Designing', 'E-Commerce Sales Executive', 'Sales Executive', 'Sales Sr Executive', 'Sales Manager', 'Sales Support Coordinator'];
const qualifications = ['Diploma', '12th', 'Graduate', 'Post Graduate'];
const careerBanners = [
  { src: '/career-banner.jpeg', alt: 'We are hiring. Join our team.' },
  { src: '/banner-2%20(1).jpeg', alt: 'Careers at MF Global Services. Be part of a growing team.' },
  { src: '/banner-2%20(2).jpeg', alt: 'Build, learn, and grow with our team.' },
];
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
  { icon: <GraduationCap />, title: 'Grow through real work', text: 'Build your skills by taking ownership of work that contributes to customer and business outcomes.' },
  { icon: <UsersRound />, title: 'Work together', text: 'Share ideas, communicate openly, and learn from teammates across our services and operations.' },
  { icon: <Lightbulb />, title: 'Keep learning', text: 'Develop new capabilities as you solve practical challenges and explore better ways of working.' },
];

export default function Careers() {
  useMarketingMeta('Careers | MF Global Services', 'Explore current opportunities and apply online.');
  const reduceMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
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
    <section className="careers-banner" aria-label="Careers banners"><Swiper modules={[Autoplay, Pagination]} slidesPerView={1} loop speed={900} autoplay={reduceMotion ? false : { delay: 3000, reverseDirection: true, disableOnInteraction: false }} pagination={{ clickable: true }} className="careers-banner-slider">{careerBanners.map((banner, index) => <SwiperSlide key={banner.src}><a className="careers-banner-slide" href="#open-positions" aria-label={`Explore current openings: banner ${index + 1}`}><img src={banner.src} alt={banner.alt} fetchPriority={index === 0 ? 'high' : undefined} loading={index === 0 ? 'eager' : 'lazy'} /></a></SwiperSlide>)}</Swiper></section>
    <section className="careers-intro marketing-section" aria-labelledby="careers-title"><div className="careers-intro-copy"><p className="marketing-eyebrow">Careers at MF Global Services</p><h1 id="careers-title">Your work can make a difference here.</h1><p className="careers-intro-lead">Join a team where customer relationships, thoughtful service, and practical ideas come together.</p><p>From connecting with customers to supporting e-commerce operations, our roles offer opportunities to contribute, collaborate, and grow. Find the position that fits your strengths and take the next step with us.</p><a className="marketing-button" href="#open-positions">See open roles <ArrowRight size={18} /></a></div><aside className="careers-intro-aside"><span>WORK WITH US</span><strong>Find your place on our team.</strong><p>Explore opportunities across the areas where we serve our customers every day.</p><div className="careers-intro-areas"><span>Sales &amp; marketing</span><span>E-commerce</span><span>Customer experience</span></div></aside></section>
    <section className="careers-benefits marketing-section" aria-labelledby="benefits-title"><div className="careers-section-heading"><div><p className="marketing-eyebrow">Life at MF Global Services</p><h2 id="benefits-title">A place to do meaningful work</h2></div><p>We value people who care about their work, support their teammates, and want to keep improving.</p></div><div className="benefit-grid">{benefits.map(benefit => <article className="benefit-card" key={benefit.title}><span className="benefit-icon">{benefit.icon}</span><h3>{benefit.title}</h3><p>{benefit.text}</p></article>)}</div></section>
    <section className="careers-openings marketing-section" id="open-positions" aria-labelledby="openings-title"><div className="careers-section-heading careers-openings-heading"><div><p className="marketing-eyebrow">Opportunities</p><h2 id="openings-title">Explore open roles</h2><p>Find a position that matches your skills and interests.</p></div><span className="careers-openings-count">{loading ? 'Loading roles' : `${filtered.length} ${filtered.length === 1 ? 'role' : 'roles'} available`}</span></div>
      <div className="career-filters"><label className="career-search-field"><Search size={18} aria-hidden="true" /><input aria-label="Search job title" placeholder="Search by job title" value={search} onChange={e => setSearch(e.target.value)} /></label><select aria-label="Department" value={department} onChange={e => setDepartment(e.target.value)}><option value="">All departments</option>{[...new Set(jobs.map(j => j.department))].map(v => <option key={v}>{v}</option>)}</select><select aria-label="Location" value={location} onChange={e => setLocation(e.target.value)}><option value="">All locations</option>{[...new Set(jobs.map(j => j.location))].map(v => <option key={v}>{v}</option>)}</select><select aria-label="Employment type" value={employmentType} onChange={e => setEmploymentType(e.target.value)}><option value="">All types</option>{[...new Set(jobs.map(j => j.employmentType))].map(v => <option key={v}>{v}</option>)}</select></div>
      {loading ? <p className="careers-list-state">Loading openings…</p> : error ? <p className="careers-list-state" role="alert">{error}</p> : filtered.length ? <div className="job-grid">{filtered.map(job => <article className="job-card" key={job._id}>
        <div className="job-card-topline"><span className="career-role-icon"><BriefcaseBusiness size={21} aria-hidden="true" /></span><span className={`job-badge${openingSoon(job) ? ' opening-soon' : ''}`}><span aria-hidden="true" /> {openingSoon(job) ? 'Opening soon' : 'Hiring'}</span></div>
        <p className="job-department">{job.department}</p><h3>{job.title}</h3>
        <div className="career-role-meta"><span><MapPin size={15} aria-hidden="true" />{job.location}</span><span><BriefcaseBusiness size={15} aria-hidden="true" />{job.employmentType}</span></div>
        <div className="job-description"><RichTextDisplay value={job.description.slice(0, 220)} /></div>
        <div className="job-date"><CalendarDays size={16} aria-hidden="true" /><span>Applications</span><strong>{windowLabel(job)}</strong></div>
        <div className="career-actions"><button type="button" onClick={() => setDetails(job)}>View Details</button><button className="marketing-button job-apply-button" type="button" onClick={() => openApplication(job)}>Apply Now <ArrowRight size={18} /></button></div>
      </article>)}</div> : <p className="careers-list-state">No current openings. Please check back later for future opportunities.</p>}
    </section>
    {notice && <p className="career-notice" role="status">{notice}</p>}
    {details && <div className="career-modal-backdrop" onClick={() => setDetails(null)}><div className="career-modal" role="dialog" aria-modal="true" aria-label="Job details" onClick={e => e.stopPropagation()}><button className="career-close" onClick={() => setDetails(null)} aria-label="Close">×</button><h2>{details.title}</h2><p>{details.department} · {details.location} · {details.employmentType} · {details.workMode}</p>{['description','responsibilities','qualifications','skills','benefits'].map(key => details[key] && <section key={key}><h3>{key[0].toUpperCase() + key.slice(1)}</h3><RichTextDisplay value={details[key]} /></section>)}<p>Apply by {date(details.deadline)}</p><button className="marketing-button" onClick={() => openApplication(details)}>Apply Now</button></div></div>}
    {selected && <div className="career-modal-backdrop" onClick={() => setSelected(null)}><div className="career-modal career-application-modal" role="dialog" aria-modal="true" aria-label="Apply for job" onClick={e => e.stopPropagation()}>
      <div className="career-application-header">
        <div><p className="career-application-eyebrow">Join our team</p><h2>Apply for {selected.title}</h2><p className="career-application-meta">{selected.department} <span aria-hidden="true">&bull;</span> {selected.location} <span aria-hidden="true">&bull;</span> {selected.employmentType}</p></div>
        <button type="button" className="career-application-close" onClick={() => setSelected(null)} aria-label="Close application form">&times;</button>
      </div>
      <form onSubmit={submit} className="career-apply-form">
        <div className="career-application-intro"><strong>Tell us about yourself</strong><span>Fields marked * are required.</span></div>
        <section className="career-form-section"><div className="career-form-section-heading"><span>01</span><div><h3>Personal details</h3><p>How we can reach you</p></div></div><div className="career-form-grid">
          {[
            ['fullName', 'Full Name', 'text', true, 'Your full name'],
            ['email', 'Email Address', 'email', true, 'you@example.com'],
            ['phone', 'Phone Number', 'tel', true, 'Your contact number'],
            ['location', 'Current Location', 'text', true, 'City, State'],
          ].map(([key, label, type, required, placeholder]) => <label key={key}>{label}{required && ' *'}<input type={type} required={required} placeholder={placeholder} maxLength={key === 'email' ? 254 : key === 'phone' ? 30 : 120} value={form[key]} onChange={e => setForm(current => ({ ...current, [key]: e.target.value }))} /></label>)}
        </div></section>
        <section className="career-form-section"><div className="career-form-section-heading"><span>02</span><div><h3>Education &amp; experience</h3><p>Your background and strengths</p></div></div><div className="career-form-grid">
          <label>Job Designation *<select required value={form.jobDesignation} onChange={e => setForm(current => ({ ...current, jobDesignation: e.target.value }))}><option value="">Select Job Designation</option>{jobDesignations.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
          <label>Highest Qualification *<select required value={form.qualification} onChange={e => setForm(current => ({ ...current, qualification: e.target.value }))}><option value="">Select Qualification</option>{qualifications.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
          <label>Stream / Subject<input type="text" maxLength={160} placeholder="e.g., 12th Commerce, B.A. English, BBA, B.Com, Diploma in IT" value={form.stream} onChange={e => setForm(current => ({ ...current, stream: e.target.value }))} /></label>
          <label>Total Work Experience *<input type="text" required maxLength={80} placeholder="e.g., Fresher or 2 years" value={form.experience} onChange={e => setForm(current => ({ ...current, experience: e.target.value }))} /></label>
          <label className="career-wide-field">Key Responsibilities &ndash; Previous Company<textarea maxLength={2000} rows={4} placeholder="Describe your key responsibilities, daily tasks, and major duties in your previous company..." value={form.keyResponsibilities} onChange={e => setForm(current => ({ ...current, keyResponsibilities: e.target.value }))} /><span className="career-field-meta"><span>Optional for freshers</span><span aria-live="polite">{form.keyResponsibilities.length}/2000 characters</span></span></label>
        </div></section>
        <section className="career-form-section"><div className="career-form-section-heading"><span>03</span><div><h3>Current role &amp; availability</h3><p>A few details to plan the next step</p></div></div><div className="career-form-grid">
          {[
            ['currentCompany', 'Current Company', 'Company name'],
            ['designation', 'Current Designation', 'Your current role'],
            ['expectedSalary', 'Expected Salary', 'Your expected salary'],
            ['noticePeriod', 'Notice Period', 'e.g., Immediate or 30 days'],
          ].map(([key, label, placeholder]) => <label key={key}>{label}{key === 'noticePeriod' && ' *'}<input type="text" required={key === 'noticePeriod'} placeholder={placeholder} maxLength={key === 'expectedSalary' || key === 'noticePeriod' ? 100 : 120} value={form[key]} onChange={e => setForm(current => ({ ...current, [key]: e.target.value }))} /></label>)}
        </div></section>
        <section className="career-form-section"><div className="career-form-section-heading"><span>04</span><div><h3>Resume &amp; message</h3><p>Share your work and anything else we should know</p></div></div><div className="career-form-grid">
          <label className="career-wide-field career-resume-field">Resume Upload *<span className="career-upload-box"><input required type="file" accept=".pdf,.doc,.docx" onChange={e => setResume(e.target.files?.[0] || null)} /><span>PDF, DOC, or DOCX &bull; up to 5 MB</span>{resume && <strong>{resume.name}</strong>}</span></label>
          <label className="career-wide-field">Cover Letter<textarea maxLength={3000} rows={4} placeholder="Tell us why this role interests you" value={form.coverLetter} onChange={e => setForm(current => ({ ...current, coverLetter: e.target.value }))} /></label>
          <label className="career-wide-field">Additional Comments<textarea maxLength={3000} rows={3} placeholder="Anything else you would like to share?" value={form.comments} onChange={e => setForm(current => ({ ...current, comments: e.target.value }))} /></label>
        </div></section>
        <div className="career-application-footer"><label className="career-consent"><input type="checkbox" required checked={form.consent} onChange={e => setForm(current => ({ ...current, consent: e.target.checked }))} /><span>I consent to the processing of my personal information for recruitment. *</span></label>
          {notice && <p role="alert" className="career-form-error">{notice}</p>}
          <button className="marketing-button" disabled={submitting}>{submitting ? 'Submitting\u2026' : <>Submit Application <ArrowRight size={18} /></>}</button>
        </div>
      </form>
    </div></div>}

  </main><Footer /></div>;
}
