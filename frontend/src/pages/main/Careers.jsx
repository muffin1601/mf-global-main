import React, { useState } from "react";
import { ArrowDown, ArrowRight, BriefcaseBusiness, CheckCircle2, GraduationCap, HeartHandshake, Lightbulb, Sparkles, UsersRound } from "lucide-react";
import Navbar from "../../components/main/Navbar";
import Footer from "../../components/main/Footer";
import useMarketingMeta from "./useMarketingMeta";
import "../../styles/main/MarketingSite.css";

const MAX_RESUME_SIZE = 5 * 1024 * 1024;
const APPLICATION_OPENS_AT = new Date(2026, 10, 10);
const APPLICATION_CLOSES_AT = new Date(2026, 10, 30, 23, 59, 59, 999);
const ALLOWED_EXTENSIONS = new Set(["pdf", "doc", "docx"]);
const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const jobs = [
  {
    title: "Telemarketing Executive",
    department: "Sales & Marketing",
    description: "Build meaningful customer conversations and help prospective customers discover the right products and services.",
    responsibilities: "Customer calling, lead generation, explaining products/services, following up with potential customers, maintaining customer records, and achieving sales targets.",
  },
  {
    title: "E-commerce Executive",
    department: "E-commerce",
    description: "Support smooth day-to-day operations across online product listings, orders, and store updates.",
    responsibilities: "Managing online product listings, updating product information, maintaining online stores, processing orders, coordinating with internal teams, and monitoring e-commerce operations.",
  },
  {
    title: "E-commerce Sales Executive",
    department: "Sales & E-commerce",
    description: "Connect with online customers, nurture enquiries, and contribute to sales growth across e-commerce channels.",
    responsibilities: "Generating online sales, handling customer inquiries, following up on leads, managing customer relationships, promoting products, and achieving sales targets.",
  },
];

const benefits = [
  { icon: <GraduationCap aria-hidden="true" />, title: "Career growth", text: "Take on meaningful responsibilities and build skills through hands-on experience." },
  { icon: <Sparkles aria-hidden="true" />, title: "Professional development", text: "Grow your expertise while contributing to work that matters to our customers." },
  { icon: <UsersRound aria-hidden="true" />, title: "Collaborative environment", text: "Work alongside teammates who value communication, respect, and shared goals." },
  { icon: <Lightbulb aria-hidden="true" />, title: "Learning opportunities", text: "Stay curious, exchange ideas, and keep learning as our work evolves." },
  { icon: <HeartHandshake aria-hidden="true" />, title: "Innovation & excellence", text: "Bring fresh thinking to the details that make great customer experiences." },
];

