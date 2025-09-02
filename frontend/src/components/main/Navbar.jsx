import React, { useEffect, useState } from "react";
import "../../styles/main/Navbar.css";
import { FaFacebookF, FaLinkedinIn, FaInstagram } from "react-icons/fa";
import { FiMenu, FiX, FiChevronDown } from "react-icons/fi";
import axios from "axios";

const Navbar = () => {
  const [scrolled, setScrolled] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [visitorCount, setVisitorCount] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarDropdownOpen, setSidebarDropdownOpen] = useState(false);

  useEffect(() => {
    axios
      .get(`${import.meta.env.VITE_API_URL}/visitors/count`)
      .then((res) => setVisitorCount(res.data.totalVisitors))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

  return (
    <>
      <div className={`navbar ${scrolled ? "scrolled" : ""}`}>
        <div className="navbar-left-main">
          <img src="/assets/logo.webp" alt="MF Global Logo" className="navbar-logo-img" />
          <div className="navbar-logo">MF Global Services</div>
        </div>
        <div className="navbar-center desktop-menu">
          <a href="/" className="nav-link">Home</a>
          <div
            className="nav-item dropdown-wrapper"
            onMouseEnter={() => setDropdownOpen(true)}
            onMouseLeave={() => setDropdownOpen(false)}
          >
            <a href="#" className="nav-link">Our Products</a>
            <div className={`dropdown-menu ${dropdownOpen ? "show" : ""}`}>
              <a href="https://printkee.com/">Customize Gifting</a>
              <a href="https://coachingpromo.in/">Institute Promotion</a>
              <a href="https://printkee.com/">Corporate Gifting</a>
            </div>
          </div>
          <a href="/blogs" className="nav-link">Blog</a>
          <a href="/contact" className="nav-link">Contact Us</a>
        </div>
        <div className="navbar-social desktop-menu">
          <a href="https://facebook.com" target="_blank" rel="noopener noreferrer"><FaFacebookF className="social-icon" /></a>
          <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer"><FaLinkedinIn className="social-icon" /></a>
          <a href="https://instagram.com" target="_blank" rel="noopener noreferrer"><FaInstagram className="social-icon" /></a>
        </div>
        <div className="navbar-visitor-count desktop-menu-1">
          Visitors Today: <span>{visitorCount}</span>
        </div>
        <div className="hamburger-icon" onClick={toggleSidebar}>
          <FiMenu />
        </div>
      </div>
      <div className={`sidebar-1 ${sidebarOpen ? "open" : ""}`}>
        <div className="sidebar-header">
          <img src="/assets/logo.webp" alt="MF Global Logo" className="sidebar-logo-img" />
          <div className="sidebar-close" onClick={toggleSidebar}><FiX /></div>
        </div>
        <a href="/" onClick={toggleSidebar}>Home</a>
        <div className={`sidebar-dropdown ${sidebarDropdownOpen ? "open" : ""}`}>
          <span onClick={() => setSidebarDropdownOpen(!sidebarDropdownOpen)}>
            Our Products <FiChevronDown className={`chevron ${sidebarDropdownOpen ? "rotate" : ""}`} />
          </span>
          <div className={`sidebar-dropdown-menu ${sidebarDropdownOpen ? "open" : ""}`}>
            <a href="https://printkee.com/" onClick={toggleSidebar}>Customize Gifting</a>
            <a href="https://coachingpromo.in/" onClick={toggleSidebar}>Institute Promotion</a>
            <a href="https://printkee.com/" onClick={toggleSidebar}>Corporate Gifting</a>
          </div>
        </div>
        <a href="/blogs" onClick={toggleSidebar}>Blog</a>
        <a href="/contact" onClick={toggleSidebar}>Contact Us</a>
        <div className="sidebar-social">
          <a href="https://facebook.com" target="_blank" rel="noopener noreferrer"><FaFacebookF className="social-icon" /></a>
          <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer"><FaLinkedinIn className="social-icon" /></a>
          <a href="https://instagram.com" target="_blank" rel="noopener noreferrer"><FaInstagram className="social-icon" /></a>
        </div>
        <div className="sidebar-visitor-count">Visitors Today: <span>{visitorCount}</span></div>
      </div>
      {sidebarOpen && <div className="sidebar-overlay" onClick={toggleSidebar}></div>}
    </>
  );
};

export default Navbar;
