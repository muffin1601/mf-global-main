"use client";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AXIS, ChartCard, GRID, tooltipProps } from "@/components/charts/chart-kit";

export type ChartRow = { label: string; total: number } & Record<string, number | string>;
export type SourceSeries = { key: string; label: string; color: string };

// Both charts are fed by the same aggregate rows as the period table (which is the accessible table view).
export function InsertionCharts({ rows, series }: { rows: ChartRow[]; series: SourceSeries[] }) {
  return (
    <div className="grid-auto">
      <ChartCard title="Leads inserted per period" description="Total insertions in each period">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid {...GRID} />
            <XAxis dataKey="label" {...AXIS} minTickGap={12} />
            <YAxis {...AXIS} allowDecimals={false} width={36} />
            <Tooltip {...tooltipProps} />
            <Bar dataKey="total" name="Leads" fill="var(--chart-1)" radius={[4, 4, 0, 0]} maxBarSize={36} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
      <ChartCard title="By source" description="Insertions per period, stacked by source">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid {...GRID} />
            <XAxis dataKey="label" {...AXIS} minTickGap={12} />
            <YAxis {...AXIS} allowDecimals={false} width={36} />
            <Tooltip {...tooltipProps} />
            {series.length > 1 ? <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: "var(--text-2)" }} /> : null}
            {series.map((s, i) => (
              <Bar
                key={s.key} dataKey={s.key} name={s.label} stackId="src" fill={s.color} stroke="var(--surface)" strokeWidth={1}
                radius={i === series.length - 1 ? [4, 4, 0, 0] : undefined} maxBarSize={36}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}
