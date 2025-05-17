import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FaChartBar, FaPercentage, FaTasks, FaProjectDiagram, FaUserPlus
} from 'react-icons/fa';

import '../../styles/crm/Overview.css';
import axios from 'axios';

const Overview = () => {
  const navigate = useNavigate();
  const [leads, setLeads] = useState([]);
  const [conversionRate, setConversionRate] = useState([]);
  const [assignedLeads, setAssignedLeads] = useState([]);
  const [unassignedLeads, setUnassignedLeads] = useState([]);
  const [newLeads, setNewLeads] = useState([]);
  
  const user = JSON.parse(localStorage.getItem('user')) || {
    name: "Mr.Henry",
    profile: "/assets/profile.jpg"
  };

useEffect(() => {
  const fetchLeadsAndConversion = async () => {
    try {
      // Fetch all clients
      const leadsRes = await axios.get(`${import.meta.env.VITE_API_URL}/all-clients`);
      setLeads(leadsRes.data.length);

      const newleads = await axios.get(`${import.meta.env.VITE_API_URL}/new-clients`);
      setNewLeads(newleads.data.length);

      // Fetch conversion rate
      const conversionRes = await axios.get(`${import.meta.env.VITE_API_URL}/get-details-clients`);
      console.log(conversionRes.data.convertedCount);
      setConversionRate(conversionRes.data.conversionRate);
      setAssignedLeads(conversionRes.data.assignedCount);
      setUnassignedLeads(conversionRes.data.unassignedCount)
    } catch (error) {
      console.error('Error fetching leads or conversion rate:', error);
    }
  };

  fetchLeadsAndConversion();
}, []);


  const cards = [
    {
      title: 'Total Leads',
      value: leads || '0',
      icon: <FaChartBar />,
      change: '+2.5%',
      color: 'white',
      bg: '#ff9e3b', // Lighter shade of #f57c00
      route: '/crm/lead-management'
    },
    {
      title: 'Conversion Rate',
      value: conversionRate || '0%',
      icon: <FaPercentage />,
      change: '-2.5%',
      color: 'white',
      bg: '#d85ed7', // Lighter shade of #ab47bc
      negative: true,
      route: '#'
    },
    {
      title: 'Assigned Leads',
      value: assignedLeads || '0',
      icon: <FaTasks />,
      change: '+2.5%',
      color: 'white',
      bg: '#f36d95', // Lighter shade of #ec407a
      route: '/crm/assigned-leads'
    },
    {
      title: 'Unnassigned Leads',
      value: unassignedLeads || '0',
      icon: <FaProjectDiagram />,
      change: '+2.5%',
      color: 'white',
      bg: '#ff8c62', // Lighter shade of #ff7043
      route: '/crm/unassigned-leads'
    },
    {
      title: 'New Leads',
      value: newLeads || '0',
      icon: <FaUserPlus />,
      change: '-2.5%',
      color: 'white',
      bg: '#d18ade', // Lighter shade of #ba68c8
      negative: true,
      route: '/crm/new-leads'
    }
  ];
  

  return (
    <div className="dashboard-overview">
      <div className="dashboard-header">
        <div>
          <p className="breadcrumb">Dashboards <span>→</span> Lead Management</p>
          <h2>Hello, {user.name} 👋</h2>
        </div>
        <div className="dashboard-user-actions">
          <button className="btn filter">Filter</button>
          <button className="btn share">Share</button>
          {/* <img src={user.profile} alt="Profile" className="dashboard-profile-pic" /> */}
        </div>
      </div>

      <div className="dashboard-cards">
        {cards.map((card, index) => (
          <div
            key={index}
            className="dashboard-card"
            onClick={() => navigate(card.route)}
          >
            <div className="card-icon" style={{ backgroundColor: card.bg, color: card.color, boxShadow: `0px 2px 6px ${card.bg}`}}>
              {card.icon}
            </div>
            <div className="card-content">
              <p className="card-title">{card.title}</p>
              <h3 className="card-value">{card.value}</h3>
              <span className={`card-change ${card.negative ? 'negative' : 'positive'}`}>
                {card.negative ? '↓' : '↑'} {card.change}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Overview;
