import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { logout } from '../../redux/authSlice';
import { FaBell, FaShoppingCart, FaMoon, FaExpand, FaQuestionCircle, FaCog, FaEnvelope, FaFileAlt, FaUser } from 'react-icons/fa';
import "../../styles/crm/Navbar.css";

const Navbar = () => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dispatch = useDispatch();
  const navigate = useNavigate();
    const [menuOpen, setMenuOpen] = useState(true);
  
  const user = JSON.parse(localStorage.getItem('user')) || { name: "Mr.Henry", role: "UI/UX Designer" };

  const toggleDropdown = () => {
    setDropdownOpen(!dropdownOpen);
  };

  const handleLogout = async () => {
    const { logActivity } = await import("../../utils/logActivity");
    await logActivity("User Logged Out", {
      userId: user.id,
      username: user.name,
      timestamp: new Date().toISOString(),
    });
    dispatch(logout());
    navigate('/crm');
  };

  return (
    <div className="navbar-container">
      {/* <div className="sidebar-logo">
          <img src="/assets/logo.png" alt="logo" />
          {menuOpen && <span className="sidebar-logo-text">MF Global Services</span>}
        </div> */}
      {/* Back Button */}
      <div className="navbar-left">
        <button className="back-button" onClick={() => navigate(-1)}>
          <svg xmlns="http://www.w3.org/2000/svg" height="1em" fill="currentColor" viewBox="0 0 448 512">
            <path d="M257.5 445.1c9.4 9.4 9.4 24.6 0 33.9s-24.6 9.4-33.9 0L7 262.6c-9.4-9.4-9.4-24.6 0-33.9L223.6 6.1c9.4-9.4 24.6-9.4 33.9 0s9.4 24.6 0 33.9L72.5 224 257.5 409z" />
          </svg>
        </button>
  
        <div className="navbar-search">
          <input type="text" placeholder="Search anything here ..." />
        </div>
      </div>
  
      {/* Right-side icons */}
      <div className="navbar-icons">
        <button className="icon-button"><span className="icon-text">🌐</span></button>
        <button className="icon-button"><FaMoon /></button>
        <button className="icon-button">
          <FaShoppingCart />
          <span className="badge">5</span>
        </button>
        <button className="icon-button">
          <FaBell />
          <span className="dot" />
        </button>
        <button className="icon-button"><FaExpand /></button>
        <button className="profile-button" onClick={toggleDropdown}>
          <img src="https://laravelui.spruko.com/xintra/build/assets/images/faces/2.jpg" alt="Profile" className="profile-pic" />
        </button>
  
        {dropdownOpen && (
          <div className="profile-dropdown">
            <div className="profile-header">
              <div className="profile-info">
                <strong>{user.name}</strong>
                <small>{user.role}</small>
              </div>
            </div>
            <ul className="profile-options">
              <li><FaUser className='prof-icon'/> Profile</li>
              <li><FaEnvelope className='prof-icon' /> Mail Inbox</li>
              {user.role === "admin" && (<li onClick={() => (window.location.href = "/crm/user-management")}><FaFileAlt className='prof-icon'/> Manage Users</li>)}
              <li><FaCog className='prof-icon'/> Settings</li>
              <li><FaQuestionCircle className='prof-icon'/> Help</li>
              <hr style={{ marginTop: '10px', marginBottom:'10px' }} />

              <li onClick={handleLogout}><FaUser  className='prof-icon'/> Log Out</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
  
};

export default Navbar;
