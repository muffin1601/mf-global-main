import React from "react";
import "../../styles/main/ContactUs.css";


const ContactUs = () => {
  return (
  
    <div className="contactus-container">
      {/* Left Info Section */}
      <div className="contactus-info-section">
        <h2 className="contactus-heading">Let’s Talk Business!</h2>

        <p className="contactus-detail">
          <strong>📞 Phone:</strong>{' '}
          <a
            href="https://wa.me/919266013059"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'inherit', textDecoration: 'none' }}
          >
            +91 9266 013059
          </a>
        </p>

        <p className="contactus-detail">
          <strong>✉️ Email:</strong>{' '}
          <a
            href="mailto:sales@mfglobalservices.com"
            style={{ color: 'inherit', textDecoration: 'none' }}
          >
            sales@mfglobalservices.com
          </a>
        </p>

        <p className="contactus-detail">
          <strong>📍 Address:</strong> F90/1, Beside ESIC Hospital, Okhla Industrial Area Phase 1,<br />
          New Delhi – 110020, India
        </p>

        <p className="contactus-detail">
          <strong>🕘 Business Hours:</strong> Mon – Fri, 10:00 AM – 6:00 PM
        </p>

        <p className="contactus-tagline">
          We’d love to hear from you — reach out and let’s build something amazing together.
        </p>
      </div>
      {/* Right Form Section */}
      <div className="contactus-form-section">
        <h2 className="contactus-heading-2">Send Us a Message</h2>
        <form className="contactus-form">
          <input
            type="text"
            placeholder="Full Name *"
            className="contactus-input"
            required
          />
          <input
            type="tel"
            placeholder="Phone Number *"
            className="contactus-input"
            required
          />
          <input
            type="email"
            placeholder="Work Email Address (optional)"
            className="contactus-input"
          />
          <input
            type="text"
            placeholder="Company / Organization"
            className="contactus-input"
          />
          <textarea
            placeholder="Tell us how we can assist you..."
            className="contactus-textarea"
            rows="5"
            required
          ></textarea>
          <button type="submit" className="contactus-button">
            Let’s Connect <span className="arrow">→</span>
          </button>
        </form>
      </div>
    </div>
    
  );
};

export default ContactUs;
