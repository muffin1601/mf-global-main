import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FaChartBar, FaPercentage, FaTasks, FaProjectDiagram, FaUserPlus, FaUserCheck,
<<<<<<< HEAD
  FaHandshake, FaBellSlash, FaCalendarAlt, FaFire
=======
  FaHandshake, FaBellSlash, FaCalendarAlt
>>>>>>> e535ab6584991d2da1192b8eb158a59d2165b973
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
  const [myLeads, setMyLeads] = useState([]);
  const [totalConversions, setTotalconversions] = useState([]);
  const [todayFollowUps, setTodayFollowups] = useState([]);
  const [upcomingFollowUps, setUpcomingFollowups] = useState([]);
<<<<<<< HEAD
  const [trendingLeads, settrendingLeads] = useState([]);
  const [myTrendingLeads, setMyTrendingLeads] = useState([]);
=======
>>>>>>> e535ab6584991d2da1192b8eb158a59d2165b973

  const user = JSON.parse(localStorage.getItem('user')) || {
    name: "Mr.Henry",
    profile: "/assets/profile.jpg",
    role: "user" // fallback role if none exists
  };

  useEffect(() => {
    const fetchLeadsAndConversion = async () => {
      try {
        const leadsRes = await axios.get(`${import.meta.env.VITE_API_URL}/all-clients`);
        setLeads(leadsRes.data.length);

        const newleads = await axios.get(`${import.meta.env.VITE_API_URL}/new-clients`);
        setNewLeads(newleads.data.length);

        const conversionRes = await axios.get(`${import.meta.env.VITE_API_URL}/get-details-clients`);
        setConversionRate(conversionRes.data.conversionRate);
        setAssignedLeads(conversionRes.data.assignedCount);
        setUnassignedLeads(conversionRes.data.unassignedCount);
<<<<<<< HEAD
        settrendingLeads(conversionRes.data.trendingLeads.length);
=======
>>>>>>> e535ab6584991d2da1192b8eb158a59d2165b973

        const UserRes = await axios.get (`${import.meta.env.VITE_API_URL}/user-dashboard-stats/${user.name}`);
        setMyLeads(UserRes.data.myLeads.length);
        setTotalconversions(UserRes.data.myConversions.length);
        setTodayFollowups(UserRes.data.todaysFollowUps.length);
        setUpcomingFollowups(UserRes.data.upcomingFollowUps.length);
<<<<<<< HEAD
        setMyTrendingLeads (UserRes.data.myTrendingLeads.length);
=======
>>>>>>> e535ab6584991d2da1192b8eb158a59d2165b973
        
      } catch (error) {
        console.error('Error fetching leads or conversion rate:', error);
      }
    };

    fetchLeadsAndConversion();
  }, []);

  const cards = [
<<<<<<< HEAD
  // Admin cards
  {
    title: 'Total Leads',
    value: leads || '0',
    icon: <FaChartBar />,
    change: '+2.5%',
    color: 'white',
    bg: '#ff9e3b',
    route: '/crm/lead-management',
    role: 'both'
  },
  {
    title: 'Conversion Rate',
    value: conversionRate || '0%',
    icon: <FaPercentage />,
    change: '-2.5%',
    color: 'white',
    bg: '#d85ed7',
    negative: true,
    route: '/crm/won-leads',
    role: 'admin'
  },
  {
    title: 'Assigned Leads',
    value: assignedLeads || '0',
    icon: <FaTasks />,
    change: '+2.5%',
    color: 'white',
    bg: '#f36d95',
    route: '/crm/assigned-leads',
    role: 'admin'
  },
  {
    title: 'Unassigned Leads',
    value: unassignedLeads || '0',
    icon: <FaProjectDiagram />,
    change: '+2.5%',
    color: 'white',
    bg: '#ff8c62',
    route: '/crm/unassigned-leads',
    role: 'admin'
  },
  {
    title: 'New Leads',
    value: newLeads || '0',
    icon: <FaUserPlus />,
    change: '-2.5%',
    color: 'white',
    bg: '#d18ade',
    negative: true,
    route: '/crm/new-leads',
    role: 'admin'
  },
  {
    title: 'Trending Leads',
    value: trendingLeads || '0',
    icon: <FaFire />,
    change: '+6.3%',
    color: 'white',
    bg: '#ff7043',
    route: '/crm/trending-leads',
    role: 'admin'
  },

  // User cards
  {
    title: 'My Leads',
    value: myLeads || '0',
    icon: <FaUserCheck />,
    change: '+1.8%',
    color: 'white',
    bg: '#64b5f6',
    route: '/crm/my-leads',
    role: 'user'
  },
  {
    title: 'My Conversions',
    value: totalConversions || '0',
    icon: <FaHandshake />,
    change: '+3.2%',
    color: 'white',
    bg: '#81c784',
    route: '/crm/conversions',
    role: 'user'
  },
  {
    title: "Today's Follow-ups",
    value: todayFollowUps || '0',
    icon: <FaBellSlash />,
    change: '+0.5%',
    color: 'white',
    bg: '#ffd54f',
    route: '/crm/today-followups',
    role: 'user'
  },
  {
    title: 'Upcoming Follow-ups',
    value: upcomingFollowUps || '0',
    icon: <FaCalendarAlt />,
    change: '+4.0%',
    color: 'white',
    bg: '#4db6ac',
    route: '/crm/upcoming-followups',
    role: 'user'
  },
  {
    title: 'My Trending Leads',
    value: myTrendingLeads || '0',
    icon: <FaFire />,
    change: '+5.0%',
    color: 'white',
    bg: '#ff8a65',
    route: '/crm/my-trending-leads',
    role: 'user'
  }
];
=======
    // Admin cards
    {
      title: 'Total Leads',
      value: leads || '0',
      icon: <FaChartBar />,
      change: '+2.5%',
      color: 'white',
      bg: '#ff9e3b',
      route: '/crm/lead-management',
      role: 'both'
    },
    {
      title: 'Conversion Rate',
      value: conversionRate || '0%',
      icon: <FaPercentage />,
      change: '-2.5%',
      color: 'white',
      bg: '#d85ed7',
      negative: true,
      route: '#',
      role: 'admin'
    },
    {
      title: 'Assigned Leads',
      value: assignedLeads || '0',
      icon: <FaTasks />,
      change: '+2.5%',
      color: 'white',
      bg: '#f36d95',
      route: '/crm/assigned-leads',
      role: 'admin'
    },
    {
      title: 'Unassigned Leads',
      value: unassignedLeads || '0',
      icon: <FaProjectDiagram />,
      change: '+2.5%',
      color: 'white',
      bg: '#ff8c62',
      route: '/crm/unassigned-leads',
      role: 'admin'
    },
    {
      title: 'New Leads',
      value: newLeads || '0',
      icon: <FaUserPlus />,
      change: '-2.5%',
      color: 'white',
      bg: '#d18ade',
      negative: true,
      route: '/crm/new-leads',
      role: 'admin'
    },

    // User cards
    {
      title: 'My Leads',
      value: myLeads || '0',
      icon: <FaUserCheck />,
      change: '+1.8%',
      color: 'white',
      bg: '#64b5f6',
      route: '/crm/my-leads',
      role: 'user'
    },
    {
      title: 'My Conversions',
      value: totalConversions || '0',
      icon: <FaHandshake />,
      change: '+3.2%',
      color: 'white',
      bg: '#81c784',
      route: '/crm/conversions',
      role: 'user'
    },
    {
      title: "Today's Follow-ups",
      value: todayFollowUps || '0',
      icon: <FaBellSlash />,
      change: '+0.5%',
      color: 'white',
      bg: '#ffd54f',
      route: '/crm/today-followups',
      role: 'user'
    },
    {
      title: 'Upcoming Follow-ups',
      value: upcomingFollowUps || '0',
      icon: <FaCalendarAlt />,
      change: '+4.0%',
      color: 'white',
      bg: '#4db6ac',
      route: '/crm/upcoming-followups',
      role: 'user'
    }
  ];
>>>>>>> e535ab6584991d2da1192b8eb158a59d2165b973

  // 🔍 Filter cards based on user role
  const filteredCards = cards.filter(card => card.role === user.role || card.role === 'both');

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
        </div>
      </div>

      <div className="dashboard-cards">
        {filteredCards.map((card, index) => (
          <div
            key={index}
            className="dashboard-card"
            onClick={() => navigate(card.route)}
          >
            <div className="card-icon" style={{ backgroundColor: card.bg, color: card.color, boxShadow: `0px 2px 6px ${card.bg}` }}>
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
