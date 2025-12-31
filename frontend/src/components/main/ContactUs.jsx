import React, { useState } from "react";
import "../../styles/main/ContactUs.css";

const ContactUs = () => {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    companyname: '',
    message: '',
  });

  const [status, setStatus] = useState(null);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus("sending");
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/send-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const result = await res.json();
      if (result.success) {
        setStatus("success");
        setFormData({
          name: '',
          phone: '',
          email: '',
          companyname: '',
          message: '',
        });
      } else {
        setStatus("error");
      }
    } catch (error) {
      setStatus("error");
    }
  };

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
          <strong>☎️ Landline:</strong>{' '}
          <a
            href="tel:011-47563596"
            style={{ color: 'inherit', textDecoration: 'none' }}
          >
            011-47563596
          </a>
        </p>

        <p className="contactus-detail">
          <strong>✉️ Email:</strong>{' '}
          <a
            href="mailto:business@mfglobalservices.com"
            style={{ color: 'inherit', textDecoration: 'none' }}
          >
            business@mfglobalservices.com
          </a>
        </p>

        <p className="contactus-detail">
          <strong>📍 Address:</strong> F90/1, Beside ESIC Hospital, Okhla Industrial Area Phase 1,<br />
          New Delhi – 110020, India
        </p>

        <p className="contactus-detail">
          <strong>🕘 Business Hours:</strong> Mon – Sat, 10:00 AM – 6:00 PM
        </p>

        <p className="contactus-tagline">
          We’d love to hear from you — reach out and let’s build something amazing together.
        </p>
      </div>

      {/* Right Form Section */}
      <div className="contactus-form-section">
        <h2 className="contactus-heading-2">Send Us a Message</h2>
        <form className="contactus-form" onSubmit={handleSubmit}>
          <input
            type="text"
            name="name"
            placeholder="Full Name *"
            className="contactus-input"
            value={formData.name}
            onChange={handleChange}
            required
          />
          <input
            type="tel"
            name="phone"
            placeholder="Phone Number *"
            className="contactus-input"
            value={formData.phone}
            onChange={handleChange}
            required
          />
          <input
            type="email"
            name="email"
            placeholder="Work Email Address (optional)"
            className="contactus-input"
            value={formData.email}
            onChange={handleChange}
          />
          <input
            type="text"
            name="companyname"
            placeholder="Company / Organization"
            className="contactus-input"
            value={formData.companyname}
            onChange={handleChange}
          />
          <textarea
            name="message"
            placeholder="Tell us how we can assist you..."
            className="contactus-textarea"
            rows="5"
            value={formData.message}
            onChange={handleChange}
            required
          ></textarea>
          <button type="submit" className="contactus-button">
            Let’s Connect <span className="arrow">→</span>
          </button>

          {/* Feedback messages */}
          {status === "sending" && <p className="contactus-status">Sending message...</p>}
          {status === "success" && <p className="contactus-success">Message sent successfully!</p>}
          {status === "error" && <p className="contactus-error">Failed to send message. Please try again later.</p>}
        </form>
      </div>
    </div>
  );
};

export default ContactUs;
