import React, { useEffect, useState } from "react";
import {
    Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
    AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend
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
        <div className="charts-container">
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
                <RadarChart
                    cx={150}
                    cy={150}
                    outerRadius={100}
                    width={300}
                    height={300}
                    // margin={{  bottom: 50 }}
                    data={leadData}
                >
                    <PolarGrid />
                    <PolarAngleAxis dataKey="year" />
                    <PolarRadiusAxis />
                    <Radar name="Hot Leads" dataKey="Hot" stroke="#C75C16" fill="#C75C16" fillOpacity={0.6} />
                    <Radar name="Warm Leads" dataKey="Warm" stroke="#E29BF2" fill="#E29BF2" fillOpacity={0.6} />
                    <Radar name="Cold Leads" dataKey="Cold" stroke="#FFB6D2" fill="#FFB6D2" fillOpacity={0.6} />
                    <Radar name="Qualified" dataKey="Qualified" stroke="#F39FD1" fill="#F39FD1" fillOpacity={0.6} />
                    <Legend verticalAlign="bottom" height={36} />
                </RadarChart>
            </div>

            <div className="linechart-box">
                <div className="chart-header">
                    <span className="chart-title">Sales Overview</span>
                    <div className="tab-buttons">
                        {["Today", "Weekly", "Yearly"].map((label) => (
                            <button
                                key={label}
                                className={`tab-button${salesTimeframe === label ? " active" : ""}`}
                                onClick={() => setSalesTimeframe(label)}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                </div>
                <ResponsiveContainer width={800} height={300} marginTop={50}>
                    <AreaChart data={salesData}>
                        <XAxis dataKey="month" />
                        <YAxis />
                        <Tooltip />
                        <Area type="monotone" dataKey="Income" stroke="#C75C16" fill="#FCD9BD" />
                        <Area type="monotone" dataKey="Revenue" stroke="#E29BF2" fill="#F4D9F8" />
                        <Area type="monotone" dataKey="Profit" stroke="#FFB6D2" fill="#FFDCEB" strokeDasharray="5 5" />
                        <Legend verticalAlign="bottom" height={36} />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default ChartOverview;
