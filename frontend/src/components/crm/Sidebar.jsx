import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import '../../styles/crm/Sidebar.css';
import { FaHome } from 'react-icons/fa';

const Sidebar = ({ userRole }) => {
  const [menuOpen, setMenuOpen] = useState(true);
  const [dashboardsOpen, setDashboardsOpen] = useState(true);

const user = JSON.parse(localStorage.getItem('user'))

  // Conditionally include "Product Management"
  const dashboards = [
    { label: "Lead Management", path: "/crm/entrydashboard" },
    ...(user.role !== 'user' ? [{ label: "Product Management", path: "/crm/product-dashboard" }] : [])
  ];

  return (
    <div className={`sidebar-container ${menuOpen ? '' : 'collapsed'}`}>
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <img src="/assets/logo.png" alt="logo" />
          {menuOpen && <span className="sidebar-logo-text">MF Global Services</span>}
        </div>
      </div>

      {menuOpen && <div className="sidebar-section-title">MAIN</div>}

      <div className="sidebar-item">
        <div className="sidebar-dropdown" onClick={() => setDashboardsOpen(!dashboardsOpen)}>
          <FaHome className="sidebar-icon" />
          {menuOpen && (
            <>
              <span className="sidebar-label">Dashboards</span>
              <span className="sidebar-arrow">{dashboardsOpen ? '▲' : '▼'}</span>
            </>
          )}
        </div>

        {menuOpen && dashboardsOpen && (
          <ul className="sidebar-sublist">
            {dashboards.map((item, index) => (
              <li key={index}>
                <NavLink
                  to={item.path}
                  className={({ isActive }) =>
                    `sidebar-subitem ${isActive ? 'highlight' : ''}`
                  }
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default Sidebar;
