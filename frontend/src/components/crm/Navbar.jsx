import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { logout } from '../../redux/authSlice';
import { FaBell,   FaMoon ,FaFileAlt, FaUser, FaSearch } from 'react-icons/fa';
import { IoChevronBackOutline  } from 'react-icons/io5';
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
    <div className="premium-navbar-container">
      
      <div className="premium-navbar-left">
        <button className="premium-back-button" onClick={() => navigate(-1)}>
          <IoChevronBackOutline />
        </button>
  
        <div className="premium-navbar-search">
          <FaSearch className="premium-search-icon" />
          <input type="text" placeholder="Search anything here ..." className="premium-search-input" />
        </div>
      </div>
  
      
      <div className="premium-navbar-right">
        
        <button className="premium-icon-btn"><FaMoon /></button>
        
        <button className="premium-icon-btn">
          <FaBell />
          <span className="premium-dot" />
        </button>
        
        <button className="premium-profile-btn" onClick={toggleDropdown}>
          <img src="https://laravelui.spruko.com/xintra/build/assets/images/faces/2.jpg" alt="Profile" className="premium-profile-pic" />
        </button>
  
        {dropdownOpen && (
          <div className="premium-profile-dropdown">
            <div className="premium-dropdown-header">
              <div className="premium-profile-info">
                <strong>{user.name}</strong>
                <small>{user.role}</small>
              </div>
            </div>
            <ul className="premium-profile-options">
              <li><FaUser className='premium-prof-icon'/> Profile</li>
              
              {user.role === "admin" && (<li onClick={() => (window.location.href = "/crm/user-management")}><FaFileAlt className='premium-prof-icon'/> Manage Users</li>)}
              
              <hr className="premium-divider" />
              <li onClick={handleLogout}><FaUser className='premium-prof-icon'/> Log Out</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
  
};

export default Navbar;
