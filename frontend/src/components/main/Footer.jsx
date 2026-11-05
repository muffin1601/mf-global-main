import React from "react";
import { Link } from "react-router-dom";
import "../../styles/main/Footer.css";
import { FaFacebookF, FaLinkedinIn, FaYoutube } from "react-icons/fa";
import { FiMail, FiMapPin, FiPhone } from "react-icons/fi";

const Footer = () => (
  <footer className="footer">
    <div className="footer-top">
      <div className="footer-info">
        <Link to="/" className="footer-brand">
          <img src="/assets/logo.webp" alt="" className="footer-logo-img" loading="lazy" />
          <span className="footer-company-name">MF Global Services</span>
        </Link>
        <p className="footer-services-line">
          Corporate Gifting <span aria-hidden="true">·</span> Digital Marketing <span aria-hidden="true">·</span> Website Development
        </p>
        <p className="footer-tagline">
          Thoughtful gifting and digital solutions to help businesses build stronger connections.
        </p>
      </div>

      <nav className="footer-links" aria-label="Footer navigation">
        <h4>Explore</h4>
        <ul>
          <li><Link to="/">Home</Link></li>
          <li><Link to="/#about">About Us</Link></li>
          <li><Link to="/#services">Services</Link></li>
          <li><Link to="/blogs">Blog</Link></li>
          <li><Link to="/careers">Careers</Link></li>
          <li><Link to="/contact">Contact Us</Link></li>
        </ul>
      </nav>

      <div className="footer-contact">
        <h4>Reach us</h4>
        <p><FiPhone aria-hidden="true" /><a href="tel:+919266013059">+91 9266 013059</a></p>
        <p><FiMail aria-hidden="true" /><a href="mailto:sales@mfglobalservices.com">sales@mfglobalservices.com</a></p>
        <p className="footer-address"><FiMapPin aria-hidden="true" /><span>F90/1, Beside ESIC Hospital, Okhla Industrial Area Phase 1, New Delhi – 110020, India</span></p>
      </div>

      <div className="footer-social">
        <h4>Follow us</h4>
        <div className="social-icons-footer">
          <a href="https://www.facebook.com/mfglobalservices2018" target="_blank" rel="noopener noreferrer" className="facebook" aria-label="Facebook"><FaFacebookF /></a>
          <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" className="linkedin" aria-label="LinkedIn"><FaLinkedinIn /></a>
          <a href="https://youtube.com" target="_blank" rel="noopener noreferrer" className="youtube" aria-label="YouTube"><FaYoutube /></a>
        </div>
      </div>
    </div>

    <div className="footer-bottom">
      <p>© {new Date().getFullYear()} MF Global Services. All rights reserved.</p>
    </div>
  </footer>
);

export default Footer;
