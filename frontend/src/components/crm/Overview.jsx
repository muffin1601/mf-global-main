import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';


const AnimatedCounter = ({ value, isPercentage }) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const start = 0;

    const cleanedValue = String(value).replace(/[^0-9.]/g, '');
    const end = parseFloat(cleanedValue);

    if (isNaN(end)) {
      setCount(value);
      return;
    }

    if (start === end) {
      setCount(end);
      return;
    }

    let totalIncrements = 20;
    let increment = end / totalIncrements;

    const timer = setInterval(() => {
      setCount(prevCount => {
        const newCount = prevCount + increment;
        if (newCount >= end) {
          clearInterval(timer);
          return end;
        }
        return newCount;
      });
    }, 50);

    return () => clearInterval(timer);
  }, [value]);


  return (
    <span>
      {isPercentage ? count.toFixed(2) : Math.round(count)}
    </span>
  );
};


const Overview = () => {
  const navigate = useNavigate();

  const [leads, setLeads] = useState(0);
  const [conversionRate, setConversionRate] = useState(0);
  const [assignedLeads, setAssignedLeads] = useState(0);
  const [unassignedLeads, setUnassignedLeads] = useState(0);
  const [newLeads, setNewLeads] = useState(0);
  const [myLeads, setMyLeads] = useState(0);
  const [totalConversions, setTotalconversions] = useState(0);
  const [todayFollowUps, setTodayFollowups] = useState(0);
  const [upcomingFollowUps, setUpcomingFollowups] = useState(0);
  const [trendingLeads, settrendingLeads] = useState(0);
  const [myTrendingLeads, setMyTrendingLeads] = useState(0);

  const user = JSON.parse(localStorage.getItem('user')) || {
    name: "Mr.Henry",
    profile: "/assets/profile.jpg",
    role: "user"
  };

  useEffect(() => {
    const fetchLeadsAndConversion = async () => {
      try {
        const countsRes = await axios.get(`${import.meta.env.VITE_API_URL}/overview/counts`);
        setLeads(countsRes.data.totalClients);
        setNewLeads(countsRes.data.newClients);
        setAssignedLeads(countsRes.data.assignedClients);
        setUnassignedLeads(countsRes.data.unassignedClients);
        setConversionRate(countsRes.data.convertedClients);
        settrendingLeads(countsRes.data.trendingClients);
        
        const userRes = await axios.get(`${import.meta.env.VITE_API_URL}/overview/user-stats/${user.name}`);
        setMyLeads(userRes.data.myLeads);
        setTotalconversions(userRes.data.myConversions);
        setTodayFollowups(userRes.data.todaysFollowUps);
        setUpcomingFollowups(userRes.data.upcomingFollowUps);
        setMyTrendingLeads(userRes.data.myTrendingLeads);

      } catch (error) {
        console.error('Error fetching leads or conversion rate:', error);
      }
    };

    fetchLeadsAndConversion();
  }, [user.name]);


  const icons = {
    ChartBar: (
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20V10"></path>
        <path d="M18 20V4"></path>
        <path d="M6 20v-6"></path>
      </svg>
    ),
    Percentage: (
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 5L5 19"></path>
        <circle cx="6.5" cy="6.5" r="2.5"></circle>
        <circle cx="17.5" cy="17.5" r="2.5"></circle>
      </svg>
    ),
    Tasks: (
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="18" height="18" x="3" y="4" rx="2" ry="2"></rect>
        <line x1="16" y1="2" x2="16" y2="6"></line>
        <line x1="8" y1="2" x2="8" y2="6"></line>
        <line x1="3" y1="10" x2="21" y2="10"></line>
      </svg>
    ),
    ProjectDiagram: (
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path>
        <circle cx="12" cy="7" r="4"></circle>
      </svg>
    ),
    UserPlus: (
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
        <circle cx="8.5" cy="7" r="4"></circle>
        <line x1="20" y1="8" x2="20" y2="14"></line>
        <line x1="23" y1="11" x2="17" y2="11"></line>
      </svg>
    ),
    UserCheck: (
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
        <circle cx="8.5" cy="7" r="4"></circle>
        <polyline points="17 11 19 13 23 9"></polyline>
      </svg>
    ),
    Handshake: (
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 15s-2 1-3.5 0A2.5 2.5 0 0 1 5 13c0-1.5 1-2.5 1.5-3.5a4 4 0 0 1 4-1.5 4 4 0 0 1 3.5 2.5V11"></path>
        <path d="M15 11s2 1 3.5 0A2.5 2.5 0 0 1 20 13c0-1.5-1-2.5-1.5-3.5a4 4 0 0 0-4-1.5 4 4 0 0 0-3.5 2.5V11"></path>
        <path d="M15 15V9"></path>
        <path d="M11 11v-2"></path>
      </svg>
    ),
    BellSlash: (
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
        <path d="M18.63 13A17.91 17.91 0 0 1 18 10c0-4.17-3.69-7.58-8.14-7.94"></path>
        <path d="M14 11a13.9 13.9 0 0 1-1.85 4"></path>
        <line x1="2.05" y1="2.05" x2="21.95" y2="21.95"></line>
        <path d="M8.28 2.21A2 2 0 0 1 10 2c.94 0 1.84.18 2.56.5"></path>
      </svg>
    ),
    Calendar: (
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
        <line x1="16" y1="2" x2="16" y2="6"></line>
        <line x1="8" y1="2" x2="8" y2="6"></line>
        <line x1="3" y1="10" x2="21" y2="10"></line>
      </svg>
    ),
    Fire: (
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8.5 15A4.5 4.5 0 0 0 13 10c0-1.5-1-3-1.5-4C10.5 4 10 2.5 10 2.5s-2 2-3 4c-1.5 3-2.5 5.5-2 7.5a4.5 4.5 0 0 0 8 2.5"></path>
        <path d="M13 18c-3.5 0-6-3-6-5s2.5-5 6-5 6 3 6 5-2.5 5-6 5z"></path>
      </svg>
    ),
  };

  const cards = [
    {
      title: 'Total Leads',
      value: leads,
      icon: icons.ChartBar,
      styleClass: 'card-total-leads',
      route: '/crm/lead-management',
      role: 'both',
      disabled: user.role === 'user'
    },
    {
      title: 'Conversion Rate',
      value: conversionRate,
      icon: icons.Percentage,
      styleClass: 'card-conversion-rate',
      route: '/crm/won-leads',
      role: 'admin'
    },
    {
      title: 'Assigned Leads',
      value: assignedLeads,
      icon: icons.Tasks,
      styleClass: 'card-assigned-leads',
      route: '/crm/assigned-leads',
      role: 'admin'
    },
    {
      title: 'Unassigned Leads',
      value: unassignedLeads,
      icon: icons.ProjectDiagram,
      styleClass: 'card-unassigned-leads',
      route: '/crm/unassigned-leads',
      role: 'admin'
    },
    {
      title: 'New Leads',
      value: newLeads,
      icon: icons.UserPlus,
      styleClass: 'card-new-leads',
      route: '/crm/new-leads',
      role: 'admin'
    },
    {
      title: 'Trending Leads',
      value: trendingLeads,
      icon: icons.Fire,
      styleClass: 'card-trending-leads',
      route: '/crm/trending-leads',
      role: 'admin'
    },
    {
      title: 'My Leads',
      value: myLeads,
      icon: icons.UserCheck,
      styleClass: 'card-my-leads',
      route: '/crm/my-leads',
      role: 'user'
    },
    {
      title: 'My Conversions',
      value: totalConversions,
      icon: icons.Handshake,
      styleClass: 'card-my-conversions',
      route: '/crm/conversions',
      role: 'user'
    },
    {
      title: "Today's Follow-ups",
      value: todayFollowUps,
      icon: icons.BellSlash,
      styleClass: 'card-today-followups',
      route: '/crm/today-followups',
      role: 'user'
    },
    {
      title: 'Upcoming Follow-ups',
      value: upcomingFollowUps,
      icon: icons.Calendar,
      styleClass: 'card-upcoming-followups',
      route: '/crm/upcoming-followups',
      role: 'user'
    },
    {
      title: 'My Trending Leads',
      value: myTrendingLeads,
      icon: icons.Fire,
      styleClass: 'card-my-trending-leads',
      route: '/crm/my-trending-leads',
      role: 'user'
    }
  ];

  const filteredCards = cards.filter(card => card.role === user.role || card.role === 'both');

  return (
    <div className="dashboard-overview">
      <div className="dashboard-header">
        <div>
          <p className="breadcrumb">Dashboards <span>→</span> Lead Management</p>
          <h2>Hello, {user.name} 👋</h2>
        </div>
        <div className="profile-animation">
          <img
            src="https://laravelui.spruko.com/xintra/build/assets/images/faces/2.jpg"
            alt={user.name}
            className="profile-img"
            style={{
              borderRadius: '50%',
              width: 100,
              height: 100,
              boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
              animation: 'pulse 1.5s infinite'
            }}
          />
          <style>
            {` 
                @keyframes pulse {
  0% { box-shadow: 0 0 0 0 rgba(255, 140, 0, 0.4); } /* Dark Orange (rgba) */
  70% { box-shadow: 0 0 0 16px rgba(255, 140, 0, 0); } /* Fades out to transparent */
  100% { box-shadow: 0 0 0 0 rgba(255, 140, 0, 0); } /* Final transparent state */
}
            `}
          </style>
        </div>
      </div>

      <div className="dashboard-cards">
        {filteredCards.map((card, index) => (
          <div
            key={index}
            className={`dashboard-card ${card.disabled ? 'disabled' : ''}`}
            onClick={() => {
              if (!card.disabled) {
                navigate(card.route);
              }
            }}
          >
            <div className={`card-icon ${card.styleClass}`}>
              {card.icon}
            </div>
            <div className="card-content">
              <p className="card-title">{card.title}</p>
              <h3 className="card-value">
                <AnimatedCounter
                  value={card.value}
                  isPercentage={card.title === 'Conversion Rate'}
                />
                {card.title === 'Conversion Rate' ? '%' : ''}
              </h3>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Overview;
