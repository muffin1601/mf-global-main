import React, { useEffect, useState } from "react";
import "../../styles/main/Navbar.css";
import { FaFacebookF, FaLinkedinIn, FaInstagram } from "react-icons/fa";

const Navbar = () => {
  const [scrolled, setScrolled] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleDropdownEnter = () => {
    setDropdownOpen(true);
  };

  const handleDropdownLeave = () => {
    setDropdownOpen(false);
  };

  return (
    <div className={`navbar ${scrolled ? "scrolled" : ""}`}>
      <div className="navbar-left">
        <img
          src="/assets/logo.png"
          alt="MF Global Logo"
          className="navbar-logo-img"
        />
        <div className="navbar-logo">MF Global Services</div>
      </div>

      <div className="navbar-center">
        <a href="#home" className="nav-link">Home</a>

        <div
          className="nav-item dropdown-wrapper"
          onMouseEnter={handleDropdownEnter}
          
          // style={{ position: 'relative' }}
        >
          <a href="" className="nav-link dropdown">
            Our Services
          
          <div className={`dropdown-menu ${dropdownOpen ? "show" : ""}`}onMouseLeave={handleDropdownLeave}>
            <a href="https://printkee.com/">Customize Gifting</a>
            <a href="https://coachingpromo.in/">Institute Promotion</a>
            <a href="https://mfglobalservices.com/">Corporate Gifting</a>
          </div></a>
        </div>

        <a href="#contact" className="nav-link">Contact Us</a>
      </div>

      <div className="navbar-social">
        <a href="https://facebook.com" target="_blank" rel="noopener noreferrer">
          <FaFacebookF className="social-icon" />
        </a>
        <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer">
          <FaLinkedinIn className="social-icon" />
        </a>
        <a href="https://instagram.com" target="_blank" rel="noopener noreferrer">
          <FaInstagram className="social-icon" />
        </a>
      </div>
    </div>
  );
};

export default Navbar;
