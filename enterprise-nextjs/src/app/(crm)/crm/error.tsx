"use client";

import { useEffect } from "react";

// Friendly boundary for unexpected CRM errors. The message is deliberately generic (no stack, no SQL);
// the digest lets an administrator correlate the report with the server log.
export default function CrmError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error("crm: render error", error.digest ?? ""); }, [error]);
  return (
    <main className="page">
      <div className="card" role="alert">
        <h1>Something went wrong</h1>
        <p style={{ color: "var(--muted)" }}>The page could not be loaded. Your data has not been changed.{error.digest ? ` Reference: ${error.digest}.` : ""}</p>
        <button className="button" onClick={reset} type="button">Try again</button>
      </div>
    </main>
  );
}
