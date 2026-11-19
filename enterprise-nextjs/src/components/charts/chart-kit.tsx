"use client";

import type { ReactNode } from "react";

/**
 * Shared chart chrome. Colours come from CSS tokens (--chart-*, --chart-grid, --chart-axis), validated for
 * both themes with the dataviz palette checker, so charts switch with the theme without re-rendering.
 */
export const AXIS = { fontSize: 11, tickLine: false, axisLine: false, stroke: "var(--chart-axis)", tick: { fill: "var(--chart-axis)" } } as const;
export const GRID = { stroke: "var(--chart-grid)", vertical: false } as const;
export const SERIES = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)", "var(--chart-6)", "var(--chart-7)", "var(--chart-8)"];

export const tooltipProps = {
  cursor: { fill: "var(--surface-3)", stroke: "var(--border-strong)", strokeWidth: 1 },
  contentStyle: {
    background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, boxShadow: "var(--shadow-md)",
    color: "var(--text)", fontSize: 12, padding: "8px 10px",
  },
  labelStyle: { color: "var(--text-3)", fontWeight: 500, marginBottom: 4 },
  itemStyle: { color: "var(--text)", padding: 0 },
} as const;

export function ChartCard({ title, description, children, height = 260, actions, summary }: {
  title: string; description?: string; children: ReactNode; height?: number; actions?: ReactNode; summary?: string;
}) {
  return (
    <section className="card flush" aria-label={title}>
      <div className="section-head" style={{ borderBottom: 0, paddingBottom: 4 }}>
        <div>
          <h3>{title}</h3>
          {description ? <p>{description}</p> : null}
        </div>
        {actions}
      </div>
      {summary ? <p className="sr-only">{summary}</p> : null}
      <div style={{ height, padding: "4px 12px 12px 4px" }}>{children}</div>
    </section>
  );
}

export function ChartEmpty({ message = "No data for this period." }: { message?: string }) {
  return <div style={{ display: "grid", placeItems: "center", height: "100%", color: "var(--text-3)", fontSize: 13 }}>{message}</div>;
}
