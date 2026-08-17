import React, { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { FaHome, FaAngleRight, FaAngleDown, FaChartBar, FaUserTie, FaFileImport, FaTruck, FaBars, FaTimes } from 'react-icons/fa';
import '../../styles/crm/Sidebar.css';

const Sidebar = () => {
  const [isMenuOpen] = useState(true);
  const [isDashboardsOpen, setIsDashboardsOpen] = useState(true);
  const [isSalesOpen, setIsSalesOpen] = useState(true);
  const [isVendorsOpen, setIsVendorsOpen] = useState(false);

  /* Mobile navigation.
   *
   * The sidebar is a fixed 260px panel. Below 768px that panel covered the
   * page and left no way to dismiss it, so every screen was unusable on a
   * phone. Dashboard.css already zeroes the content padding at that
   * breakpoint, so the intent was always for the sidebar to come out of the
   * flow here — this completes it as an off-canvas drawer. Desktop layout is
   * untouched: the toggle and backdrop only exist below 768px. */
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const location = useLocation();

  // Close the drawer after navigating, otherwise it stays over the new page.
  useEffect(() => { setIsMobileOpen(false); }, [location.pathname]);

  // Escape closes it, matching the rest of the app's dismissable surfaces.
  useEffect(() => {
    if (!isMobileOpen) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setIsMobileOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isMobileOpen]);


  let user;
  try {
    user = JSON.parse(localStorage.getItem('user')) || { role: 'guest' };
  } catch (error) {
    console.error("Failed to parse user data from localStorage", error);
    user = { role: 'guest' };
  }

  const mainNavigation = [
    // { label: "Dashboard Overview", path: "/crm/overview", icon: FaChartBar },
    { label: "Import Leads", path: "/crm/import-leads", icon: FaFileImport },
    { label: "User Management", path: "/crm/user-management", icon: FaUserTie, roles: ['admin'] },
    // { label: "Settings", path: "/crm/settings", icon: FaCog },

  ];

  const dashboards = [
    { label: "Lead Management", path: "/crm/entrydashboard" },
    ...(user && user.role !== 'user' ? [{ label: "Product Management", path: "/crm/product-dashboard" }] : [])
  ];

  // Vendor Management. "Vendor Performance" is admin-only, matching the
  // vendor.performance permission the API enforces on that endpoint.
  const vendorMenu = [
    { label: "All Vendors", path: "/crm/vendors" },
    { label: "Active Vendors", path: "/crm/vendors/active" },
    { label: "Pending Vendors", path: "/crm/vendors/pending" },
    { label: "Inactive Vendors", path: "/crm/vendors/inactive" },
    { label: "Vendor Categories", path: "/crm/vendors/categories" },
    ...(user.role === 'admin' ? [{ label: "Vendor Performance", path: "/crm/vendors/performance" }] : []),
    { label: "Vendor Settings", path: "/crm/vendors/settings" },
  ];

  const salesMenu = [
  { label: "Quotations ", path: "/crm/quotations" },
  // { label: "Opportunities", path: "/crm/sales/opportunities" },
  // { label: "Reports", path: "/crm/sales/reports" },
];


  return (
    <>
      {/* Rendered at all widths but only visible below 768px (see Sidebar.css). */}
      <button
        type="button"
        className="app-sidebar-toggle"
        aria-label={isMobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
        aria-expanded={isMobileOpen}
        aria-controls="app-sidebar-nav"
        onClick={() => setIsMobileOpen((open) => !open)}
      >
        {isMobileOpen ? <FaTimes /> : <FaBars />}
      </button>

      {isMobileOpen && (
        <div
          className="app-sidebar-backdrop"
          role="presentation"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

    <div
      id="app-sidebar-nav"
      className={`app-sidebar ${isMenuOpen ? '' : 'app-sidebar-collapsed'} ${isMobileOpen ? 'app-sidebar-mobile-open' : ''}`}
    >
      <div className="app-sidebar-header">
        <div className="app-logo-wrapper">
          <img src="/assets/logo.webp" alt="MF Global Services" className="app-logo" />
          {isMenuOpen && <span className="app-logo-text">MF Global Services</span>}
        </div>
      </div>
      
      {isMenuOpen && <div className="app-sidebar-section-title">MAIN MENU</div>}

      <div className="app-sidebar-item">
        <div className="app-dropdown-header" onClick={() => setIsDashboardsOpen(!isDashboardsOpen)}>
          <FaHome className="app-nav-icon" />
          {isMenuOpen && (
            <>
              <span className="app-nav-label">Dashboards</span>
              <span className="app-dropdown-indicator">
                {isDashboardsOpen ? <FaAngleDown /> : <FaAngleRight />}
              </span>
            </>
          )}
        </div>

        {isMenuOpen && isDashboardsOpen && (
          <ul className="app-sub-menu">
            {dashboards.map((item, index) => (
              <li key={index}>
                <NavLink
                  to={item.path}
                  className={({ isActive }) => `app-sub-menu-link ${isActive ? 'app-sub-menu-link-active' : ''}`}
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        )}
      </div>

      {mainNavigation.map((item, index) => (
        (item.roles ? item.roles.includes(user.role) : true) && (
          <div className="app-sidebar-item" key={`main-${index}`}>
            <NavLink
              to={item.path}
              className={({ isActive }) => `app-nav-link ${isActive ? 'app-nav-link-active' : ''}`}
            >
              {item.icon && <item.icon className="app-nav-icon" />}
              {isMenuOpen && <span className="app-nav-label">{item.label}</span>}
            </NavLink>
          </div>
        )
      ))}
      <div className="app-sidebar-item">
        <div
          className="app-dropdown-header"
          role="button"
          tabIndex={0}
          aria-expanded={isVendorsOpen}
          onClick={() => setIsVendorsOpen(!isVendorsOpen)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setIsVendorsOpen(!isVendorsOpen);
            }
          }}
        >
          <FaTruck className="app-nav-icon" />
          {isMenuOpen && (
            <>
              <span className="app-nav-label">Vendor Management</span>
              <span className="app-dropdown-indicator">
                {isVendorsOpen ? <FaAngleDown /> : <FaAngleRight />}
              </span>
            </>
          )}
        </div>

        {isMenuOpen && isVendorsOpen && (
          <ul className="app-sub-menu">
            {vendorMenu.map((item) => (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  end={item.path === '/crm/vendors'}
                  className={({ isActive }) => `app-sub-menu-link ${isActive ? 'app-sub-menu-link-active' : ''}`}
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="app-sidebar-item">
  <div className="app-dropdown-header" onClick={() => setIsSalesOpen(!isSalesOpen)}>
    <FaChartBar className="app-nav-icon" />
    {isMenuOpen && (
      <>
        <span className="app-nav-label">Sales</span>
        <span className="app-dropdown-indicator">
          {isSalesOpen ? <FaAngleDown /> : <FaAngleRight />}
        </span>
      </>
    )}
  </div>

  {isMenuOpen && isSalesOpen && (
    <ul className="app-sub-menu">
      {salesMenu.map((item, index) => (
        <li key={index}>
          <NavLink
            to={item.path}
            className={({ isActive }) => `app-sub-menu-link ${isActive ? 'app-sub-menu-link-active' : ''}`}
          >
            {item.label}
          </NavLink>
        </li>
      ))}
    </ul>
  )}
</div>

    </div>
    </>
  );
};

export default Sidebar;
