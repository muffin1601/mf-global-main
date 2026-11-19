"use client";

import { Area, AreaChart, Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AXIS, ChartCard, ChartEmpty, GRID, tooltipProps } from "@/components/charts/chart-kit";

type Props = {
  statusData: { status: string; count: number }[];
  perDay: { date: string; count: number }[];
  perEmployee?: { name: string; deals: number }[];
};

const shortDate = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-IN", { day: "2-digit", month: "short", timeZone: "UTC" });

// Single-series charts: one hue, no legend (the title names the series), values on hover + bar-end labels.
export function DashboardCharts({ statusData, perDay, perEmployee }: Props) {
  const totalDays = perDay.reduce((n, d) => n + d.count, 0);
  const employees = (perEmployee ?? []).filter((e) => e.deals > 0).sort((a, b) => b.deals - a.deals).slice(0, 10);
  return (
    <div className="grid-dashboard">
      <ChartCard
        title="Lead acquisition" description={`Leads added per day · last 30 days (IST) · ${totalDays.toLocaleString("en-IN")} total`} height={270}
        summary={`Leads added per day over the last 30 days, ${totalDays} in total.`}
      >
        {totalDays === 0 ? <ChartEmpty message="No leads were added in the last 30 days." /> : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={perDay} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="perDayFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.18} />
                  <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid {...GRID} />
              <XAxis dataKey="date" {...AXIS} tickFormatter={shortDate} minTickGap={24} />
              <YAxis {...AXIS} allowDecimals={false} width={36} />
              <Tooltip {...tooltipProps} cursor={{ stroke: "var(--border-strong)", strokeWidth: 1 }} labelFormatter={(d) => shortDate(String(d))} />
              <Area type="monotone" dataKey="count" name="Leads added" stroke="var(--chart-1)" strokeWidth={2} fill="url(#perDayFill)" activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--surface)" }} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      <ChartCard title="Pipeline by status" description="Current status of every lead in scope" height={270}>
        {statusData.every((s) => s.count === 0) ? <ChartEmpty message="No leads yet." /> : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={statusData} layout="vertical" margin={{ top: 4, right: 40, left: 8, bottom: 0 }} barCategoryGap={8}>
              <CartesianGrid {...GRID} vertical horizontal={false} />
              <XAxis type="number" {...AXIS} allowDecimals={false} hide />
              <YAxis type="category" dataKey="status" {...AXIS} width={92} />
              <Tooltip {...tooltipProps} />
              <Bar dataKey="count" name="Leads" fill="var(--chart-1)" radius={[0, 4, 4, 0]} maxBarSize={22}>
                <LabelList dataKey="count" position="right" style={{ fill: "var(--text-2)", fontSize: 11, fontWeight: 600 }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {perEmployee ? (
        <ChartCard title="Conversions by employee" description="Won leads per assignee · all time · top 10" height={270}>
          {employees.length === 0 ? <ChartEmpty message="No won leads yet." /> : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={employees} layout="vertical" margin={{ top: 4, right: 36, left: 8, bottom: 0 }} barCategoryGap={8}>
                <CartesianGrid {...GRID} vertical horizontal={false} />
                <XAxis type="number" {...AXIS} allowDecimals={false} hide />
                <YAxis type="category" dataKey="name" {...AXIS} width={110} />
                <Tooltip {...tooltipProps} />
                <Bar dataKey="deals" name="Won leads" fill="var(--chart-2)" radius={[0, 4, 4, 0]} maxBarSize={22}>
                  <LabelList dataKey="deals" position="right" style={{ fill: "var(--text-2)", fontSize: 11, fontWeight: 600 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      ) : null}
    </div>
  );
}
