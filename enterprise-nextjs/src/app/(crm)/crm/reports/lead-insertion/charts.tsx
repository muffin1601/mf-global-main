"use client";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export type ChartRow = { label: string; total: number } & Record<string, number | string>;
export type SourceSeries = { key: string; label: string; color: string };

// Both charts are fed by the same aggregate rows as the period table.
export function InsertionCharts({ rows, series }: { rows: ChartRow[]; series: SourceSeries[] }) {
  return (
    <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
      <section className="card" aria-label="Leads inserted per period">
        <strong>Leads inserted per period</strong>
        <div style={{ height: 260 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" fontSize={11} />
              <YAxis allowDecimals={false} fontSize={11} />
              <Tooltip />
              <Bar dataKey="total" name="Leads" fill="#2563eb" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
      <section className="card" aria-label="Leads inserted by source">
        <strong>By source</strong>
        <div style={{ height: 260 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" fontSize={11} />
              <YAxis allowDecimals={false} fontSize={11} />
              <Tooltip />
              <Legend />
              {series.map((s) => <Bar key={s.key} dataKey={s.key} name={s.label} stackId="src" fill={s.color} />)}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
}
