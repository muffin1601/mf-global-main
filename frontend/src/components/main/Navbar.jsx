import React, { useEffect, useState } from "react";
import "../../styles/main/Navbar.css";
import { FaFacebookF, FaLinkedinIn, FaInstagram } from "react-icons/fa";
import axios from "axios";

const Navbar = () => {
  const [scrolled, setScrolled] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [visitorCount, setVisitorCount] = useState(0); 

  useEffect(() => {
    axios
      .get(`${import.meta.env.VITE_API_URL}/visitors/count`) 
      .then((res) => setVisitorCount(res.data.totalVisitors))
      .catch((err) => console.error("Failed to fetch visitor count", err));
  }, []);

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
      <div className="navbar-left-main">
        <img
          src="/assets/logo.png"
          alt="MF Global Logo"
          className="navbar-logo-img"
        />
        <div className="navbar-logo">MF Global Services</div>
      </div>

      <div className="navbar-center">
        <a href="/" className="nav-link">Home</a>

        <div
          className="nav-item dropdown-wrapper"
          onMouseEnter={handleDropdownEnter}
          
          // style={{ position: 'relative' }}
        >
          <a href="" className="nav-link dropdown">
            Our Products
          
          <div className={`dropdown-menu ${dropdownOpen ? "show" : ""}`}onMouseLeave={handleDropdownLeave}>
            <a href="https://printkee.com/">Customize Gifting</a>
            <a href="https://coachingpromo.in/">Institute Promotion</a>
            <a href="https://mfglobalservices.com/">Corporate Gifting</a>
          </div></a>
        </div>

        <a href="/blogs" className="nav-link">Blog</a>

        <a href="/contact" className="nav-link">Contact Us</a>
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
      <div className="navbar-visitor-count">
        Visitor Count: <span id="visitor-count">{visitorCount}</span>
      </div>
    </div>
  );
};

export default Navbar;
