import React, { useEffect, useState } from "react";
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend
} from "recharts";

const ChartOverview = () => {
  const [leadData, setLeadData] = useState([]);
  const [salesData, setSalesData] = useState([]);
  const [leadTimeframe, setLeadTimeframe] = useState("Yearly");
  const [salesTimeframe, setSalesTimeframe] = useState("Yearly");

  useEffect(() => {
    setLeadData([
      { year: "2018", Hot: 100, Warm: 60, Cold: 40, Qualified: 70 },
      { year: "2019", Hot: 70, Warm: 80, Cold: 50, Qualified: 60 },
      { year: "2020", Hot: 90, Warm: 50, Cold: 20, Qualified: 80 },
      { year: "2021", Hot: 60, Warm: 30, Cold: 80, Qualified: 40 },
      { year: "2022", Hot: 110, Warm: 40, Cold: 20, Qualified: 60 },
      { year: "2023", Hot: 50, Warm: 90, Cold: 70, Qualified: 100 },
    ]);
    setSalesData([
      { month: "Jan", Income: 100, Revenue: 400, Profit: 700 },
      { month: "Feb", Income: 200, Revenue: 350, Profit: 650 },
      { month: "Mar", Income: 180, Revenue: 450, Profit: 680 },
      { month: "Apr", Income: 400, Revenue: 500, Profit: 700 },
      { month: "May", Income: 420, Revenue: 470, Profit: 710 },
      { month: "Jun", Income: 200, Revenue: 480, Profit: 740 },
      { month: "Jul", Income: 230, Revenue: 460, Profit: 720 },
      { month: "Aug", Income: 600, Revenue: 500, Profit: 750 },
      { month: "Sep", Income: 620, Revenue: 530, Profit: 770 },
      { month: "Oct", Income: 300, Revenue: 490, Profit: 660 },
      { month: "Nov", Income: 310, Revenue: 450, Profit: 680 },
      { month: "Dec", Income: 200, Revenue: 470, Profit: 740 },
    ]);
  }, []);

  return (
    <div className="charts-container">
      
      {/* Leads Overview Radar Chart */}
      <div className="chart-box">
        <div className="chart-header">
          <span className="chart-title">Leads Overview</span>
          <select
            className="chart-select"
            value={leadTimeframe}
            onChange={(e) => setLeadTimeframe(e.target.value)}
          >
            <option>Yearly</option>
            <option>Monthly</option>
            <option>Weekly</option>
          </select>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <RadarChart data={leadData}>
            <PolarGrid stroke="#e0e0e0" />
            <PolarAngleAxis dataKey="year" stroke="#666" />
            <PolarRadiusAxis angle={90} domain={[0, 150]} stroke="#666" />
            <Radar name="Hot Leads" dataKey="Hot" stroke="#FF8C00" fill="#FF8C00" fillOpacity={0.6} />
            <Radar name="Warm Leads" dataKey="Warm" stroke="#FFD700" fill="#FFD700" fillOpacity={0.6} />
            <Radar name="Cold Leads" dataKey="Cold" stroke="#1E90FF" fill="#1E90FF" fillOpacity={0.6} />
            <Radar name="Qualified" dataKey="Qualified" stroke="#32CD32" fill="#32CD32" fillOpacity={0.6} />
            <Legend align="center" verticalAlign="bottom" />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      {/* Sales Overview Area Chart */}
      <div className="linechart-box">
        <div className="chart-header">
          <span className="chart-title">Sales Overview</span>
          <div className="tab-buttons">
            {["Today", "Weekly", "Yearly"].map((label) => (
              <button
                key={label}
                className={`tab-button ${salesTimeframe === label ? "active" : ""}`}
                onClick={() => setSalesTimeframe(label)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={salesData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <XAxis dataKey="month" stroke="#666" />
            <YAxis stroke="#666" />
            <Tooltip />
            <Area type="monotone" dataKey="Income" stroke="#FF8C00" fill="#FF8C00" fillOpacity={0.3} />
            <Area type="monotone" dataKey="Revenue" stroke="#00C49F" fill="#00C49F" fillOpacity={0.3} />
            <Area type="monotone" dataKey="Profit" stroke="#FFD700" fill="#FFD700" fillOpacity={0.3} />
            <Legend align="center" verticalAlign="top" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

    </div>
  );
};

export default ChartOverview;