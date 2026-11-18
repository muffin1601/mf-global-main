"use client";

import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Props = {
  statusData: { status: string; count: number }[];
  perDay: { date: string; count: number }[];
  perEmployee?: { name: string; deals: number }[];
};

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card" style={{ minWidth: 0 }}>
      <strong>{title}</strong>
      <div style={{ height: 260, padding: "0 1rem 1rem" }}>{children}</div>
    </section>
  );
}

export function DashboardCharts({ statusData, perDay, perEmployee }: Props) {
  return (
    <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))", marginTop: "1.25rem" }}>
      <Card title="Leads by status">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={statusData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="status" fontSize={11} />
            <YAxis allowDecimals={false} fontSize={11} />
            <Tooltip />
            <Bar dataKey="count" name="Leads" fill="#2563eb" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>
      <Card title="Leads added per day (last 30 days, IST)">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={perDay}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="date" fontSize={11} tickFormatter={(d: string) => d.slice(5)} />
            <YAxis allowDecimals={false} fontSize={11} />
            <Tooltip />
            <Line type="monotone" dataKey="count" name="Leads" stroke="#2563eb" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </Card>
      {perEmployee && (
        <Card title="Conversions per employee">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={perEmployee}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" fontSize={11} />
              <YAxis allowDecimals={false} fontSize={11} />
              <Tooltip />
              <Bar dataKey="deals" name="Won leads" fill="#16a34a" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}
    </div>
  );
}
