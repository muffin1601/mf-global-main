import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { FaHome, FaAngleRight, FaAngleDown, FaChartBar, FaUserTie, FaCog } from 'react-icons/fa';
import '../../styles/crm/Sidebar.css';

const Sidebar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(true);
  const [isDashboardsOpen, setIsDashboardsOpen] = useState(true);

  let user;
  try {
    user = JSON.parse(localStorage.getItem('user')) || { role: 'guest' };
  } catch (error) {
    console.error("Failed to parse user data from localStorage", error);
    user = { role: 'guest' };
  }

  const mainNavigation = [
    { label: "Dashboard Overview", path: "/crm/overview", icon: FaChartBar },
    { label: "User Management", path: "/crm/users", icon: FaUserTie, roles: ['admin'] },
    { label: "Settings", path: "/crm/settings", icon: FaCog },
  ];

  const dashboards = [
    { label: "Lead Management", path: "/crm/entrydashboard" },
    ...(user && user.role !== 'user' ? [{ label: "Product Management", path: "/crm/product-dashboard" }] : [])
  ];

  return (
    <div className={`app-sidebar ${isMenuOpen ? '' : 'app-sidebar-collapsed'}`}>
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
    </div>
  );
};

export default Sidebar;
