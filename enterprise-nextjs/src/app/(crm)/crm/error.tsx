"use client";

import Link from "next/link";
import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

// Friendly boundary for unexpected CRM errors. The message is deliberately generic (no stack, no SQL);
// the digest lets an administrator correlate the report with the server log.
export default function CrmError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error("crm: render error", error.digest ?? ""); }, [error]);
  return (
    <main className="page">
      <section className="card" role="alert" style={{ maxWidth: 560, margin: "48px auto", textAlign: "center", display: "grid", justifyItems: "center", gap: 8, padding: 32 }}>
        <span className="kpi-icon tone-danger" style={{ width: 44, height: 44 }} aria-hidden="true"><AlertTriangle size={20} /></span>
        <h1 style={{ fontSize: "1.125rem" }}>Something went wrong</h1>
        <p className="muted" style={{ margin: 0 }}>The page could not be loaded. Your data has not been changed.</p>
        {error.digest ? <p className="hint" style={{ margin: 0 }}>Reference: <span className="mono">{error.digest}</span></p> : null}
        <div className="button-group" style={{ marginTop: 12 }}>
          <button className="button" onClick={reset} type="button"><RotateCcw size={15} aria-hidden="true" />Try again</button>
          <Link className="button secondary" href="/crm/entrydashboard">Go to dashboard</Link>
        </div>
      </section>
    </main>
  );
}
