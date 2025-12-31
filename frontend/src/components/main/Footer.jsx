import React from "react";
import "../../styles/main/Footer.css";
import { FaFacebookF, FaLinkedinIn,FaYoutube } from "react-icons/fa";

const Footer = () => {
  return (
    <footer className="footer">
      <div className="footer-top">

        {/* Company Info */}
        <div className="footer-info">
          <h3 className="footer-company-name">MF Global Services</h3>
          <p className="footer-services-line">
            Corporate Gifting | Digital Marketing | Website Development
          </p>
        </div>

        {/* Contact */}
        <div className="footer-contact">
          <h4>Reach Us</h4>

          <p>
            📞{" "}
            <a
              href="https://wa.me/919266013059"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "inherit", textDecoration: "none" }}
            >
              +91 9266 013059
            </a>
          </p>

          <p>
            📧{" "}
            <a
              href="mailto:sales@mfglobalservices.com"
              style={{ color: "inherit", textDecoration: "none" }}
            >
              sales@mfglobalservices.com
            </a>
          </p>

          <p>
            📍 F90/1, Beside ESIC Hospital, Okhla Industrial Area Phase 1,
            <br />
            New Delhi – 110020, India
          </p>
        </div>

        {/* Social */}
        <div className="footer-social">
          <h4>Follow Us</h4>
          <div className="social-icons-footer">
            <a
              href="https://www.facebook.com/mfglobalservices2018"
              target="_blank"
              rel="noopener noreferrer"
              className="facebook"
            >
              <FaFacebookF />
            </a>
            <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" className="linkedin"><FaLinkedinIn /></a>
            <a href="https://youtube.com" target="_blank" rel="noopener noreferrer" className="youtube"><FaYoutube /></a>
          </div>
        </div>
      </div>

      {/* Bottom */}
      <div className="footer-bottom">
        <p>© {new Date().getFullYear()} MF Global Services. All rights reserved.</p>
      </div>
    </footer>
  );
};

export default Footer;
