import React, { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import "../../styles/main/Navbar.css";
import { FaFacebookF, FaLinkedinIn, FaInstagram } from "react-icons/fa";
import { FiMenu, FiX, FiChevronDown } from "react-icons/fi";

const products = [
  { label: "Premium Gifts", href: "https://giftaguru.com/" },
  { label: "Edu Print & Promo", href: "https://coachingpromo.in/" },
  { label: "Corporate Gifting", href: "https://printkee.com/" },
];

const socialLinks = [
  { label: "Facebook", href: "https://facebook.com", icon: <FaFacebookF /> },
  { label: "LinkedIn", href: "https://linkedin.com", icon: <FaLinkedinIn /> },
  { label: "Instagram", href: "https://instagram.com", icon: <FaInstagram /> },
];

const Navbar = () => {
  const [scrolled, setScrolled] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarDropdownOpen, setSidebarDropdownOpen] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 24);
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    setSidebarOpen(false);
    setSidebarDropdownOpen(false);
    setDropdownOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!sidebarOpen) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setSidebarOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [sidebarOpen]);

  const linkClass = ({ isActive }) => `nav-link${isActive ? " active" : ""}`;
  const sidebarLinkClass = ({ isActive }) => `sidebar-link${isActive ? " active" : ""}`;

  return (
    <>
      <header className={`navbar${scrolled ? " scrolled" : ""}`}>
        <Link to="/" className="navbar-left-main" aria-label="MF Global Services home">
          <img src="/assets/logo.webp" alt="" className="navbar-logo-img" />
          <span className="navbar-logo">MF Global Services</span>
        </Link>

        <nav className="navbar-center desktop-menu" aria-label="Main navigation">
          <NavLink to="/" end className={linkClass}>Home</NavLink>
          <div
            className="nav-item dropdown-wrapper"
            onMouseEnter={() => setDropdownOpen(true)}
            onMouseLeave={() => setDropdownOpen(false)}
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) setDropdownOpen(false);
            }}
          >
            <button
              type="button"
              className={`nav-link products-toggle${dropdownOpen ? " active" : ""}`}
              aria-expanded={dropdownOpen}
              aria-controls="desktop-products-menu"
              onClick={() => setDropdownOpen((open) => !open)}
            >
              Our Products <FiChevronDown aria-hidden="true" />
            </button>
            <div id="desktop-products-menu" className={`dropdown-menu${dropdownOpen ? " show" : ""}`}>
              {products.map((product) => (
                <a key={product.href} href={product.href} target="_blank" rel="noopener noreferrer">
                  {product.label}
                </a>
              ))}
            </div>
          </div>
          <NavLink to="/blogs" className={linkClass}>Blog</NavLink>
          <NavLink to="/careers" className={linkClass}>Careers</NavLink>
          <NavLink to="/contact" className={linkClass}>Contact Us</NavLink>
        </nav>

        <div className="navbar-actions desktop-menu">
          <div className="navbar-social" aria-label="Social media">
            {socialLinks.map((item) => (
              <a key={item.label} href={item.href} target="_blank" rel="noopener noreferrer" aria-label={item.label}>
                {item.icon}
              </a>
            ))}
          </div>
          <Link to="/contact" className="navbar-cta">Let’s talk <span aria-hidden="true">→</span></Link>
        </div>

        <button
          type="button"
          className="hamburger-icon"
          aria-label={sidebarOpen ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={sidebarOpen}
          aria-controls="mobile-navigation"
          onClick={() => setSidebarOpen((open) => !open)}
        >
          {sidebarOpen ? <FiX aria-hidden="true" /> : <FiMenu aria-hidden="true" />}
        </button>
      </header>

      <nav
        id="mobile-navigation"
        className={`sidebar-1${sidebarOpen ? " open" : ""}`}
        aria-label="Mobile navigation"
        aria-hidden={!sidebarOpen}
        inert={!sidebarOpen}
      >
        <div className="sidebar-header">
          <Link to="/" className="sidebar-brand" onClick={() => setSidebarOpen(false)}>
            <img src="/assets/logo.webp" alt="" className="sidebar-logo-img" />
            <span>MF Global Services</span>
          </Link>
          <button type="button" className="sidebar-close" aria-label="Close navigation menu" onClick={() => setSidebarOpen(false)}>
            <FiX aria-hidden="true" />
          </button>
        </div>
        <NavLink to="/" end className={sidebarLinkClass}>Home</NavLink>
        <div className={`sidebar-dropdown${sidebarDropdownOpen ? " open" : ""}`}>
          <button
            type="button"
            aria-expanded={sidebarDropdownOpen}
            aria-controls="mobile-products-menu"
            onClick={() => setSidebarDropdownOpen((open) => !open)}
          >
            Our Products <FiChevronDown className={`chevron${sidebarDropdownOpen ? " rotate" : ""}`} aria-hidden="true" />
          </button>
          <div id="mobile-products-menu" className="sidebar-dropdown-menu">
            {products.map((product) => (
              <a key={product.href} href={product.href} target="_blank" rel="noopener noreferrer" onClick={() => setSidebarOpen(false)}>
                {product.label}
              </a>
            ))}
          </div>
        </div>
        <NavLink to="/blogs" className={sidebarLinkClass}>Blog</NavLink>
        <NavLink to="/careers" className={sidebarLinkClass}>Careers</NavLink>
        <NavLink to="/contact" className={sidebarLinkClass}>Contact Us</NavLink>
        <div className="sidebar-social" aria-label="Social media">
          {socialLinks.map((item) => (
            <a key={item.label} href={item.href} target="_blank" rel="noopener noreferrer" aria-label={item.label}>
              {item.icon}
            </a>
          ))}
        </div>
      </nav>
      {sidebarOpen && (
        <button type="button" className="sidebar-overlay" aria-label="Close navigation menu" onClick={() => setSidebarOpen(false)} />
      )}
    </>
  );
};

export default Navbar;