const Careers = () => {
  const now = new Date();
  const hiringStatus = now < APPLICATION_OPENS_AT
    ? "Opening soon"
    : now <= APPLICATION_CLOSES_AT ? "Hiring" : "Closed";
  const hiringStatusClass = hiringStatus === "Opening soon"
    ? "opening-soon"
    : hiringStatus === "Closed" ? "closed" : "";

  useMarketingMeta(
    "Careers | MF Global Services",
    "Explore careers at MF Global Services. View current sales and e-commerce opportunities and apply online."
  );

  const [position, setPosition] = useState("");
  const [resume, setResume] = useState(null);
  const [resumeError, setResumeError] = useState("");
  const [mobileError, setMobileError] = useState("");
  const [status, setStatus] = useState({ type: "", message: "" });
  const [submitting, setSubmitting] = useState(false);

  const selectPosition = (jobTitle) => {
    setPosition(jobTitle);
    document.getElementById("application-form")?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  };

  const handleResumeChange = (event) => {
    const file = event.target.files?.[0] || null;
    setResumeError("");
    setResume(file);
    if (!file) return;

    const extension = file.name.split(".").pop()?.toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(extension) || (file.type && !ALLOWED_MIME_TYPES.has(file.type))) {
      setResume(null);
      setResumeError("Upload your resume as a PDF, DOC, or DOCX file.");
      event.target.value = "";
      return;
    }
    if (file.size > MAX_RESUME_SIZE) {
      setResume(null);
      setResumeError("Your resume must be 5 MB or smaller.");
      event.target.value = "";
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setStatus({ type: "", message: "" });
    setMobileError("");
    setResumeError("");

    const form = event.currentTarget;
    if (!form.reportValidity()) return;

    const formData = new FormData(form);
    for (const field of ["fullName", "email", "mobile", "position", "location", "experience", "coverLetter"]) {
      const value = formData.get(field);
      if (typeof value === "string") formData.set(field, value.trim());
    }
    const requiredFields = ["fullName", "email", "mobile", "position", "location", "experience"];
    if (requiredFields.some((field) => !formData.get(field))) {
      setStatus({ type: "error", message: "Please complete all required fields." });
      return;
    }

    const mobileDigits = String(formData.get("mobile") || "").replace(/\D/g, "");
    if (mobileDigits.length < 10 || mobileDigits.length > 15) {
      setMobileError("Enter a valid mobile number with 10 to 15 digits.");
      return;
    }
    if (!resume) {
      setResumeError("Please attach your resume before submitting.");
      return;
    }
    if (resume.size > MAX_RESUME_SIZE) {
      setResumeError("Your resume must be 5 MB or smaller.");
      return;
    }

    const now = new Date();
    if (now < APPLICATION_OPENS_AT || now > APPLICATION_CLOSES_AT) {
      setStatus({
        type: "error",
        message: now < APPLICATION_OPENS_AT
          ? "Applications open on 10 November 2026. Please return during the application period."
          : "The application period ended on 30 November 2026.",
      });
      return;
    }

    const apiUrl = import.meta.env.VITE_API_URL?.trim().replace(/\/+$/, "");
    if (!apiUrl) {
      setStatus({
        type: "error",
        message: "Applications are temporarily unavailable because the application service is not configured. Please contact sales@mfglobalservices.com.",
      });
      return;
    }

    formData.set("resume", resume);
    setSubmitting(true);
    try {
      const response = await fetch(`${apiUrl}/careers/apply`, {
        method: "POST",
        body: formData,
        credentials: "omit",
        mode: "cors",
        referrerPolicy: "strict-origin-when-cross-origin",
      });
      let result;
      try {
        result = await response.json();
      } catch {
        setStatus({ type: "error", message: "The application service returned an invalid response. Please try again later." });
        return;
      }
      if (!response.ok || result?.success !== true) {
        setStatus({
          type: "error",
          message: typeof result?.message === "string"
            ? result.message
            : "We couldn’t submit your application. Please try again.",
        });
        return;
      }

      setStatus({
        type: "success",
        message: result.message || "Your application has been submitted. Thank you for your interest.",
      });
      form.reset();
      setPosition("");
      setResume(null);
    } catch {
      setStatus({
        type: "error",
        message: "We couldn’t reach the application service. Please check your connection and try again, or email sales@mfglobalservices.com.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="marketing-site careers-page">
      <Navbar />
      <main>
        <section className="careers-hero" aria-labelledby="careers-title">
          <div className="careers-hero-image" role="img" aria-label="A bright, welcoming workspace" />
          <div className="careers-hero-content">
            <p className="marketing-eyebrow">Make your next move</p>
            <h1 id="careers-title">Build Your Career With Us</h1>
            <p>
              Join our team and become part of an organization focused on innovation, growth, customer satisfaction, and excellence. Explore exciting opportunities and take the next step in your professional journey.
            </p>
            <a className="marketing-button" href="#open-positions">
              Explore Open Positions <ArrowDown size={18} aria-hidden="true" />
            </a>
          </div>
          <div className="careers-illustration" aria-hidden="true">
            <div className="illustration-topline"><span>GROW TOGETHER</span><Sparkles size={18} /></div>
            <div className="illustration-people">
              <span className="illustration-person person-one"><UsersRound /></span>
              <span className="illustration-person person-two"><Lightbulb /></span>
              <span className="illustration-person person-three"><HeartHandshake /></span>
            </div>
            <div className="illustration-caption">
              <span className="illustration-caption-icon"><BriefcaseBusiness /></span>
              <span><strong>Ideas become impact</strong><small>Bring your best to the team</small></span>
            </div>
          </div>
          <div className="careers-hero-note">
            <BriefcaseBusiness aria-hidden="true" />
            <span>New opportunities<br /><strong>Opening 10 November 2026</strong></span>
          </div>
        </section>

        <section className="careers-benefits marketing-section" aria-labelledby="benefits-title">
          <div className="marketing-section-heading">
            <p className="marketing-eyebrow">A place to grow</p>
            <h2 id="benefits-title">Why work with us?</h2>
            <p>Bring your perspective, build your capabilities, and do your best work with a team committed to moving forward together.</p>
          </div>
          <div className="benefit-grid">
            {benefits.map((benefit) => (
              <article className="benefit-card" key={benefit.title}>
                <span className="benefit-icon">{benefit.icon}</span>
                <h3>{benefit.title}</h3>
                <p>{benefit.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="careers-openings marketing-section" id="open-positions" aria-labelledby="openings-title">
          <div className="marketing-section-heading">
            <p className="marketing-eyebrow">Join our team</p>
            <h2 id="openings-title">Current job openings</h2>
            <p>Explore the available opportunities and apply during the application window.</p>
          </div>
          <div className="job-grid">
            {jobs.map((job) => (
              <article className="job-card" key={job.title}>
                <div className="job-card-topline">
                  <span className={`job-badge ${hiringStatusClass}`}>
                    <span aria-hidden="true" /> {hiringStatus}
                  </span>
                  <span className="job-type">Full-time</span>
                </div>
                <h3>{job.title}</h3>
                <p className="job-department">{job.department}</p>
                <p className="job-description">{job.description}</p>
                <div className="job-responsibilities">
                  <h4>What you’ll do</h4>
                  <p>{job.responsibilities}</p>
                </div>
                <div className="job-date">
                  <span>Applications</span>
                  <strong>10 Nov – 30 Nov 2026</strong>
                </div>
                <button className="marketing-button job-apply-button" type="button" onClick={() => selectPosition(job.title)}>
                  Apply Now <ArrowRight size={18} aria-hidden="true" />
                </button>
              </article>
            ))}
          </div>
        </section>

        <section className="careers-deadline" aria-label="Application deadline">
          <div>
            <p className="marketing-eyebrow">Your next opportunity starts here</p>
            <h2>Applications Open: 10 November 2026</h2>
            <p><strong>Last Date to Apply: 30 November 2026</strong></p>
            <p>Apply before the deadline to be considered for these opportunities.</p>
          </div>
          <a className="marketing-button marketing-button-light" href="#application-form">
            Submit your application <ArrowRight size={18} aria-hidden="true" />
          </a>
        </section>

        <section className="application-section marketing-section" id="application-form" aria-labelledby="application-title">
          <div className="application-intro">
            <p className="marketing-eyebrow">Take the next step</p>
            <h2 id="application-title">Apply to join our team</h2>
            <p>Share a few details and attach your resume to apply for one of the listed opportunities.</p>
            <p className="application-window"><CheckCircle2 size={18} aria-hidden="true" /> Applications accepted 10–30 November 2026</p>
          </div>
          <form className="application-form" onSubmit={handleSubmit} noValidate>
            <div className="application-fields">
              <label>
                Full Name <span aria-hidden="true">*</span>
                <input type="text" name="fullName" autoComplete="name" required maxLength={120} />
              </label>
              <label>
                Email Address <span aria-hidden="true">*</span>
                <input type="email" name="email" autoComplete="email" required maxLength={254} />
              </label>
              <label>
                Mobile Number <span aria-hidden="true">*</span>
                <input type="tel" name="mobile" autoComplete="tel" inputMode="tel" required maxLength={20} aria-describedby={mobileError ? "mobile-error" : undefined} />
                {mobileError && <span className="field-error" id="mobile-error">{mobileError}</span>}
              </label>
              <label>
                Position Applying For <span aria-hidden="true">*</span>
                <select name="position" value={position} onChange={(event) => setPosition(event.target.value)} required>
                  <option value="">Select a position</option>
                  {jobs.map((job) => <option key={job.title} value={job.title}>{job.title}</option>)}
                </select>
              </label>
              <label>
                Current Location <span aria-hidden="true">*</span>
                <input type="text" name="location" autoComplete="address-level2" required maxLength={120} />
              </label>
              <label>
                Total Experience <span aria-hidden="true">*</span>
                <input type="text" name="experience" placeholder="e.g. 2 years" required maxLength={80} />
              </label>
              <label className="application-file-field">
                Resume Upload (PDF, DOC, DOCX) <span aria-hidden="true">*</span>
                <input
                  type="file"
                  name="resume"
                  accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={handleResumeChange}
                  aria-describedby={resumeError ? "resume-error" : "resume-help"}
                  required
                />
                <span className="field-hint" id="resume-help">Maximum file size: 5 MB.</span>
                {resumeError && <span className="field-error" id="resume-error">{resumeError}</span>}
              </label>
              <label className="application-cover-field">
                Cover Letter / Additional Information
                <textarea name="coverLetter" rows="5" maxLength={3000} placeholder="Tell us a little more about your experience and interest." />
              </label>
            </div>
            <button type="submit" className="marketing-button application-submit" disabled={submitting}>
              {submitting ? "Submitting…" : "Submit Application"} <ArrowRight size={18} aria-hidden="true" />
            </button>
            <p className={`application-status${status.type ? ` ${status.type}` : ""}`} role="status" aria-live="polite">
              {status.message}
            </p>
          </form>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default Careers;
