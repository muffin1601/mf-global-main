import React, { useEffect, useState } from "react";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import "../../styles/crm/ChartOverview.css";

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
    <div className="chart-overview__container">
     
      <div className="chart-overview__leads-box">
        <div className="chart-overview__leads-header">
          <span className="chart-overview__leads-title">Leads Overview</span>
          <select
            className="chart-overview__leads-select"
            value={leadTimeframe}
            onChange={(e) => setLeadTimeframe(e.target.value)}
          >
            <option>Yearly</option>
            <option>Monthly</option>
            <option>Weekly</option>
          </select>
        </div>
        <ResponsiveContainer
          width="100%"
          height={300}
          className="chart-overview__leads-responsive"
        >
          <RadarChart
            data={leadData}
            outerRadius={120}
            className="chart-overview__leads-radarchart"
          >
            <PolarGrid stroke="#e0e0e0" className="chart-overview__leads-grid" />
            <PolarAngleAxis
              dataKey="year"
              stroke="#666"
              className="chart-overview__leads-angleaxis"
            />
            <PolarRadiusAxis
              angle={90}
              domain={[0, 150]}
              stroke="#666"
              className="chart-overview__leads-radiusaxis"
            />
            <Radar
              name="Hot Leads"
              dataKey="Hot"
              stroke="#FF8C00"
              fill="#FF8C00"
              fillOpacity={0.6}
              className="chart-overview__leads-radar-hot"
            />
            <Radar
              name="Warm Leads"
              dataKey="Warm"
              stroke="#FFD700"
              fill="#FFD700"
              fillOpacity={0.6}
              className="chart-overview__leads-radar-warm"
            />
            <Radar
              name="Cold Leads"
              dataKey="Cold"
              stroke="#1E90FF"
              fill="#1E90FF"
              fillOpacity={0.6}
              className="chart-overview__leads-radar-cold"
            />
            <Radar
              name="Qualified"
              dataKey="Qualified"
              stroke="#32CD32"
              fill="#32CD32"
              fillOpacity={0.6}
              className="chart-overview__leads-radar-qualified"
            />
            <Legend
              align="center"
              verticalAlign="bottom"
              className="chart-overview__leads-legend"
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      
      <div className="chart-overview__sales-box">
        <div className="chart-overview__sales-header">
          <span className="chart-overview__sales-title">Sales Overview</span>
          <div className="chart-overview__sales-tabs">
            {["Today", "Weekly", "Yearly"].map((label) => (
              <button
                key={label}
                className={`chart-overview__sales-tab ${
                  salesTimeframe === label ? "chart-overview__sales-tab--active" : ""
                }`}
                onClick={() => setSalesTimeframe(label)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <ResponsiveContainer
          width="100%"
          height={300}
          className="chart-overview__sales-responsive"
        >
          <AreaChart
            data={salesData}
            margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
            className="chart-overview__sales-areachart"
          >
            <XAxis
              dataKey="month"
              stroke="#666"
              className="chart-overview__sales-xaxis"
            />
            <YAxis stroke="#666" className="chart-overview__sales-yaxis" />
            <Tooltip className="chart-overview__sales-tooltip" />
            <Area
              type="monotone"
              dataKey="Income"
              stroke="#FF8C00"
              fill="#FF8C00"
              fillOpacity={0.3}
              className="chart-overview__sales-area-income"
            />
            <Area
              type="monotone"
              dataKey="Revenue"
              stroke="#00C49F"
              fill="#00C49F"
              fillOpacity={0.3}
              className="chart-overview__sales-area-revenue"
            />
            <Area
              type="monotone"
              dataKey="Profit"
              stroke="#FFD700"
              fill="#FFD700"
              fillOpacity={0.3}
              className="chart-overview__sales-area-profit"
            />
            <Legend
              align="center"
              verticalAlign="top"
              className="chart-overview__sales-legend"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default ChartOverview;
