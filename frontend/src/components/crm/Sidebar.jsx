import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import '../../styles/crm/Sidebar.css';
import { FaHome, FaBars } from 'react-icons/fa';

const Sidebar = () => {
  const [menuOpen, setMenuOpen] = useState(true);
  const [dashboardsOpen, setDashboardsOpen] = useState(true);

  const dashboards = [
    { label: "Lead Management", path: "/crm/entrydashboard" },
<<<<<<< HEAD
    // { label: "Client Overview", path: "/" },
    // { label: "User Roles", path: "/" }
=======
    { label: "Client Overview", path: "#" },
    { label: "User Roles", path: "#" }
>>>>>>> e535ab6584991d2da1192b8eb158a59d2165b973
  ];

  return (
    <div className={`sidebar-container ${menuOpen ? '' : 'collapsed'}`}>
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <img src="/assets/logo.png" alt="logo" />
          {menuOpen && <span className="sidebar-logo-text">MF Global Services</span>}
        </div>
        {/* <FaBars className="menu-toggle-icon" onClick={() => setMenuOpen(!menuOpen)} /> */}
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
